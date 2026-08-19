# Architecture Overview: AI Multilingual Transcription Studio

This document explains the full-stack architecture, processing pipelines, and local AI workflows implemented in the Proof of Concept.

---

## System Architecture

The application is structured into two decoupled components connected via REST API:

```text
┌──────────────────────┐               ┌─────────────────────┐
│ Next.js Frontend     │  HTTP / API   │ FastAPI Backend     │
│ (Port 3000)          │ ────────────> │ (Port 8000)         │
│                      │ <──────────── │                     │
│ Interactive Editor   │               │ FFmpeg + Whisper    │
└──────────────────────┘               └─────────────────────┘
```

### 1. Frontend (Next.js + Tailwind CSS)
- **App Router**: Using Next.js App Router structure.
- **Client Side State**: Manages drag-and-drop uploads, polling status, synchronized audio timestamps, filters, and inline editing.
- **Tailwind CSS**: Dark, modern theme layout designed for high readability.

### 2. Backend (FastAPI + Python)
- **FastAPI Application**: High performance asynchronous router handling multi-part file uploads and file downloads.
- **In-Memory & Local JSON Store**: Avoids heavy database systems (Postgres/MongoDB) for the local POC, storing job states in `backend/data/jobs_index.json`.
- **Background Tasks**: Executes audio enhancement, transcribing, and diarization in asynchronous Python threads without blocking the API loop.

---

## The Audio Enhancement Pipeline

Target audio files often consist of low-volume, quiet speakers. To make this speech intelligible, we feed the raw files through an FFmpeg process in `backend/app/services/enhancer.py`:

```text
Raw Audio ──> Loudness Correction ──> Dynamic Compression ──> Bandpass Filtering ──> 16kHz Mono WAV
```

### FFmpeg Filters Applied:
- **`loudnorm`**: Loudness normalization (EBU R128). Automatically targets an integrated loudness level (e.g. `-16 LUFS` for standard, `-12 LUFS` for aggressive profile) to pull quiet volumes up without causing clipping.
- **`compand`**: Dynamic range compression. Dynamically squeezes the difference between the loudest and quietest sounds, boosting low-level human whispers.
- **`highpass` & `lowpass`**: Limits frequencies to standard human voice bands (150Hz - 3800Hz) to clear out low-end microphone rumble and high-end static hiss.

---

## Speech Recognition & Diarization (Local CPU)

To ensure this POC runs smoothly on an 8 GB RAM CPU-only laptop, we implemented an optimized pipeline:

### 1. `faster-whisper` on CPU (int8)
- Loads models (defaulting to `base`) using `int8` integer quantization. This reduces RAM usage to less than 500MB and speeds up processing significantly compared to standard float16/float32 CPU models.

### 2. Language Detection per Segment
- Instead of forcing the model to select a single global language, we transcribe the audio and analyze the text of each generated segment using the `langdetect` library to dynamically assign badges (`gu`, `hi`, `en`).

### 3. Voice Print Clustering (MFCC + KMeans)
Since neural speaker diarization (like PyAnnote) requires high RAM and CUDA GPUs, we use an MFCC-based machine learning heuristic:
1. Cropping: We slice the enhanced WAV file at the exact start/end boundary of each transcribed segment.
2. MFCC Extraction: Using `librosa`, we extract the Mel-Frequency Cepstral Coefficients (MFCCs) of each audio slice, representing the speaker's vocal frequency signature.
3. Feature Representation: Take the mean of the MFCCs over the time axis, resulting in a single 13-dimensional vector per segment.
4. KMeans Clustering: Run a `KMeans` algorithm on the vectors. The resulting cluster labels (e.g. Cluster 0, Cluster 1) map directly to `Speaker 1` and `Speaker 2` in the final JSON schema.
