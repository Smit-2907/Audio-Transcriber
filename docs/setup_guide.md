# Developer Setup Guide

This guide describes how to configure and run the AI Multilingual Transcription Studio on your local system.

---

## Prerequisites

Ensure your system has the following core runtimes:

1. **Python (3.9 to 3.12)**: Used to run the backend FastAPI ML server.
2. **Node.js (18+) & npm**: Used to compile the Next.js React frontend dashboard.
3. **FFmpeg**: The command-line utility used by the backend to isolate vocals and normalize volumes.

### Installing FFmpeg:
- **Debian/Ubuntu**: `sudo apt update && sudo apt install -y ffmpeg`
- **Fedora/RHEL**: `sudo dnf install ffmpeg` (ensure RPM Fusion is enabled)
- **macOS**: `brew install ffmpeg`
- **Windows**: Install using Chocolatey `choco install ffmpeg` or download directly from [ffmpeg.org](https://ffmpeg.org).

---

## Running the Application

### Option A: Using the Makefile (Recommended)

A root-level `Makefile` is provided to automate build steps:

1. **Setup dependencies**:
   ```bash
   make setup
   ```
   *(This creates a backend Python virtual environment, upgrades pip, installs `requirements.txt`, and runs `npm install` inside the frontend).*

2. **Run both servers concurrently**:
   ```bash
   make run
   ```
   *(Starts the FastAPI server on port 8000 and the Next.js app on port 3000 concurrently).*

3. **Cleanup builds and caches**:
   ```bash
   make clean
   ```
   *(Wipes `.venv`, `node_modules`, `.next`, and uploads/enhanced audio files to clear space).*

---

### Option B: Local Manual Commands (Alternative)

If you do not have `make` installed, run these manual commands:

#### 1. Configure and Start Backend:
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### 2. Configure and Start Frontend:
```bash
cd frontend
npm install
npm run dev
```

---

## Verifying the Setup

1. Open [http://localhost:3000](http://localhost:3000) in your browser.
2. Verify that the Welcome Page and the list of Recent Transcriptions load successfully.
3. Drag and drop an audio file (e.g. `Standard recording 6.mp3` from your `Downloads` folder).
4. Click **Start Transcription** and observe the stage progress bar moving.
5. Play the audio and click on segment timestamps to seek, verifying that the frontend, backend, and audio streamer are fully connected and functional.
