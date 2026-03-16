from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.api.chat import router as chat_router
from app.api.documents import router as documents_router
from app.api.voice import router as voice_router
from app.api.image import router as image_router
from app.api.agent import router as agent_router

settings = get_settings()

app = FastAPI(title="Evo AI Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router)
app.include_router(documents_router)
app.include_router(voice_router)
app.include_router(image_router)
app.include_router(agent_router)


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "Evo AI Service"}
