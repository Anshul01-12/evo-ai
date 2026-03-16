import base64
import io
import os
import re
from typing import Tuple

import httpx

from app.core.config import get_settings

settings = get_settings()

# Local Whisper (optional)
try:
    import whisper
    WHISPER_AVAILABLE = True
except ImportError:
    WHISPER_AVAILABLE = False

# Coqui TTS (optional)
try:
    from TTS.api import TTS
    COQUI_AVAILABLE = True
except ImportError:
    COQUI_AVAILABLE = False

# gTTS fallback
try:
    from gtts import gTTS
    GTTS_AVAILABLE = True
except ImportError:
    GTTS_AVAILABLE = False

_HINDI_PATTERN = re.compile(r'[\u0900-\u097F]')


def _contains_hindi(text: str) -> bool:
    return bool(_HINDI_PATTERN.search(text))


async def transcribe_audio(file_path: str) -> str:
    """Transcribe audio — tries Groq Whisper API first, falls back to local Whisper."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Audio file not found: {file_path}")

    # Method 1: Groq Whisper API (fast, free)
    groq_key = settings.GROQ_API_KEY
    if groq_key:
        try:
            return await _transcribe_with_groq(file_path, groq_key)
        except Exception as e:
            print(f"[Voice] Groq transcription failed: {e}, trying local Whisper...")

    # Method 2: Local Whisper
    if WHISPER_AVAILABLE:
        model = whisper.load_model("base")
        result = model.transcribe(file_path)
        return result.get("text", "").strip()

    raise RuntimeError(
        "No transcription backend available. Set GROQ_API_KEY for cloud transcription "
        "or install openai-whisper for local transcription."
    )


async def _transcribe_with_groq(file_path: str, api_key: str) -> str:
    """Transcribe using Groq's Whisper API (free, fast)."""
    url = "https://api.groq.com/openai/v1/audio/transcriptions"

    with open(file_path, "rb") as f:
        file_data = f.read()

    # Determine file extension for mime type
    ext = os.path.splitext(file_path)[1].lower()
    mime_types = {
        ".wav": "audio/wav",
        ".mp3": "audio/mpeg",
        ".webm": "audio/webm",
        ".m4a": "audio/mp4",
        ".ogg": "audio/ogg",
    }
    mime = mime_types.get(ext, "audio/wav")
    filename = os.path.basename(file_path)

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            url,
            headers={"Authorization": f"Bearer {api_key}"},
            files={"file": (filename, file_data, mime)},
            data={"model": "whisper-large-v3", "language": "en"},
        )

        if response.status_code != 200:
            raise RuntimeError(f"Groq Whisper API error {response.status_code}: {response.text[:200]}")

        data = response.json()
        return data.get("text", "").strip()


async def synthesize_speech(text: str, voice: str = "alloy") -> Tuple[bytes, str]:
    """Synthesize speech — tries Groq TTS, then gTTS, then Coqui."""
    # Use gTTS for Hindi text
    if _contains_hindi(text) and GTTS_AVAILABLE:
        return _tts_with_gtts(text, "hi")

    # Try Groq TTS API first (if available)
    groq_key = settings.GROQ_API_KEY
    if groq_key:
        try:
            return await _tts_with_groq(text, voice, groq_key)
        except Exception as e:
            print(f"[Voice] Groq TTS failed: {e}, trying fallback...")

    # Coqui TTS
    if COQUI_AVAILABLE:
        tts = TTS(model_name="tts_models/en/ljspeech/tacotron2-DDC")
        wav = tts.tts(text)
        import soundfile as sf
        buffer = io.BytesIO()
        sf.write(buffer, wav, 22050, format="WAV")
        audio_bytes = buffer.getvalue()
        return audio_bytes, base64.b64encode(audio_bytes).decode("utf-8")

    # gTTS fallback for English
    if GTTS_AVAILABLE:
        return _tts_with_gtts(text, "en")

    raise RuntimeError("No TTS backend available. Set GROQ_API_KEY or install gTTS.")


async def _tts_with_groq(text: str, voice: str, api_key: str) -> Tuple[bytes, str]:
    """Text-to-speech using Groq's TTS API."""
    url = "https://api.groq.com/openai/v1/audio/speech"

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "playai-tts",
                "input": text,
                "voice": "Fritz-PlayAI",
                "response_format": "wav",
            },
        )

        if response.status_code != 200:
            raise RuntimeError(f"Groq TTS error {response.status_code}: {response.text[:200]}")

        audio_bytes = response.content
        return audio_bytes, base64.b64encode(audio_bytes).decode("utf-8")


def _tts_with_gtts(text: str, lang: str) -> Tuple[bytes, str]:
    """Text-to-speech using gTTS (Google Translate TTS)."""
    tts = gTTS(text=text, lang=lang)
    buffer = io.BytesIO()
    tts.write_to_fp(buffer)
    audio_bytes = buffer.getvalue()
    return audio_bytes, base64.b64encode(audio_bytes).decode("utf-8")
