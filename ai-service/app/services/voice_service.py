import base64
import io
import os
import re
from typing import Tuple

from app.core.config import get_settings

settings = get_settings()

# Whisper-based transcription (requires openai-whisper optional dependency)
try:
    import whisper
    WHISPER_AVAILABLE = True
except ImportError:
    WHISPER_AVAILABLE = False

# Coqui TTS fallback
try:
    from TTS.api import TTS
    COQUI_AVAILABLE = True
except ImportError:
    COQUI_AVAILABLE = False

# gTTS for Hindi (and other languages)
try:
    from gtts import gTTS
    GTTS_AVAILABLE = True
except ImportError:
    GTTS_AVAILABLE = False

# Regex to detect Hindi (Devanagari script)
_HINDI_PATTERN = re.compile(r'[\u0900-\u097F]')


def _contains_hindi(text: str) -> bool:
    """Return True if text contains Devanagari characters."""
    return bool(_HINDI_PATTERN.search(text))


async def transcribe_audio(file_path: str) -> str:
    if not WHISPER_AVAILABLE:
        raise RuntimeError("Whisper not installed")

    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Audio file not found: {file_path}")

    model = whisper.load_model("base")
    result = model.transcribe(file_path)
    return result.get("text", "").strip()


async def synthesize_speech(text: str, voice: str = "alloy") -> Tuple[bytes, str]:
    # Use gTTS for Hindi text — much better Hindi pronunciation
    if _contains_hindi(text) and GTTS_AVAILABLE:
        tts = gTTS(text=text, lang="hi")
        buffer = io.BytesIO()
        tts.write_to_fp(buffer)
        audio_bytes = buffer.getvalue()
        data = base64.b64encode(audio_bytes).decode("utf-8")
        return audio_bytes, data

    # English — use Coqui TTS if available
    if COQUI_AVAILABLE:
        tts = TTS(model_name="tts_models/en/ljspeech/tacotron2-DDC")
        wav = tts.tts(text)
        import soundfile as sf

        buffer = io.BytesIO()
        sf.write(buffer, wav, 22050, format="WAV")
        audio_bytes = buffer.getvalue()
        data = base64.b64encode(audio_bytes).decode("utf-8")
        return audio_bytes, data

    # Fallback: use gTTS for English too if Coqui is not installed
    if GTTS_AVAILABLE:
        tts = gTTS(text=text, lang="en")
        buffer = io.BytesIO()
        tts.write_to_fp(buffer)
        audio_bytes = buffer.getvalue()
        data = base64.b64encode(audio_bytes).decode("utf-8")
        return audio_bytes, data

    raise RuntimeError("No TTS backend available. Install coqui-tts or gTTS.")
