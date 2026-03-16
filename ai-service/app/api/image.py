import json
import base64

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from app.services.image.image_service import analyze_image, generate_image

router = APIRouter(prefix="/image", tags=["image"])


# ────────────────────────────────────────────────────
# Image Analysis (LLaVA via Ollama)
# ────────────────────────────────────────────────────


class AnalyzeRequest(BaseModel):
    image_base64: str
    prompt: str = "Describe this image in detail."
    model: str = "llava"


@router.post("/analyze")
async def analyze(request: AnalyzeRequest):
    """Analyze an image using vision AI models (Gemini, Groq, or LLaVA)."""
    if not request.image_base64:
        raise HTTPException(status_code=400, detail="image_base64 is required")

    try:
        result = await analyze_image(
            image_b64=request.image_base64,
            prompt=request.prompt,
            model=request.model,
        )
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"description": f"Error: {str(e)}", "answer": f"Error: {str(e)}", "model": request.model, "prompt": request.prompt}


@router.post("/analyze/stream")
async def analyze_stream(request: AnalyzeRequest):
    """Stream image analysis via SSE."""
    if not request.image_base64:
        raise HTTPException(status_code=400, detail="image_base64 is required")

    from app.services.image.image_service import stream_analyze_image

    async def event_generator():
        async for token in stream_analyze_image(
            image_b64=request.image_base64,
            prompt=request.prompt,
            model=request.model,
        ):
            yield {"event": "token", "data": json.dumps({"token": token})}
        yield {"event": "done", "data": json.dumps({"status": "complete"})}

    return EventSourceResponse(event_generator())


@router.post("/analyze/upload")
async def analyze_upload(
    file: UploadFile = File(...),
    prompt: str = Form("Describe this image in detail."),
    model: str = Form("llava"),
):
    """Upload an image file for analysis."""
    content = await file.read()
    image_b64 = base64.b64encode(content).decode("utf-8")

    result = await analyze_image(image_b64=image_b64, prompt=prompt, model=model)
    return result


# ────────────────────────────────────────────────────
# Image Generation (Stable Diffusion)
# ────────────────────────────────────────────────────


class GenerateRequest(BaseModel):
    prompt: str
    negative_prompt: str = ""
    width: int = 512
    height: int = 512
    steps: int = 30
    guidance_scale: float = 7.5


@router.post("/generate")
async def generate(request: GenerateRequest):
    """Generate an image from a text prompt using Stable Diffusion."""
    if not request.prompt.strip():
        raise HTTPException(status_code=400, detail="prompt is required")

    result = await generate_image(
        prompt=request.prompt,
        negative_prompt=request.negative_prompt,
        width=request.width,
        height=request.height,
        steps=request.steps,
        guidance_scale=request.guidance_scale,
    )
    return result
