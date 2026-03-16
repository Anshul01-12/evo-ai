import base64
import os
import tempfile

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.services.llm.chat_service import EVO_SYSTEM_PROMPT, stream_chat
from app.services.rag.document_service import retrieve_context
from app.services.voice_service import synthesize_speech, transcribe_audio

router = APIRouter(prefix="/voice", tags=["voice"])


class TranscribeRequest(BaseModel):
    file_path: str


class TTSRequest(BaseModel):
    text: str
    voice: str | None = None


class VoiceChatRequest(BaseModel):
    file_path: str
    model: str = "llama3"
    session_id: str | None = None
    use_rag: bool = False
    collection_name: str | None = None


class TranscribeURLRequest(BaseModel):
    audio_url: str


async def _run_voice_pipeline(
    *,
    file_path: str,
    model: str,
    session_id: str | None,
    use_rag: bool,
    collection_name: str | None,
):
    transcription = await transcribe_audio(file_path)

    messages = [{"role": "user", "content": transcription}]
    system_prompt = EVO_SYSTEM_PROMPT

    if use_rag and collection_name:
        context_chunks = await retrieve_context(transcription, collection_name)
        if context_chunks:
            context_text = "\n\n".join(
                f"[{chunk['source']}#{chunk['chunk_index']}] {chunk['text']}"
                for chunk in context_chunks
            )
            system_prompt += (
                "\n\nUse the following context in your answer."
                f"\n\nContext:\n{context_text}"
            )

    answer = ""
    async for token in stream_chat(
        messages,
        model,
        system_prompt,
        user_id="voice-api",
        session_id=session_id,
    ):
        answer += token

    tts_data = None
    try:
        _, tts_data = await synthesize_speech(answer)
    except Exception:
        tts_data = None

    return {
        "sessionId": session_id,
        "transcription": transcription,
        "answer": answer.strip(),
        "audio_base64": tts_data,
    }


@router.post("/transcribe")
async def transcribe(request: TranscribeRequest):
    if not request.file_path:
        raise HTTPException(status_code=400, detail="file_path is required")
    try:
        text = await transcribe_audio(request.file_path)
        return {"text": text}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/tts")
async def tts(request: TTSRequest):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="text is required")
    try:
        _, audio_b64 = await synthesize_speech(request.text, request.voice or "alloy")
        return {"audio_base64": audio_b64}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/transcribe-url")
async def transcribe_url(request: TranscribeURLRequest):
    if not request.audio_url:
        raise HTTPException(status_code=400, detail="audio_url is required")

    import httpx

    tmp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
    tmp_file_path = tmp_file.name
    tmp_file.close()

    async with httpx.AsyncClient() as client:
        response = await client.get(request.audio_url)
        if response.status_code != 200:
            os.unlink(tmp_file_path)
            raise HTTPException(status_code=502, detail="Failed to download audio URL")

        with open(tmp_file_path, "wb") as file_handle:
            file_handle.write(response.content)

    try:
        transcription = await transcribe_audio(tmp_file_path)
        return {"text": transcription}
    finally:
        if os.path.exists(tmp_file_path):
            os.unlink(tmp_file_path)


@router.post("/process")
async def process_voice(request: VoiceChatRequest):
    if not request.file_path:
        raise HTTPException(status_code=400, detail="file_path is required")

    try:
        return await _run_voice_pipeline(
            file_path=request.file_path,
            model=request.model,
            session_id=request.session_id,
            use_rag=request.use_rag,
            collection_name=request.collection_name,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Voice processing failed: {exc}")


@router.post("/process-upload")
async def process_voice_upload(
    file: UploadFile = File(...),
    model: str = Form("llama3"),
    session_id: str | None = Form(None),
    use_rag: bool = Form(False),
    collection_name: str | None = Form(None),
):
    suffix = os.path.splitext(file.filename or "audio.webm")[1] or ".webm"
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)

    try:
        temp_file.write(await file.read())
        temp_file.flush()
        temp_file.close()

        return await _run_voice_pipeline(
            file_path=temp_file.name,
            model=model,
            session_id=session_id,
            use_rag=use_rag,
            collection_name=collection_name,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Voice upload processing failed: {exc}")
    finally:
        if os.path.exists(temp_file.name):
            os.unlink(temp_file.name)
