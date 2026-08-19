import os
import uuid
import logging
import numpy as np
import librosa
from sklearn.cluster import KMeans
from langdetect import detect, LangDetectException
from faster_whisper import WhisperModel

logger = logging.getLogger(__name__)

# Model cache to avoid reloading on every request
_model_cache = {}

def get_whisper_model(model_size: str = "base") -> WhisperModel:
    """
    Returns a cached WhisperModel or loads a new one on CPU.
    """
    global _model_cache
    if model_size not in _model_cache:
        logger.info(f"Loading Whisper model '{model_size}' on CPU (int8)...")
        # CPU compute_type defaults to int8 for faster CPU inference and low memory footprint
        _model_cache[model_size] = WhisperModel(
            model_size,
            device="cpu",
            compute_type="int8",
            download_root=os.path.join(os.path.expanduser("~"), ".cache", "whisper")
        )
        logger.info(f"Model '{model_size}' loaded successfully.")
    return _model_cache[model_size]

def detect_segment_language(text: str, default_lang: str = "en") -> str:
    """
    Detects language of a segment text. Returns 'gu', 'hi', 'en', or default.
    """
    if not text or len(text.strip()) < 3:
        return default_lang

    try:
        lang = detect(text)
        # Map detected languages to our targets
        if lang in ["gu", "hi", "en"]:
            return lang
        # Fallback mappings for related scripts or misclassifications
        if lang in ["mr", "ne", "sa"]: # Devanagari script users
            return "hi"
        return default_lang
    except LangDetectException:
        return default_lang

def extract_segment_features(audio_path: str, start: float, end: float) -> np.ndarray:
    """
    Extracts mean MFCC features for a specific audio time slice.
    """
    duration = end - start
    if duration < 0.1:
        return np.zeros(13)

    try:
        # Load only the portion of audio for the segment
        y, sr = librosa.load(audio_path, sr=16000, offset=start, duration=duration)
        if len(y) == 0:
            return np.zeros(13)
        # Extract MFCCs
        mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        # Average over time axis to get a 13-dimensional speaker representation
        return np.mean(mfccs, axis=1)
    except Exception as e:
        logger.warning(f"Error extracting MFCCs for segment {start}-{end}: {str(e)}")
        return np.zeros(13)

def run_transcription_pipeline(
    audio_path: str,
    model_size: str = "base",
    expected_speakers: int = 0  # 0 means auto-detect
) -> dict:
    """
    Runs the complete transcription pipeline including Whisper, 
    Segment Language Detection, and Speaker Diarization/Clustering.
    """
    if not os.path.exists(audio_path):
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    # 1. Speech Recognition
    model = get_whisper_model(model_size)
    logger.info(f"Starting Whisper transcription for {audio_path}...")
    
    # beam_size 5 is standard for good accuracy/speed tradeoff
    segments, info = model.transcribe(audio_path, beam_size=5)
    segments = list(segments)
    
    global_lang = info.language
    logger.info(f"Whisper transcript finished. Detected global language: {global_lang}")
    logger.info(f"Total segments transcribed: {len(segments)}")

    # 2. Process segments and extract speaker features (MFCCs)
    processed_segments = []
    speaker_features = []

    for i, seg in enumerate(segments):
        # Determine language for this segment text
        seg_lang = detect_segment_language(seg.text, default_lang=global_lang)
        
        # Calculate confidence from average log probability
        # Average log probability is usually negative, closer to 0 is higher confidence
        # Map avg_logprob of -1.0 to 0.0 onto confidence percentage 0 to 100
        conf_score = int(min(100, max(0, (seg.avg_logprob + 1.5) * 100))) if seg.avg_logprob else 80

        # High, medium, low confidence classification
        if conf_score > 70:
            confidence = "high"
        elif conf_score > 40:
            confidence = "medium"
        else:
            confidence = "low"

        # Check if segment text contains [unclear] or was very low confidence
        needs_review = confidence == "low" or "[unclear" in seg.text.lower()

        segment_data = {
            "id": str(uuid.uuid4()),
            "start": round(seg.start, 2),
            "end": round(seg.end, 2),
            "text": seg.text.strip(),
            "language": seg_lang,
            "confidence": confidence,
            "needsReview": needs_review,
            "speaker": "Speaker 1" # Default placeholder, will be clustered next
        }
        processed_segments.append(segment_data)

        # Extract features for speaker clustering
        feats = extract_segment_features(audio_path, seg.start, seg.end)
        speaker_features.append(feats)

    # 3. Speaker Clustering (Lightweight Diarization on CPU)
    if len(processed_segments) > 0 and len(speaker_features) > 0:
        # Determine number of speakers
        num_speakers = expected_speakers
        if num_speakers <= 0:
            # Simple heuristic to determine speakers if auto
            num_speakers = 2 if len(processed_segments) > 3 else 1

        # Keep n_clusters bounded by the number of segments
        num_speakers = min(num_speakers, len(processed_segments))

        if num_speakers > 1:
            try:
                features_matrix = np.array(speaker_features)
                
                # Run KMeans clustering
                kmeans = KMeans(n_clusters=num_speakers, random_state=42, n_init=10)
                speaker_labels = kmeans.fit_predict(features_matrix)
                
                for idx, label in enumerate(speaker_labels):
                    processed_segments[idx]["speaker"] = f"Speaker {label + 1}"
                
                logger.info(f"Speaker clustering complete. Clustered {num_speakers} speakers.")
            except Exception as e:
                logger.error(f"Failed to cluster speakers: {str(e)}")
                # Fallback: assign alternative speaker based on simple index switches
                for idx, seg in enumerate(processed_segments):
                    seg["speaker"] = f"Speaker {(idx % num_speakers) + 1}"

    # Extract all distinct speakers and languages
    unique_speakers = list(set(seg["speaker"] for seg in processed_segments))
    unique_speakers.sort()
    
    unique_languages = list(set(seg["language"] for seg in processed_segments if seg["language"]))
    unique_languages.sort()

    return {
        "segments": processed_segments,
        "speakers": unique_speakers,
        "languages": unique_languages
    }
