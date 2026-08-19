# API Reference: AI Multilingual Transcription Studio

The backend FastAPI service exposes endpoints for managing uploads, job states, audio streams, and transcript exports.

---

## Endpoints

### 1. Upload & Transcribe
Initiates an asynchronous audio enhancement and transcription job.

- **URL**: `/api/transcribe`
- **Method**: `POST`
- **Content-Type**: `multipart/form-data`
- **Request Parameters**:
  - `file` (File, Required): The target audio file (`.mp3`, `.wav`, `.m4a`, `.mp4`, `.webm`, or `.flac`).
  - `normalize_volume` (bool, Optional, Default: `true`): Enable volume normalization.
  - `reduce_noise` (bool, Optional, Default: `true`): Enable bandpass filter noise reduction.
  - `speech_enhance` (bool, Optional, Default: `true`): Enable dynamic range voice boost.
  - `strength` (string, Optional, Default: `"normal"`): Strength profile (`"normal"`, `"strong"`, or `"aggressive"`).
  - `model_size` (string, Optional, Default: `"base"`): Whisper model (`"tiny"`, `"base"`, `"small"`, `"medium"`, `"large-v3"`).
  - `expected_speakers` (int, Optional, Default: `0`): Target speaker count. Set to `0` for auto-detect.

- **Response (200 OK)**:
  ```json
  {
    "job_id": "f5635e95-e0d1-43fb-9370-0b65d2ba4b51",
    "status": "queued"
  }
  ```

---

### 2. Get Recent Jobs Index
Fetches the history index of previous transcription jobs.

- **URL**: `/api/jobs`
- **Method**: `GET`
- **Response (200 OK)**:
  ```json
  [
    {
      "job_id": "f5635e95-e0d1-43fb-9370-0b65d2ba4b51",
      "filename": "Standard recording 6.mp3",
      "size_bytes": 54925871,
      "status": "completed",
      "stage": "completed",
      "duration": 1373.15,
      "languages": ["en", "hi", "ne"],
      "speakers": ["Speaker 1", "Speaker 2"],
      "createdAt": "2026-08-20 00:30:48",
      "model_size": "base"
    }
  ]
  ```

---

### 3. Get Job Status
Fetches the status and current stage of a specific job.

- **URL**: `/api/jobs/{job_id}`
- **Method**: `GET`
- **Response (200 OK)**:
  ```json
  {
    "job_id": "f5635e95-e0d1-43fb-9370-0b65d2ba4b51",
    "filename": "Standard recording 6.mp3",
    "size_bytes": 54925871,
    "status": "processing",
    "stage": "transcribing",
    "duration": 1373.15,
    "languages": [],
    "speakers": [],
    "createdAt": "2026-08-20 00:30:48",
    "model_size": "base"
  }
  ```

- **Stages**: `uploading`, `analyzing`, `enhancing`, `transcribing`, `speaker_detection`, `finalizing`, `completed`, `failed`

---

### 4. Get Transcript Details
Fetches full segment arrays, speaker clusters, and timestamped speech items.

- **URL**: `/api/jobs/{job_id}/transcript`
- **Method**: `GET`
- **Response (200 OK)**:
  ```json
  {
    "id": "f5635e95-e0d1-43fb-9370-0b65d2ba4b51",
    "filename": "Standard recording 6.mp3",
    "duration": 1373.15,
    "segments": [
      {
        "id": "9838ea60-5602-4508-8e4d-b393bd8da5ca",
        "start": 0.0,
        "end": 3.0,
        "text": "તમે પેલા Cubiora નું status update કરી દીધું?",
        "language": "gu",
        "confidence": "high",
        "needsReview": false,
        "speaker": "Speaker 2"
      }
    ],
    "languages": ["gu"],
    "speakers": ["Speaker 2"],
    "createdAt": "2026-08-20 00:30:48"
  }
  ```

---

### 5. Stream Audio
Streams either the original audio file or the enhanced WAV cache.

- **URL**: `/api/jobs/{job_id}/audio`
- **Method**: `GET`
- **Query Parameters**:
  - `enhanced` (bool, Optional, Default: `true`): Stream the post-FFmpeg processed WAV cache.
- **Response**: Binary audio stream.

---

### 6. Save Transcript Edits
Saves manual corrections to segments text or speaker assignments.

- **URL**: `/api/jobs/{job_id}/edit`
- **Method**: `POST`
- **Content-Type**: `application/json`
- **Request Body**:
  ```json
  {
    "segments": [
      {
        "id": "9838ea60-5602-4508-8e4d-b393bd8da5ca",
        "start": 0.0,
        "end": 3.0,
        "text": "આપણે પેલા Cubiora નું status update કરી દીધું?",
        "language": "gu",
        "confidence": "high",
        "needsReview": false,
        "speaker": "Smit"
      }
    ]
  }
  ```
- **Response**: `{"status": "success"}`

---

### 7. Export Document
Downloads the transcript formatted as simple text, SRT subtitles, or raw JSON.

- **URL**: `/api/jobs/{job_id}/export`
- **Method**: `GET`
- **Query Parameters**:
  - `format` (string, Required): Export type (`"txt"`, `"srt"`, or `"json"`).
- **Response**: File download stream.
