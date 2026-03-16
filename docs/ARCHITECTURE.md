# Evo AI Platform — System Architecture

## Overview

A modular, production-ready AI assistant platform built on MERN stack (React + Node/Express + MongoDB) with a Python AI microservice powered by Ollama, Qdrant vector DB, and Redis.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          CLIENTS                                │
│   Browser (React)    │   Mobile App   │   Phone (Twilio/VAPI)  │
└─────────┬────────────┴────────┬───────┴────────────┬────────────┘
          │                     │                    │
          ▼                     ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                     NGINX REVERSE PROXY                         │
│            (SSL termination, rate limiting, routing)            │
│                                                                 │
│    /              → React static build (:3000)                 │
│    /api/*         → Node.js Express server (:5000)             │
│    /ai/*          → Python AI microservice (:8000)             │
└─────────────────────────────────────────────────────────────────┘
          │                          │
    ┌─────┴─────┐             ┌──────┴──────┐
    ▼           ▼             ▼             ▼
┌────────┐ ┌────────────┐ ┌────────────┐ ┌────────────────┐
│ REACT  │ │  EXPRESS    │ │  PYTHON    │ │  EXTERNAL      │
│ CLIENT │ │  SERVER     │ │  AI SVC    │ │  SERVICES      │
│ :3000  │ │  :5000      │ │  :8000     │ │                │
│        │ │             │ │            │ │  Twilio        │
│ SPA    │ │ Auth        │ │ LangChain  │ │  Stable Diff.  │
│ Zustand│ │ CRUD        │ │ RAG        │ │  Whisper API   │
│ Tailw. │ │ File mgmt   │ │ Embeddings │ │                │
│        │ │ WebSocket   │ │ Streaming  │ │                │
└────┬───┘ └──────┬──────┘ └─────┬──────┘ └────────────────┘
     │            │              │
     │      ┌─────┴──────────────┤
     │      ▼                    ▼
     │ ┌──────────┐       ┌──────────┐
     │ │ MONGODB  │       │  OLLAMA  │
     │ │ :27017   │       │  :11434  │
     │ │          │       │          │
     │ │ Users    │       │ Llama3   │
     │ │ Chats    │       │ Mistral  │
     │ │ Messages │       │ LLaVA    │
     │ │ Docs     │       │ nomic    │
     │ └──────────┘       └──────────┘
     │      │
     │      ▼
     │ ┌──────────┐       ┌──────────┐
     │ │  REDIS   │       │  QDRANT  │
     │ │  :6379   │       │  :6333   │
     │ │          │       │          │
     │ │ Sessions │       │ Vectors  │
     │ │ Memory   │       │ Chunks   │
     │ │ PubSub   │       │ Search   │
     │ └──────────┘       └──────────┘
     │
     └──► All communication via REST + SSE + WebSocket
```

---

## Communication Flow: MERN Backend ↔ Python AI Service

```
┌──────────┐         ┌──────────────┐         ┌──────────────┐
│  React   │  HTTP   │   Express    │  HTTP    │   Python     │
│  Client  │────────►│   Server     │─────────►│   AI Service │
│          │  WS/SSE │   :5000      │  SSE     │   :8000      │
│          │◄────────│              │◄─────────│              │
└──────────┘         └──────┬───────┘         └──────┬───────┘
                            │                        │
                    ┌───────┘                        │
                    ▼                                ▼
              ┌──────────┐                    ┌──────────┐
              │ MongoDB  │                    │  Ollama  │
              │ Redis    │                    │  Qdrant  │
              └──────────┘                    └──────────┘

── Chat Request Flow ──────────────────────────────────────────

1. React → POST /api/chat/send         (user message)
2. Express validates auth, saves message to MongoDB
3. Express → POST /ai/chat/stream      (forwards to Python)
4. Python builds prompt (system + memory + RAG context)
5. Python → Ollama streaming completion
6. Python streams tokens back to Express via SSE
7. Express pipes SSE stream to React client
8. On stream end: Express saves assistant message to MongoDB

── RAG Document Flow ──────────────────────────────────────────

1. React → POST /api/documents/upload   (PDF file)
2. Express saves file to disk, creates DB record
3. Express → POST /ai/documents/ingest  (sends file path)
4. Python extracts text (PyMuPDF), chunks, embeds via Ollama
5. Python stores vectors in Qdrant, returns chunk count
6. Express updates document record with chunk_count

── Voice Flow ─────────────────────────────────────────────────

1. React captures audio via MediaRecorder API
2. React → POST /api/voice/transcribe   (audio blob)
3. Express → POST /ai/voice/stt         (forwards audio)
4. Python runs Whisper STT → returns text
5. Express runs chat flow (steps 2-8 above)
6. Express → POST /ai/voice/tts         (response text)
7. Python generates audio → returns audio buffer
8. Express streams audio back to React
```

---

## Module Responsibilities

| Service | Port | Responsibility |
|---------|------|----------------|
| React Client | 3000 | UI, state management, real-time display |
| Express Server | 5000 | Auth, CRUD, file management, WebSocket hub, proxies AI calls |
| Python AI Service | 8000 | LLM orchestration, RAG, embeddings, voice, image processing |
| MongoDB | 27017 | Users, conversations, messages, documents, settings |
| Redis | 6379 | Session cache, conversation memory, pub/sub for real-time |
| Qdrant | 6333 | Vector storage and similarity search |
| Ollama | 11434 | Local LLM inference (Llama3, Mistral, LLaVA, nomic-embed) |

---

## Scaling Strategy

- **Express**: Stateless, horizontally scaled behind load balancer; Redis for shared sessions
- **Python AI**: CPU/GPU workers scaled independently; Celery for async tasks (PDF ingestion, image gen)
- **MongoDB**: Replica set for HA; shard on user_id for large scale
- **Qdrant**: Built-in sharding and replication
- **Ollama**: Dedicated GPU nodes; multiple instances behind round-robin
