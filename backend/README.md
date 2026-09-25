# Anantya Chatbot — Backend

Event information chatbot for Anantya '26. Uses RAG (Retrieval-Augmented Generation) with FAISS + sentence-transformers for retrieval and Groq (Llama 3.3 70B) for answer generation.

## Quick Start

### 1. Install dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure environment

```bash
# Copy the example and fill in your values
cp .env.example .env
```

Edit `.env` and set at minimum:
- `GROQ_API_KEY` — your Groq API key

### 3. Add event files

Place `.txt` event files in the `event_info/` directory (project root):

```
event_info/
    event_001_she_solves_3_0.txt
    event_002.txt
    ...
```

### 4. Run ingestion

```bash
cd backend
python scripts/ingest.py
```

This will load all event files, chunk them, generate embeddings, and build the FAISS index.

### 5. Start the server

```bash
cd backend
uvicorn app.main:app --reload
```

The server starts at `http://localhost:8000`.

### 6. Test it

- **Health**: `GET http://localhost:8000/health`
- **Chat**: `POST http://localhost:8000/api/chat`
- **Docs**: `http://localhost:8000/docs`

Example chat request:

```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is She Solves 3.0?"}'
```

## Running Tests

```bash
cd backend
pytest tests/ -v
```

## Project Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI app, CORS, health
│   ├── api/chat.py           # POST /api/chat endpoint
│   ├── models/chat.py        # Pydantic request/response models
│   ├── rag/
│   │   ├── loader.py         # Load .txt files from event_info/
│   │   ├── chunker.py        # Section-aware chunking
│   │   ├── embeddings.py     # sentence-transformers wrapper
│   │   ├── vector_store.py   # FAISS build/save/load/search
│   │   ├── retriever.py      # Semantic retrieval + threshold
│   │   └── pipeline.py       # Full RAG orchestrator
│   ├── llm/client.py         # Groq API abstraction
│   ├── core/
│   │   ├── config.py         # Pydantic Settings
│   │   └── logging_config.py # Structured logging
│   └── prompts/
│       └── system_prompt.txt  # LLM grounding prompt
├── scripts/ingest.py          # Document ingestion script
├── tests/                     # Automated tests
├── vector_store/              # Generated FAISS index + metadata
├── .env.example               # Environment template
└── requirements.txt           # Python dependencies
```

## Tech Stack

| Component | Technology |
|---|---|
| Framework | FastAPI |
| LLM | Groq (Llama 3.3 70B) |
| Embeddings | sentence-transformers (all-MiniLM-L6-v2) |
| Vector DB | FAISS |
| Validation | Pydantic v2 |

## Adding New Events

1. Drop the new `.txt` file into `event_info/`
2. Run: `python scripts/ingest.py`
3. Restart the server

No code changes needed.
