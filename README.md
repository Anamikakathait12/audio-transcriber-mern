# 🎙️ Audio to Text Transcriber (MERN Stack)

A modern full-stack web application that allows users to upload audio files (`.mp3`, `.wav`, `.m4a`, `.webm`, `.ogg`), transcribes them with high accuracy using **Groq's Whisper API** (`whisper-large-v3`), stores the transcription data in **MongoDB Atlas**, and renders the results in a reactive **React + Tailwind CSS** frontend.

---

## 📁 Project Structure

```text
speech-to-text/
├── server/
│   ├── config/
│   │   └── db.js                 # MongoDB Mongoose connection handler
│   ├── controllers/
│   │   └── transcriptController.js # Upload, transcribe, fetch, & delete logic
│   ├── middleware/
│   │   └── upload.js             # Multer setup (file filter & 25MB limit)
│   ├── models/
│   │   └── Transcript.js         # Mongoose schema for transcripts
│   ├── routes/
│   │   └── transcriptRoutes.js   # /api/transcripts routing
│   ├── services/
│   │   └── transcribeService.js  # Isolated Groq Whisper API client
│   ├── uploads/                  # Temporary file processing directory
│   ├── .env.example              # Environment variables template
│   ├── package.json              # Server dependencies & scripts (ES modules)
│   └── server.js                 # Express app & global error handler
│
├── client/
│   ├── src/
│   │   ├── App.jsx               # React dashboard & health check verification
│   │   ├── index.css             # Tailwind CSS directives
│   │   └── main.jsx              # React DOM root entry
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
  - `audio`: Audio file (`.mp3`, `.wav`, `.m4a`, `.webm`, or `.ogg`, max **25 MB**)
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

### 3. List All Transcripts
- **`GET /api/transcripts`**
- **Description:** Returns all saved transcripts ordered by newest first.
- **Response `200 OK`**:
  ```json
  {
    "count": 1,
    "data": [
      {
        "_id": "672289f812b1d30560a1e3e4",
        "text": "Antigravity voice transcription powered by Whisper Large v3.",
        "originalFileName": "sample.mp3",
        "fileSize": 184520,
        "language": "english",
        "duration": 4.12,
        "createdAt": "2026-10-30T18:30:15.000Z"
      }
    ]
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
| Disallowed Extension/MIME | `400 Bad Request` | `{"error": "Invalid file type. Only audio files (.mp3, .wav, .m4a, .webm, .ogg) are allowed."}` |
| Missing Audio in Request | `400 Bad Request` | `{"error": "No audio file uploaded. Please provide an audio file with the field name 'audio'."}` |
| Invalid MongoDB ObjectId | `400 Bad Request` | `{"error": "Invalid transcript ID format"}` |
| Non-existent Record | `404 Not Found` | `{"error": "Transcript not found"}` |

> **Disk Cleanup:** Uploaded files stored in `server/uploads/` are guaranteed to be unlinked (deleted) in a `finally` block immediately after processing, ensuring no orphaned audio files consume disk space.

---

## 📌 Development Roadmap

- [x] **Step 1:** Project setup (Express ES modules, Vite + Tailwind client, health check).
- [x] **Step 2:** Backend audio transcription API (Multer, Groq `whisper-large-v3`, Mongoose schema, CRUD routes).
- [ ] **Step 3:** Frontend UI (Drag-and-drop audio uploader, transcription viewer, history sidebar, copy/export text).

