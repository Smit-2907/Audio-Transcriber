# AI Multilingual Transcription Studio POC

A functional Proof of Concept for an **AI-powered multilingual audio transcription platform**, designed to handle low-volume, quiet speech containing mixed Gujarati, Hindi, and English.

## Features

1. **FFmpeg Audio Enhancement**:
   - Volume Normalization (`loudnorm`).
   - Dynamic Range Compression (`compand`) to pull quiet speech up.
   - High-pass and Low-pass filters to reduce background rumble/hiss.
2. **CPU-Friendly Transcription**:
   - Runs locally on CPU using `faster-whisper` and `int8` quantization.
   - Preserves languages exactly as spoken: Gujarati script, Devanagari (Hindi) script, and English. No automatic translation.
3. **Segment Language Identification**:
   - Automatically detects the language (`gu`, `hi`, `en`) for each individual sentence.
4. **MFCC Speaker Diarization**:
   - Slices audio per segment, extracts Mel-Frequency Cepstral Coefficients (MFCCs) using `librosa`, and clusters them using KMeans (`scikit-learn`) to classify speakers on CPU.
5. **Interactive Transcript UI**:
   - Highlight and autoscroll corresponding segments during playback.
   - Click timestamp to seek audio.
   - Inline segment text editing and speaker renaming.
   - Statistics panel and search across all three languages.
   - Multi-format export: Plain text (`TXT`), timestamped Subtitles (`SRT`), and raw structures (`JSON`).

---

## Getting Started

You can run the application either using **Docker Compose** (recommended) or **locally on your machine**.

### Prerequisites

Ensure you have **FFmpeg** installed:
- **macOS**: `brew install ffmpeg`
- **Linux (Ubuntu/Debian)**: `sudo apt update && sudo apt install -y ffmpeg`
- **Windows**: Download binaries from ffmpeg.org and add to PATH.

---

### Option A: Running with Docker Compose (Recommended)

Docker Compose bundles FFmpeg, Node, and Python together.

1. Navigate to the root directory:
   ```bash
   cd /home/smitsolanki/Desktop/POCs/Audio
   ```
2. Build and launch the containers:
   ```bash
   docker-compose up --build
   ```
3. Open the app in your browser:
   - Frontend: [http://localhost:3000](http://localhost:3000)
   - Backend API documentation: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### Option B: Local Installation

#### 1. Setup Backend

1. Navigate to backend:
   ```bash
   cd /home/smitsolanki/Desktop/POCs/Audio/backend
   ```
2. Create and activate a python virtual environment:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Launch FastAPI server:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

#### 2. Setup Frontend

1. Open a new terminal and navigate to frontend:
   ```bash
   cd /home/smitsolanki/Desktop/POCs/Audio/frontend
   ```
2. Install npm dependencies:
   ```bash
   npm install  # or pnpm install
   ```
3. Run Next.js in development mode:
   ```bash
   npm run dev
   ```
4. Access the web interface at [http://localhost:3000](http://localhost:3000).

---

## Testing the POC with standard recording

1. Navigate to [http://localhost:3000](http://localhost:3000).
2. Click the drag-and-drop region or browse files.
3. Select the file: `/home/smitsolanki/Downloads/Standard recording 6.mp3`
4. Expand **Audio Enhancement & Model Settings**:
   - Check **Normalize Volume**, **Noise Reduction**, and **Speech Boost**.
   - Set **Enhancement Strength** to *Strong* or *Aggressive* (since the speakers are quiet).
   - Set **Whisper Model Size** to *base* or *small* for fast local testing on CPU.
5. Click **Start Transcription**.
6. Follow the live stage-based progress indicator.
7. Once finished, play the synchronized audio, click on timestamps to seek, search for keywords, rename the speakers, or export the resulting TXT/SRT transcriptions.
# Audio-Transcriber
