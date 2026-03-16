from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    PORT: int = 8000
    DEBUG: bool = False

    # Ollama
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_CHAT_MODEL: str = "llama3"
    OLLAMA_EMBED_MODEL: str = "nomic-embed-text"
    OLLAMA_VISION_MODEL: str = "llava"

    # Qdrant
    QDRANT_HOST: str = "localhost"
    QDRANT_PORT: int = 6333

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Langfuse (optional)
    LANGFUSE_PUBLIC_KEY: str = ""
    LANGFUSE_SECRET_KEY: str = ""
    LANGFUSE_HOST: str = "https://cloud.langfuse.com"
    LANGFUSE_ENABLED: bool = True

    # Groq
    GROQ_API_KEY: str = ""

    # Google Gemini
    GOOGLE_API_KEY: str = ""

    # Agent workflow
    AGENT_DEFAULT_MODEL: str = "llama3"
    AGENT_ENABLE_RAG: bool = True
    AGENT_ENABLE_TOOLS: bool = True
    AGENT_MAX_HISTORY: int = 12
    AGENT_REASONING_TEMPERATURE: float = 0.2

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
