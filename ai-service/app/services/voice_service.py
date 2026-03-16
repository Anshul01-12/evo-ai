import base64
import os
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


async def transcribe_audio(file_path: str) -> str:
    if not WHISPER_AVAILABLE:
        raise RuntimeError("Whisper not installed")

    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Audio file not found: {file_path}")

    model = whisper.load_model("base")
    result = model.transcribe(file_path)
    return result.get("text", "").strip()


async def synthesize_speech(text: str, voice: str = "alloy") -> Tuple[bytes, str]:
    if COQUI_AVAILABLE:
        tts = TTS(model_name="tts_models/en/ljspeech/tacotron2-DDC")
        wav = tts.tts(text)
        # tts.tts returns numpy array; coqui has save_audio helper, but we can encode directly
        import soundfile as sf
        import io

        buffer = io.BytesIO()
        sf.write(buffer, wav, 22050, format="WAV")
        audio_bytes = buffer.getvalue()
        data = base64.b64encode(audio_bytes).decode("utf-8")
        return audio_bytes, data

    raise RuntimeError("No TTS backend available. Install coqui-tts + soundfile.")
