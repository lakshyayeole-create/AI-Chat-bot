# Storage Architecture & Asset Integration Documentation

This document describes the three-pillar storage architecture implemented for **Anantya 2026**.

---

## 1. Storage Responsibilities & Core Principles

The three storage layers are strictly separated:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. CLOUDINARY → STATIC WEBSITE ASSETS ONLY                                  │
│    • 3D Models (.glb, .gltf)                                                │
│    • Textures & Hero Backgrounds (.webp, .png, .jpg)                       │
│    • Event brand logos & iconography                                        │
│    • Event gallery photography                                              │
│    • Static background ambient audio (.mpeg)                                │
│    • NEVER holds TTS-generated audio                                        │
│    • NEVER holds MongoDB or user data                                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. BACKEND → DYNAMIC TTS GENERATED AUDIO ONLY                               │
│    • Audio generated on-demand via ElevenLabs / Fallback                    │
│    • Stored locally on disk at `backend/data/audio_cache/*.mp3`             │
│    • SHA-256 deterministic cache key based on text, voice, model & format   │
│    • Served directly via `POST /api/tts` with HTTP caching headers          │
│    • NEVER uploaded to Cloudinary                                           │
│    • NEVER listed in static `assets.json`                                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. MONGODB ATLAS → APPLICATION & USER DATA ONLY                             │
│    • User Information / Profiles                                            │
│    • Chatbot User Queries & Assistant Responses (`chat_messages`)           │
│    • Contact Form Queries & Messages (`contact_queries`)                    │
│    • Global Visitor Telemetry & Counter (`site_visitors`, `visitor_stats`)  │
│    • NEVER stores large static media binaries (.glb, images, audio)         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Environment Variables

Configured in `backend/.env` (protected by `.gitignore`):

```bash
# === Cloudinary Configuration (Static Website Assets Only) ===
CLOUDINARY_CLOUD_NAME=aomu9bzr
CLOUDINARY_API_KEY=123831983548826
CLOUDINARY_API_SECRET=osjyFtbnMCwBDXs1dwPk0c7yEQo

# === MongoDB Configuration (User Info, Chat Logs, Contact Form, Visitor Telemetry) ===
MONGODB_USERNAME=anantyadeployment_db_user
MONGODB_PASSWORD=ueDdsXvhmtRZIyMw
MONGODB_URI=mongodb+srv://anantyadeployment_db_user:ueDdsXvhmtRZIyMw@anantya.1cp5gus.mongodb.net
MONGODB_DB_NAME=anantya_db

# === ElevenLabs Text-to-Speech (TTS) Configuration ===
ELEVENLABS_API_KEY=sk_...
ELEVENLABS_VOICE_ID=pNInz6obpgDQGcFmaJgB
ELEVENLABS_MODEL_ID=eleven_turbo_v2_5
TTS_AUDIO_CACHE_DIR=data/audio_cache
TTS_CACHE_TTL_SECONDS=604800
```

> [!NOTE]
> The Cloudinary API Secret and MongoDB connection string are **never exposed to frontend code or client bundles**.

---

## 3. Static Asset Seed & Sync System

The seed script is **100% idempotent** and safe to run repeatedly:

### Command
```bash
# From backend directory:
python scripts/seed_assets.py

# Optional dry run:
python scripts/seed_assets.py --dry-run

# Optional force re-upload:
python scripts/seed_assets.py --force
```

### What It Uploads
* **3D Models**: `iron_man_detailed_web.glb`, `starlord.glb`, `gauntlet.glb`, `loki_main.glb`, `marvel_ant-man_helmet.glb`.
  * Uploaded with `resource_type="raw"` so binary vertex/animation buffers are not transcoded.
* **Textures & Visuals**: `iron_man_hud_bg.webp`, `star_lord_bg.webp`, `amber-crystal-surface.webp`, `contact_avengers_bg.webp`, etc.
* **Logos**: Event logos (`codigo.webp`, `byte.webp`, `Decentra-hack.webp`, etc.).
* **Gallery Photos**: High-resolution event photography.
* **Static Audio**: `background_audio.mpeg`.

### What It Does NOT Upload
* **No dynamic TTS audio**: Dynamic speech is generated on-demand and kept in `backend/data/audio_cache/`.
* **No database documents**: Chat logs and user queries remain strictly in MongoDB.

### Idempotency Behavior
1. **First Run**: Uploads all new assets, generates `backend/data/assets.json` and syncs `frontend/src/data/assets.json`.
2. **Second Run**: Computes SHA-256 of all local files; if hash and public ID match existing manifest entries, it prints `[SKIP]` and makes zero Cloudinary API calls.
3. **Modified Asset**: If a local file changes, its hash changes; only that specific asset is uploaded/updated.
4. **Deleted Local Asset**: Local file deletion does **not** delete remote Cloudinary assets.

---

## 4. Backend API Endpoints

| Method | Endpoint | Description | Storage Layer |
|---|---|---|---|
| `GET` | `/health` | Server, vector store, and MongoDB readiness | FastAPI / In-Memory |
| `GET` | `/api/assets` | Returns static Cloudinary asset manifest | JSON Manifest (`data/assets.json`) |
| `GET` | `/api/assets/models` | Returns 3D model URLs | JSON Manifest |
| `GET` | `/api/assets/images` | Returns image/texture URLs | JSON Manifest |
| `GET` | `/api/assets/audio` | Returns static background audio URLs | JSON Manifest |
| `POST` | `/api/contact` | Submits Contact form message | MongoDB (`contact_queries`) |
| `POST` | `/api/visitors/track` | Tracks visit, increments visitor count | MongoDB (`site_visitors`, `visitor_stats`) |
| `GET` | `/api/visitors/count` | Retrieves verified visitor count | MongoDB (`visitor_stats`) |
| `POST` | `/api/chat` | Chatbot query (Qdrant + Gemini + log) | MongoDB (`chat_messages`) |
| `GET` | `/api/chat/status/{id}` | Polls async chat job status | In-Memory Queue |
| `POST` | `/api/tts` | Generates or returns cached TTS audio | Backend Disk Cache (`data/audio_cache`) |
| `GET` | `/api/tts/status` | TTS operational readiness | In-Memory |

---

## 5. MongoDB Collections & Schemas

Database name: `anantya_db`

### 1. `chat_messages`
Stores every user question and assistant answer:
```json
{
  "_id": ObjectId("..."),
  "question": "What is Anantya 2026?",
  "answer": "Hello! I am Anantya's Jarvis...",
  "session_id": "anonymous",
  "intent": "general",
  "event_ids": [],
  "sources": [],
  "cached": false,
  "user_id": null,
  "created_at": ISODate("2026-10-02T18:49:28.000Z")
}
```
* Indexes: `created_at` (descending), `session_id` (ascending).

### 2. `contact_queries`
Stores messages submitted through the Contact page:
```json
{
  "_id": ObjectId("..."),
  "name": "Lakshya Yeole",
  "email": "lakshya@example.com",
  "subject": "Storage System Verification",
  "message": "Testing MongoDB contact form insertion and validation.",
  "reference_code": "AVN-COMM-2532",
  "created_at": ISODate("2026-10-02T18:49:24.000Z"),
  "status": "received"
}
```
* Indexes: `created_at` (descending), `email` (ascending).

### 3. `site_visitors`
Tracks distinct website visitors by client identifier:
```json
{
  "_id": ObjectId("..."),
  "visitor_id": "test_visitor_001_abc",
  "user_agent": "Mozilla/5.0 ...",
  "screen_resolution": "1920x1080",
  "created_at": ISODate("2026-10-02T18:49:25.000Z")
}
```
* Indexes: `visitor_id` (unique), `created_at` (descending).

### 4. `visitor_stats`
Stores the atomic global visitor counter document:
```json
{
  "_id": "global_visitor_counter",
  "total_count": 2,
  "initialized_at": true
}
```
* Incremented via atomic MongoDB `$inc` operations only on new visitors.

---

## 6. Frontend Integration

### Asset Resolution via `frontend/src/utils/assets.ts`
The frontend loads Cloudinary URLs directly:
```typescript
import { getModelUrl, getImageUrl, getAudioUrl } from '../utils/assets';

// 3D Models
const ironManModel = getModelUrl('/assets/iron_man_detailed_web.glb');
const gauntletModel = getModelUrl('/assets/gauntlet.glb');

// Images & Textures
const heroBg = getImageUrl('/assets/iron_man_hud_bg.webp');
const codigoLogo = getImageUrl('/logos/codigo.webp');

// Static Audio
const bgAudio = getAudioUrl('/background_audio.mpeg');
```

**Zero-Downtime Guarantee**: If the backend is restarting or offline, the helper automatically falls back to local paths without throwing or breaking 3D renders.

---

## 7. Running the Application

### 1. Start Backend
```bash
cd backend
uvicorn app.main:app --reload --port 8001
```

### 2. Start Frontend
```bash
cd frontend
npm run dev
```

### 3. Run Automated Tests
```bash
cd backend
pytest
```
* All 14 tests pass (TTS tests + storage endpoint tests).
