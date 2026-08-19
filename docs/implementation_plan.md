# Multilingual AI Transcription Studio POC Implementation Plan

Build a functional Proof of Concept web application for a local, CPU-friendly AI audio transcription platform. The application allows users to upload multilingual audio (Gujarati + Hindi + English), enhances the audio using FFmpeg, transcribes it using `faster-whisper`, performs language detection and speaker clustering, and displays the results in an interactive, editable transcript editor.

## User Review Required

> [!IMPORTANT]
> **CPU & RAM Restrictions**:
> To ensure compatibility with standard laptops (e.g., 8 GB RAM, Intel i5 CPU, no GPU), the backend defaults to the `base` or `small` model of `faster-whisper` for development testing, with options to select `medium` or `large-v3`.
>
> **Fast speaker separation on CPU**:
> We will implement a real, lightweight speaker separation algorithm by extracting MFCCs (Mel-Frequency Cepstral Coefficients) using `librosa` for each transcribed segment and clustering them using `scikit-learn`'s KMeans. This operates locally on CPU without requiring heavy CUDA-based models.

---

## Proposed Changes

### Backend (FastAPI + Python)

We will implement the backend in the `backend/` directory. It will contain:
- `app/main.py`: The FastAPI application entrypoint and router registration.
- `app/services/enhancer.py`: Subprocess interface to FFmpeg for audio volume normalization, bandpass filtering, and compression.
- `app/services/transcriber.py`: Speech-to-text using `faster-whisper`, segment-level language detection via `langdetect`, and speaker clustering using MFCCs + KMeans.
- `app/models/job.py`: Job state models and memory-based storage.

#### [NEW] [requirements.txt](../backend/requirements.txt)
Defines backend dependencies including `fastapi`, `faster-whisper`, `librosa`, `scikit-learn`, and `langdetect`.

#### [NEW] [main.py](../backend/app/main.py)
Initializes FastAPI, defines routes, handles CORS, and exposes audio/transcript downloading and polling endpoints.

#### [NEW] [enhancer.py](../backend/app/services/enhancer.py)
Integrates FFmpeg filters (`loudnorm`, `highpass`, `lowpass`, `compand`) to normalize, filter, and boost quiet voices.

#### [NEW] [transcriber.py](../backend/app/services/transcriber.py)
Handles Whisper transcription loading on CPU, runs inference, performs language detection per segment, and extracts audio slices to cluster speakers.

---

### Frontend (Next.js + Tailwind CSS)

We will build the frontend inside the `frontend/` directory:
- `app/page.tsx`: The main workspace layout that hosts the file upload dashboard, processing timeline, and transcription editor.
- `components/UploadZone.tsx`: A drag-and-drop region displaying audio file metadata.
- `components/ProcessingTimeline.tsx`: Renders real-time stage-based job progress.
- `components/TranscriptWorkspace.tsx`: Renders the audio player synchronized with the editable, timestamped transcript cards.
- `components/StatsPanel.tsx`: Displays real calculated statistics from the transcript data.
- `components/HistoryList.tsx`: Shows previous transcription jobs stored locally.

#### [NEW] [package.json](../frontend/package.json)
Next.js, React, Tailwind, Lucide React, and dynamic state management dependencies.

#### [NEW] [page.tsx](../frontend/app/page.tsx)
The main controller coordinate uploads, polling, active jobs, and recent history lists.

#### [NEW] [TranscriptWorkspace.tsx](../frontend/components/TranscriptWorkspace.tsx)
Handles synchronizing the HTML5 Audio Player current playback time with the corresponding transcript segments, supports inline editing of segment text, renaming speaker identities, and highlighting unclear phrases.

---

### Configuration & Tooling

#### [NEW] [docker-compose.yml](../docker-compose.yml)
Runs both Next.js and FastAPI side-by-side using simple local networking.

#### [NEW] [README.md](../README.md)
Contains step-by-step instructions for local execution, dependency setup, and verification.

---

## Verification Plan

### Manual Verification
1. Run Next.js and FastAPI servers locally or via Docker.
2. Upload the supplied audio file `Standard recording 6.mp3` from the system's `Downloads` folder.
3. Verify that the audio enhancement stage processes the file correctly.
4. Verify that the output transcript shows:
   - Gujarati text in Gujarati script (e.g. "આપણે", "કરીએ").
   - Hindi text in Devanagari script.
   - English text in English.
5. Verify that clicking on any transcript segment seeks the audio player to that exact timestamp.
6. Verify that editing segment text updates the stats panel and displays correctly in the exported TXT/SRT/JSON files.
