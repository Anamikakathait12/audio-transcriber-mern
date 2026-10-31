# 🎙️ Audio to Text Transcriber (MERN Stack)

A modern full-stack web application that allows users to upload audio files (`.mp3`, `.wav`, `.m4a`, `.webm`, `.ogg`, `.oga`, `.opus`), transcribes them with high accuracy using **Groq's Whisper API** (`whisper-large-v3`), stores the transcription data in **MongoDB Atlas**, and renders the results in a reactive **React + Tailwind CSS** frontend.

---

## 📁 Project Structure

```text
speech-to-text/
├── server/
│   ├── config/
│   │   └── db.js                 # MongoDB Mongoose connection handler
│   ├── controllers/
│   │   ├── authController.js     # User registration, login, & session
│   │   └── transcriptController.js # Upload, transcribe, fetch, & delete logic
│   ├── middleware/
│   │   ├── auth.js               # JWT Bearer token protection middleware
│   │   └── upload.js             # Multer setup (file filter & 25MB limit)
│   ├── models/
│   │   ├── Transcript.js         # Mongoose schema for transcripts (user-scoped)
│   │   └── User.js               # User schema with bcrypt (12 rounds) & validation
│   ├── routes/
│   │   ├── authRoutes.js         # /api/auth routes with rate limiting
│   │   └── transcriptRoutes.js   # /api/transcripts routing (protected)
│   ├── services/
│   │   ├── diarizeService.js     # AssemblyAI speaker diarization client
│   │   └── transcribeService.js  # Isolated Groq Whisper API client
│   ├── uploads/                  # Temporary file processing directory
│   ├── .env.example              # Environment variables template
│   ├── package.json              # Server dependencies & scripts (ES modules)
│   └── server.js                 # Express app & global error handler
│
├── client/
│   ├── src/
│   │   ├── api/
│   │   │   └── transcriptApi.js  # Axios client with auth interceptors & CRUD
│   │   ├── components/
│   │   │   ├── HistoryList.jsx   # Searchable & paginated transcript history
│   │   │   ├── Recorder.jsx      # Live microphone recorder with preview & timer
│   │   │   ├── TranscriptResult.jsx # Full transcript viewer, copy & download
│   │   │   └── UploadBox.jsx     # Drag-and-drop audio uploader with validation
│   │   ├── context/
│   │   │   └── AuthContext.jsx   # React Auth context (JWT storage & session)
│   │   ├── pages/
│   │   │   ├── Login.jsx         # User login form with client validation
│   │   │   └── Register.jsx      # User registration form with validation
│   │   ├── App.jsx               # Dashboard, tab switcher & health indicator
│   │   ├── index.css             # Tailwind CSS directives & animations
│   │   └── main.jsx              # React DOM root entry with AuthProvider
│   ├── index.html                # Vite HTML shell
│   ├── package.json              # Client dependencies & scripts
│   ├── tailwind.config.js        # Tailwind CSS configuration
│   └── vite.config.js            # Vite build setup & backend API proxy
│
├── .gitignore
└── README.md
```

---

## 🛠️ Tech Stack

### Backend (`/server`)
- **Runtime:** Node.js (ES Modules: `"type": "module"`)
- **Framework:** Express.js
- **Database:** MongoDB Atlas via Mongoose
- **Transcription Engine:** Groq Cloud SDK (`whisper-large-v3`)
- **File Uploads:** Multer (with disk storage & memory cleanup)
- **Dev Tools:** Nodemon, Dotenv, Cors

### Frontend (`/client`)
- **Framework:** React 18
- **Build Tool:** Vite
- **Styling:** Tailwind CSS + PostCSS + Autoprefixer
- **HTTP Client:** Axios (configured with Vite reverse proxy `/api`)

---

## ⚡ Prerequisites

Before running the application, make sure you have:
1. **Node.js** (v18.0.0 or higher) and **npm** installed.
2. A free **[MongoDB Atlas](https://www.mongodb.com/cloud/atlas)** cluster connection string.
3. A free **[Groq Cloud API Key](https://console.groq.com/keys)**.
4. An optional free **[AssemblyAI API Key](https://www.assemblyai.com)** (for speaker diarization).

---

## 🚀 Getting Started

### 1. Backend Setup

1. Open a terminal and navigate to the `server` directory:
   ```bash
   cd server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure your environment variables:
   Copy `.env.example` to `.env`:
   ```bash
   # On Windows PowerShell
   Copy-Item .env.example .env
   ```
   Open `server/.env` and fill in your values:
   ```env
   PORT=5000
   MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/audio_transcriber?retryWrites=true&w=majority
   GROQ_API_KEY=gsk_your_groq_api_key_here
   ASSEMBLY_API_KEY=your_assemblyai_api_key_here
   ```

4. Start the backend development server:
   ```bash
   npm run dev
   ```
   The server will run on `http://localhost:5000`.

---

### 2. Frontend Setup

1. In a separate terminal, navigate to the `client` directory:
   ```bash
   cd client
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   The client will run on `http://localhost:5173`.

---

## 📡 API Reference

Base URL: `http://localhost:5000`

### 1. Health Check
- **`GET /api/health`**
- **Response `200 OK`**:
  ```json
  {
    "status": "ok",
    "message": "Audio to Text Transcriber API is healthy",
    "timestamp": "2026-10-30T18:30:00.000Z"
  }
  ```

---

### 2. Transcribe Audio
- **`POST /api/transcripts`**
- **Content-Type:** `multipart/form-data`
- **Body:**
  - `audio`: Audio file (`.mp3`, `.wav`, `.m4a`, `.webm`, `.ogg`, `.oga`, or `.opus`, max **25 MB**)
- **Response `201 Created`**:
  ```json
  {
    "message": "Audio transcribed and saved successfully",
    "data": {
      "_id": "672289f812b1d30560a1e3e4",
      "text": "Antigravity voice transcription powered by Whisper Large v3.",
      "originalFileName": "sample.mp3",
      "fileSize": 184520,
      "language": "english",
      "duration": 4.12,
      "createdAt": "2026-10-30T18:30:15.000Z"
    }
  }
  ```

---

### 3. List All Transcripts (Search & Pagination)
- **`GET /api/transcripts?search=keyword&page=1&limit=10`**
- **Query Parameters:**
  - `search` *(optional)*: Case-insensitive search match across transcript text and original file name.
  - `page` *(optional, default: 1)*: Page number.
  - `limit` *(optional, default: 10)*: Number of items per page.
- **Response `200 OK`**:
  ```json
  {
    "transcripts": [
      {
        "_id": "672289f812b1d30560a1e3e4",
        "text": "Antigravity voice transcription powered by Whisper Large v3.",
        "originalFileName": "sample.mp3",
        "fileSize": 184520,
        "language": "english",
        "duration": 4.12,
        "createdAt": "2026-10-30T18:30:15.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "totalPages": 1
  }
  ```

---

### 4. Get Transcript by ID
- **`GET /api/transcripts/:id`**
- **Response `200 OK`**:
  ```json
  {
    "data": {
      "_id": "672289f812b1d30560a1e3e4",
      "text": "Antigravity voice transcription powered by Whisper Large v3.",
      "originalFileName": "sample.mp3",
      "fileSize": 184520,
      "language": "english",
      "duration": 4.12,
      "createdAt": "2026-10-30T18:30:15.000Z"
    }
  }
  ```
- **Response `404 Not Found`**:
  ```json
  {
    "error": "Transcript not found"
  }
  ```

---

### 5. Delete Transcript by ID
- **`DELETE /api/transcripts/:id`**
- **Response `200 OK`**:
  ```json
  {
    "message": "Transcript deleted successfully",
    "id": "672289f812b1d30560a1e3e4"
  }
  ```

---

## 🛡️ Error Handling & File Safeguards

The backend has built-in global error-handling for upload and validation edge cases:

| Issue | HTTP Status | Response |
| :--- | :---: | :--- |
| File > 25 MB | `400 Bad Request` | `{"error": "File too large. Maximum allowed file size is 25 MB."}` |
| Wrong Field Name | `400 Bad Request` | `{"error": "Unexpected field '<name>'. Please upload audio using the form field name 'audio'."}` |
| Disallowed Extension/MIME | `400 Bad Request` | `{"error": "Invalid file type. Only audio files (.mp3, .wav, .m4a, .webm, .ogg, .oga, .opus) are allowed."}` |
| Missing Audio in Request | `400 Bad Request` | `{"error": "No audio file uploaded. Please provide an audio file with the field name 'audio'."}` |
| Invalid MongoDB ObjectId | `400 Bad Request` | `{"error": "Invalid transcript ID format"}` |
| Non-existent Record | `404 Not Found` | `{"error": "Transcript not found"}` |

> **Disk Cleanup:** Uploaded files stored in `server/uploads/` are guaranteed to be unlinked (deleted) in a `finally` block immediately after processing, ensuring no orphaned audio files consume disk space.

---

## 📌 Development Roadmap

- [x] **Step 1:** Project setup (Express ES modules, Vite + Tailwind client, health check).
- [x] **Step 2:** Backend audio transcription API (Multer, Groq `whisper-large-v3`, Mongoose schema, CRUD routes).
- [x] **Step 3:** Frontend UI (Drag-and-drop audio uploader, client validation, progress/transcribing states, copy/download buttons, backend error alert).
- [x] **Step 4:** Transcript history (Search with debounce, pagination, expand/collapse, copy/download with UTF-8 BOM for Hindi & non-English, delete confirmation, auto-refresh on new upload).
- [x] **Step 5:** Live mic recording (MediaRecorder, timer & pulsing indicator, audio preview player, auto-stop at 5 min, hardware track release, tab switcher).
- [x] **Step 6:** Speaker detection (AssemblyAI diarization, speaker labels 1-N, start/end timestamps, chat-style view, multi-speaker badges & exports).
- [x] **Step 7:** User authentication & ownership (JWT auth, bcrypt 12 rounds, rate limiting, protected user routes, login/register views, session restoration).

