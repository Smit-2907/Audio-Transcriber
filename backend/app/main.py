import os
import uuid
import json
import logging
from typing import Optional, List
from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

from app.services.enhancer import enhance_audio
from app.services.transcriber import run_transcription_pipeline

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="Multilingual AI Transcription Studio API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for the local POC
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directories
UPLOADS_DIR = "uploads"
PROCESSED_DIR = "processed"
DATA_DIR = "data"

for d in [UPLOADS_DIR, PROCESSED_DIR, DATA_DIR]:
    os.makedirs(d, exist_ok=True)

# Path to job history index
JOBS_INDEX_FILE = os.path.join(DATA_DIR, "jobs_index.json")

def load_jobs_index() -> list:
    if os.path.exists(JOBS_INDEX_FILE):
        try:
            with open(JOBS_INDEX_FILE, "r") as f:
                return json.load(f)
        except Exception:
            return []
    return []

def save_jobs_index(index: list):
    try:
        with open(JOBS_INDEX_FILE, "w") as f:
            json.dump(index, f, indent=2)
    except Exception as e:
        logger.error(f"Failed to save jobs index: {str(e)}")

def save_job_details(job_id: str, data: dict):
    file_path = os.path.join(DATA_DIR, f"{job_id}.json")
    try:
        with open(file_path, "w") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        logger.error(f"Failed to save job details for {job_id}: {str(e)}")

def load_job_details(job_id: str) -> Optional[dict]:
    file_path = os.path.join(DATA_DIR, f"{job_id}.json")
    if os.path.exists(file_path):
        try:
            with open(file_path, "r") as f:
                return json.load(f)
        except Exception:
            return None
    return None

class SegmentUpdate(BaseModel):
    text: str
    speaker: str
    needsReview: bool

class TranscriptUpdate(BaseModel):
    segments: List[dict]

# Background Worker
def process_transcription_job(
    job_id: str,
    original_filename: str,
    file_path: str,
    normalize_volume: bool,
    reduce_noise: bool,
    speech_enhance: bool,
    strength: str,
    model_size: str,
    expected_speakers: int
):
    try:
        logger.info(f"Starting background job {job_id} for {original_filename}...")
        
        # 1. Analyze phase (get duration)
        import soundfile as sf
        duration = 0.0
        try:
            info = sf.info(file_path)
            duration = info.duration
        except Exception as e:
            logger.warning(f"Could not read duration with soundfile: {str(e)}")
            # Fallback using librosa
            try:
                import librosa
                duration = float(librosa.get_duration(path=file_path))
            except Exception as le:
                logger.error(f"Fallback librosa duration failed: {str(le)}")
                duration = 10.0 # arbitrary fallback

        # Update index status
        jobs = load_jobs_index()
        for j in jobs:
            if j["job_id"] == job_id:
                j["status"] = "processing"
                j["stage"] = "enhancing"
                j["duration"] = round(duration, 2)
                break
        save_jobs_index(jobs)

        # 2. Enhancement phase
        enhanced_path = os.path.join(PROCESSED_DIR, f"{job_id}_enhanced.wav")
        enhancement_success = enhance_audio(
            input_path=file_path,
            output_path=enhanced_path,
            normalize_volume=normalize_volume,
            reduce_noise=reduce_noise,
            speech_enhance=speech_enhance,
            strength=strength
        )
        
        if not enhancement_success:
            logger.warning("Enhancement failed, falling back to original audio format conversion")
            # If enhancement fails, run simple ffmpeg command to convert it to 16k mono wav
            import subprocess
            subprocess.run([
                "ffmpeg", "-y", "-i", file_path, 
                "-ar", "16000", "-ac", "1", enhanced_path
            ], capture_output=True)

        # Update index status
        jobs = load_jobs_index()
        for j in jobs:
            if j["job_id"] == job_id:
                j["stage"] = "transcribing"
                break
        save_jobs_index(jobs)

        # 3. Speech Recognition + Speaker Diarization phase
        transcription_result = run_transcription_pipeline(
            audio_path=enhanced_path,
            model_size=model_size,
            expected_speakers=expected_speakers
        )

        # Save details
        job_details = {
            "id": job_id,
            "filename": original_filename,
            "duration": round(duration, 2),
            "segments": transcription_result["segments"],
            "languages": transcription_result["languages"],
            "speakers": transcription_result["speakers"],
            "createdAt": jobs[0]["createdAt"] if jobs else "" # Will match index
        }
        save_job_details(job_id, job_details)

        # Mark job completed in index
        jobs = load_jobs_index()
        for j in jobs:
            if j["job_id"] == job_id:
                j["status"] = "completed"
                j["stage"] = "completed"
                j["languages"] = transcription_result["languages"]
                j["speakers"] = transcription_result["speakers"]
                break
        save_jobs_index(jobs)
        logger.info(f"Job {job_id} completed successfully!")

    except Exception as e:
        logger.error(f"Job {job_id} failed: {str(e)}")
        jobs = load_jobs_index()
        for j in jobs:
            if j["job_id"] == job_id:
                j["status"] = "failed"
                j["stage"] = "failed"
                j["error"] = str(e)
                break
        save_jobs_index(jobs)

# Endpoints
@app.post("/api/transcribe")
async def transcribe(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    normalize_volume: bool = Form(True),
    reduce_noise: bool = Form(True),
    speech_enhance: bool = Form(True),
    strength: str = Form("normal"),
    model_size: str = Form("base"),
    expected_speakers: int = Form(0)
):
    # Verify file format
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".mp3", ".wav", ".m4a", ".mp4", ".webm", ".flac"]:
        raise HTTPException(status_code=400, detail=f"Unsupported file format: {ext}")

    job_id = str(uuid.uuid4())
    file_path = os.path.join(UPLOADS_DIR, f"{job_id}{ext}")
    
    # Save uploaded file
    try:
        with open(file_path, "wb") as f:
            f.write(await file.read())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save upload: {str(e)}")

    import datetime
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Add to index
    job_index_entry = {
        "job_id": job_id,
        "filename": file.filename,
        "size_bytes": os.path.getsize(file_path),
        "status": "queued",
        "stage": "uploading",
        "duration": 0.0,
        "languages": [],
        "speakers": [],
        "createdAt": now_str,
        "model_size": model_size
    }

    jobs = load_jobs_index()
    jobs.insert(0, job_index_entry) # Put newest first
    save_jobs_index(jobs)

    # Spawn background task
    background_tasks.add_task(
        process_transcription_job,
        job_id=job_id,
        original_filename=file.filename,
        file_path=file_path,
        normalize_volume=normalize_volume,
        reduce_noise=reduce_noise,
        speech_enhance=speech_enhance,
        strength=strength,
        model_size=model_size,
        expected_speakers=expected_speakers
    )

    return {"job_id": job_id, "status": "queued"}

@app.get("/api/jobs")
async def get_jobs():
    return load_jobs_index()

@app.get("/api/jobs/{job_id}")
async def get_job(job_id: str):
    jobs = load_jobs_index()
    for j in jobs:
        if j["job_id"] == job_id:
            return j
    raise HTTPException(status_code=404, detail="Job not found")

@app.get("/api/jobs/{job_id}/transcript")
async def get_transcript(job_id: str):
    details = load_job_details(job_id)
    if details:
        return details
    
    # Check if job exists in index but is still processing
    jobs = load_jobs_index()
    for j in jobs:
        if j["job_id"] == job_id:
            return {
                "id": job_id,
                "filename": j["filename"],
                "duration": j["duration"],
                "segments": [],
                "languages": [],
                "speakers": [],
                "status": j["status"],
                "stage": j["stage"]
            }
    raise HTTPException(status_code=404, detail="Job not found")

@app.get("/api/jobs/{job_id}/audio")
async def get_audio(job_id: str, enhanced: bool = Query(True)):
    """
    Streams either the original audio file or the enhanced WAV file.
    """
    if enhanced:
        enhanced_path = os.path.join(PROCESSED_DIR, f"{job_id}_enhanced.wav")
        if os.path.exists(enhanced_path):
            return FileResponse(enhanced_path, media_type="audio/wav")
    
    # Find original upload path
    for ext in [".mp3", ".wav", ".m4a", ".mp4", ".webm", ".flac"]:
        original_path = os.path.join(UPLOADS_DIR, f"{job_id}{ext}")
        if os.path.exists(original_path):
            media_type = f"audio/{ext[1:]}" if ext != ".mp3" else "audio/mpeg"
            return FileResponse(original_path, media_type=media_type)
            
    raise HTTPException(status_code=404, detail="Audio file not found")

@app.post("/api/jobs/{job_id}/edit")
async def edit_transcript(job_id: str, update_data: TranscriptUpdate):
    details = load_job_details(job_id)
    if not details:
        raise HTTPException(status_code=404, detail="Job details not found")

    # Update segments
    details["segments"] = update_data.segments

    # Update distinct speakers and languages dynamically from saved edits
    unique_speakers = list(set(seg["speaker"] for seg in update_data.segments if seg.get("speaker")))
    unique_speakers.sort()
    details["speakers"] = unique_speakers

    unique_languages = list(set(seg["language"] for seg in update_data.segments if seg.get("language")))
    unique_languages.sort()
    details["languages"] = unique_languages

    save_job_details(job_id, details)

    # Also update index list speakers/languages
    jobs = load_jobs_index()
    for j in jobs:
        if j["job_id"] == job_id:
            j["speakers"] = unique_speakers
            j["languages"] = unique_languages
            break
    save_jobs_index(jobs)

    return {"status": "success"}

@app.get("/api/jobs/{job_id}/export")
async def export_transcript(job_id: str, format: str = Query("txt")):
    details = load_job_details(job_id)
    if not details:
        raise HTTPException(status_code=404, detail="Job details not found")

    segments = details["segments"]
    filename = os.path.splitext(details["filename"])[0]

    def format_timestamp(seconds: float, srt: bool = False) -> str:
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        msecs = int(round((seconds % 1) * 1000))
        if srt:
            return f"{hours:02d}:{minutes:02d}:{secs:02d},{msecs:03d}"
        else:
            return f"{hours:02d}:{minutes:02d}:{secs:02d}"

    if format == "txt":
        content = ""
        for seg in segments:
            time_str = format_timestamp(seg["start"])
            content += f"[{time_str}] {seg['speaker']}: {seg['text']}\n\n"
        
        return StreamingResponse(
            iter([content]),
            media_type="text/plain",
            headers={"Content-Disposition": f"attachment; filename={filename}.txt"}
        )

    elif format == "srt":
        content = ""
        for i, seg in enumerate(segments):
            start_str = format_timestamp(seg["start"], srt=True)
            end_str = format_timestamp(seg["end"], srt=True)
            content += f"{i+1}\n{start_str} --> {end_str}\n[{seg['speaker']}] {seg['text']}\n\n"
            
        return StreamingResponse(
            iter([content]),
            media_type="text/srt",
            headers={"Content-Disposition": f"attachment; filename={filename}.srt"}
        )

    elif format == "json":
        return details

    else:
        raise HTTPException(status_code=400, detail=f"Unsupported export format: {format}")
