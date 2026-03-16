# Evo AI Assistant Platform

Evo is a multi-service AI assistant platform with:

- `client/`: React + TypeScript + Tailwind frontend
- `server/`: Express + MongoDB + Redis application backend
- `ai-service/`: FastAPI microservice for LLM, RAG, voice, image, and agent workflows
- `docker/`: local infrastructure compose file

## Current Status

Backend and AI-service foundations are in place for:

- chat persistence in MongoDB
- WebSocket/SSE-based chat streaming
- PDF ingestion and RAG with Qdrant
- Redis-backed memory
- Whisper/TTS voice processing
- Twilio phone agent backend
- image understanding with LLaVA
- image generation with Stable Diffusion
- LangGraph agent orchestration
- Langfuse tracing hooks in the Python service

The main remaining gap is the mounted React UI: the app shell currently exposes chat and document pages, but image generation, image understanding, phone controls, and settings are not all surfaced in the routed frontend yet.

## Architecture

### Frontend

- React
- TypeScript
- TailwindCSS
- Zustand
- Socket.IO client

### Backend

- Node.js
- Express.js
- MongoDB
- Redis
- Socket.IO

### AI Service

- FastAPI
- LangGraph
- LangChain + Ollama
- Qdrant
- Langfuse
- Whisper
- Stable Diffusion
- LLaVA

## Feature Review

### Implemented in services

1. Chat API with stored conversations
2. Streaming response pipeline
3. PDF upload and vector ingestion
4. RAG QA endpoint
5. Redis memory storage and summarization hooks
6. Voice transcription + TTS pipeline
7. Phone call AI agent backend with Twilio media stream support
8. Image analysis endpoint
9. Image generation endpoint
10. LangGraph workflow in `ai-service/app/services/agent/graph.py`
11. Langfuse tracing helpers in `ai-service/app/core/langfuse_client.py`
12. Express to Python microservice integration

### Partially implemented

1. Frontend multimodal UX:
   the rich `ChatGPTUI.tsx` exists, but the mounted app uses `ChatArea.tsx` and `ChatInput.tsx`, so some image-generation/image-analysis affordances are not live.
2. Settings page:
   there is a settings button in the sidebar, but no routed settings screen.
3. Agent route usage:
   the backend route exists, but it is not surfaced in the current client UI.
4. Voice UI:
   microphone capture exists, but there is no polished real-time conversational voice interface in the mounted frontend.
5. Phone AI frontend/admin:
   backend is present, but there is no operator UI for phone sessions.

## Folder Structure

```text
c:\AI
├─ ai-service
│  ├─ app
│  │  ├─ api
│  │  │  ├─ agent.py
│  │  │  ├─ chat.py
│  │  │  ├─ documents.py
│  │  │  ├─ image.py
│  │  │  ├─ vision.py
│  │  │  └─ voice.py
│  │  ├─ core
│  │  │  ├─ config.py
│  │  │  └─ langfuse_client.py
│  │  └─ services
│  │     ├─ agent
│  │     │  └─ graph.py
│  │     ├─ image
│  │     │  └─ image_service.py
│  │     ├─ llm
│  │     │  └─ chat_service.py
│  │     ├─ memory
│  │     │  └─ memory_service.py
│  │     ├─ rag
│  │     │  └─ document_service.py
│  │     ├─ voice_service.py
│  │     ├─ vision_service.py
│  │     └─ agent_service.py
│  ├─ .env.example
│  └─ pyproject.toml
├─ client
│  ├─ .env.example
│  ├─ package.json
│  └─ src
│     ├─ components
│     ├─ hooks
│     ├─ services
│     ├─ stores
│     └─ types
├─ server
│  ├─ .env.example
│  ├─ package.json
│  └─ src
│     ├─ config
│     ├─ controllers
│     ├─ middleware
│     ├─ models
│     ├─ routes
│     └─ services
├─ docker
│  └─ docker-compose.yml
└─ README.md
```

## Environment Variables

### `server/.env`

```ini
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://evo_user:evo_password@localhost:27017/evo_platform?authSource=admin
REDIS_URL=redis://localhost:6379
JWT_SECRET=change-this-to-a-long-random-string
JWT_EXPIRES_IN=7d
AI_SERVICE_URL=http://localhost:8000
SERVER_URL=http://localhost:5000
UPLOAD_DIR=./uploads
MAX_FILE_SIZE_MB=50
CLIENT_URL=http://localhost:5173

TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
TWILIO_WEBHOOK_SECRET=
PUBLIC_WS_BASE_URL=ws://localhost:5000
PHONE_AGENT_MODEL=llama3
PHONE_AGENT_SYSTEM_PROMPT=You are a calm, concise phone support agent. Keep answers brief and easy to hear over a call.
PHONE_SILENCE_THRESHOLD=350
PHONE_MAX_SILENCE_MS=1200
PHONE_MIN_UTTERANCE_MS=800
```

### `client/.env`

```ini
VITE_API_URL=http://localhost:5000/api
VITE_API_WS_URL=http://localhost:5000
VITE_APP_NAME=Evo
```

### `ai-service/.env`

```ini
PORT=8000
DEBUG=true
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_CHAT_MODEL=llama3
OLLAMA_EMBED_MODEL=nomic-embed-text
OLLAMA_VISION_MODEL=llava
QDRANT_HOST=localhost
QDRANT_PORT=6333
REDIS_URL=redis://localhost:6379/0

LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
LANGFUSE_HOST=https://cloud.langfuse.com
LANGFUSE_ENABLED=true

AGENT_DEFAULT_MODEL=llama3
AGENT_ENABLE_RAG=true
AGENT_ENABLE_TOOLS=true
AGENT_MAX_HISTORY=12
AGENT_REASONING_TEMPERATURE=0.2
```

## Local Run Commands

### 1. Infrastructure

Run MongoDB, Redis, and Qdrant locally yourself, or use Docker:

```bash
cd c:\AI\docker
docker compose up -d mongodb redis qdrant
```

Ollama should also be running locally:

```bash
ollama serve
ollama pull llama3
ollama pull mistral
ollama pull llava
ollama pull nomic-embed-text
```

### 2. Python AI service

```bash
cd c:\AI\ai-service
python -m venv .venv
.venv\Scripts\activate
python -m pip install --upgrade pip
pip install -e .
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Express backend

```bash
cd c:\AI\server
npm install
npm run dev
```

### 4. React frontend

```bash
cd c:\AI\client
npm install
npm run dev
```

## Full Docker Run

If you want the containers too:

```bash
cd c:\AI\docker
docker compose up --build
```

Note: Stable Diffusion and Ollama vision/chat models may require GPU support and additional local model downloads.

## Important Endpoints

### Express backend

- `POST /api/chat`
- `GET /api/chat/history`
- `POST /api/chat/upload`
- `POST /api/chat/analyze-image`
- `POST /api/chat/generate-image`
- `POST /api/documents/upload`
- `POST /api/documents/qa`
- `POST /api/voice/process`
- `POST /api/call/webhook`
- `POST /api/agent/run`

### Python AI service

- `POST /chat/stream`
- `POST /chat/title`
- `POST /chat/summarize`
- `POST /documents/ingest`
- `POST /documents/qa`
- `POST /voice/transcribe`
- `POST /voice/tts`
- `POST /voice/process-upload`
- `POST /image/analyze`
- `POST /image/generate`
- `POST /agent/run`

## LangGraph Workflow

The main agent graph lives in:

- `ai-service/app/services/agent/graph.py`

Current node order:

1. `load_memory`
2. `check_rag`
3. `reasoning`
4. `tool_usage`
5. `response`
6. `persist_memory`

## Langfuse Monitoring

Langfuse hooks are initialized in:

- `ai-service/app/core/langfuse_client.py`

Tracing currently covers:

- chat LLM calls
- agent reasoning
- final response generation
- RAG retrieval
- memory load/persist
- image analysis
- image generation

## Known Gaps Before Calling It “Fully Functional”

1. The mounted React UI does not yet expose every backend capability.
2. There is no real settings page route.
3. Authentication and onboarding flows need product polish and end-to-end verification.
4. Some README-era assumptions in older files were inconsistent and have been corrected, but the repo still needs full dependency installation and runtime validation.
5. Phone AI depends on a public Twilio-accessible URL and external credentials.

## Recommended Next Steps

1. Mount a single unified chat UI that combines `ChatArea` behavior with multimodal upload/image generation controls.
2. Add a real settings route and document manager navigation.
3. Run end-to-end smoke tests across chat, voice, RAG, image analysis, and generation.
4. Add CI checks for TypeScript build, Python lint/syntax, and API contract tests.
