# Walkthrough: Multilingual AI Transcription Studio POC

I have built a functional, full-stack Proof of Concept for the **AI Multilingual Transcription Studio**. It runs locally on a standard CPU-only laptop, processes multilingual audio (Gujarati, Hindi, English), performs audio enhancement using FFmpeg, transcribes using `faster-whisper`, auto-detects segment languages, clusters speakers using MFCC voice prints, and provides a synchronized transcript editor.

## What Was Completed

### 1. Python FastAPI Backend Service
- **[requirements.txt](../backend/requirements.txt)**: Lists essential API and machine learning dependencies.
- **[main.py](../backend/app/main.py)**: Serves endpoints for upload (`/api/transcribe`), polling status (`/api/jobs/{id}`), fetching transcripts (`/api/jobs/{id}/transcript`), streaming original/enhanced audio (`/api/jobs/{id}/audio`), editing transcripts (`/api/jobs/{id}/edit`), and downloading export files (`/api/jobs/{id}/export?format={txt|srt|json}`).
- **[enhancer.py](../backend/app/services/enhancer.py)**: Spawns FFmpeg subprocesses to run:
  - Loudness Normalization (`loudnorm`) to correct low speaker volumes.
  - Dynamic Range Compression (`compand`) to pull quiet speech up to intelligible levels.
  - High-pass and Low-pass filters to strip out low-frequency rumble and high-frequency hiss.
- **[transcriber.py](../backend/app/services/transcriber.py)**: Loads `faster-whisper` on CPU using `int8` quantization. Extracts Mel-Frequency Cepstral Coefficients (MFCCs) via `librosa` for each segment and runs KMeans clustering (`scikit-learn`) to group segment audios into speaker tags, and uses `langdetect` to identify segment languages.

### 2. React / Next.js Frontend Dashboard
- **[package.json](../frontend/package.json)**, **[tsconfig.json](../frontend/tsconfig.json)**, **[next.config.mjs](../frontend/next.config.mjs)**, **[tailwind.config.js](../frontend/tailwind.config.js)**: Build configs for compilation, strict type safety, and custom colors.
- **[layout.tsx](../frontend/app/layout.tsx)** & **[globals.css](../frontend/app/globals.css)**: Holds theme wrappers, fonts, and dark theme defaults.
- **[page.tsx](../frontend/app/page.tsx)**: Main coordinator managing API calls, polling job stages (uploading, analyzing, enhancing, transcribing, finalizing), history caching, and view toggles.
- **[UploadZone.tsx](../frontend/components/UploadZone.tsx)**: Drag-and-drop file upload with sliders for strength (normal, strong, aggressive), expected speaker counts, and model sizes.
- **[TranscriptWorkspace.tsx](../frontend/components/TranscriptWorkspace.tsx)**: Displays the audio player synced with transcript cards, autoscrolls during playback, allows inline edits, renames speakers globally, filters by language/speaker, and updates statistics dynamically.

### 3. Container Configurations & Docs
- **[Dockerfile (Backend)](../backend/Dockerfile)**: Multi-stage python image that pre-installs FFmpeg and sound libs.
- **[Dockerfile (Frontend)](../frontend/Dockerfile)**: Standard production compile configurations.
- **[docker-compose.yml](../docker-compose.yml)**: Integrates both folders to run side-by-side using simple local ports.
- **[README.md](../README.md)**: Clear guidance on starting backend/frontend via Docker or manual installation, and steps for testing.

---

## Technical Highlights

### Volume Normalization and Speech Isolation (FFmpeg)
In [enhancer.py](../backend/app/services/enhancer.py), we construct dynamic filtergraphs. When **Aggressive** enhancement is requested:
```python
filters.append("loudnorm=I=-12:TP=-1.0:LRA=7") # Loud target
filters.append("compand=attacks=0.05|0.05:decays=0.3|0.3:points=-90/-50|-30/-10|-10/-5|0/0") # Boost quiet parts
filters.append("highpass=f=200,lowpass=f=3200") # Restrict frequencies to voice band
```
This isolates human voices and makes quiet speech legible before Whisper processes the file.

### CPU-Friendly Speaker Separation
True speaker diarization is usually heavy and requires CUDA. In [transcriber.py](../backend/app/services/transcriber.py), we resolve this constraint:
1. Crop the audio corresponding to each segment timestamp.
2. Call `librosa.feature.mfcc(y, sr, n_mfcc=13)` to extract voice features.
3. Apply `np.mean(mfccs, axis=1)` to represent the segment voice signature.
4. Run `KMeans(n_clusters=num_speakers)` to group segments by voice similarity.
This runs instantly on CPU with negligible memory footprint.
