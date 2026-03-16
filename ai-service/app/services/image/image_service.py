import base64
import io
from collections.abc import AsyncIterator

import httpx
from PIL import Image

from app.core.config import get_settings
from app.core.langfuse_client import observe_operation

settings = get_settings()

GEMINI_VISION_MODELS = {
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-pro",
}

GROQ_VISION_MODELS = {
    "groq-llama3-8b",
    "groq-llama3-70b",
    "groq-mixtral",
    "meta-llama/llama-4-scout-17b-16e-instruct",
}


# ────────────────────────────────────────────────────
# Image Analysis
# ────────────────────────────────────────────────────


async def analyze_image(image_b64: str, prompt: str, model: str = "llava") -> dict:
    """Analyze image — routes to Groq, Gemini, or Ollama based on model."""
    # Default to Groq vision for any groq model or generic models without vision
    if model in GROQ_VISION_MODELS or model.startswith("groq"):
        return await _analyze_with_groq(image_b64, prompt)
    if model in GEMINI_VISION_MODELS or model.startswith("gemini"):
        try:
            return await _analyze_with_gemini(image_b64, prompt, model)
        except Exception as e:
            # Fallback to Groq if Gemini fails (rate limit etc)
            print(f"[Vision] Gemini failed ({e}), falling back to Groq vision")
            return await _analyze_with_groq(image_b64, prompt)
    # For unknown models, try Groq vision first (free), then Ollama
    try:
        return await _analyze_with_groq(image_b64, prompt)
    except Exception:
        return await _analyze_with_ollama(image_b64, prompt, model)


async def _analyze_with_groq(image_b64: str, prompt: str) -> dict:
    """Use Groq's Llama 3.2 Vision model for image analysis (free)."""
    api_key = settings.GROQ_API_KEY
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not set")

    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": "meta-llama/llama-4-scout-17b-16e-instruct",
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{image_b64}",
                        },
                    },
                ],
            }
        ],
        "max_tokens": 2048,
        "temperature": 0.4,
    }

    with observe_operation(
        name="groq-vision-analyze",
        input_payload={"prompt": prompt, "model": "meta-llama/llama-4-scout-17b-16e-instruct"},
    ):
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(url, json=payload, headers=headers)
            if response.status_code != 200:
                error_detail = response.text
                print(f"[Groq Vision] Error {response.status_code}: {error_detail}")
                raise RuntimeError(f"Groq vision failed: {error_detail}")
            data = response.json()

    text = ""
    try:
        text = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError):
        text = str(data)

    return {
        "description": text,
        "answer": text,
        "model": "meta-llama/llama-4-scout-17b-16e-instruct",
        "prompt": prompt,
    }


async def _analyze_with_gemini(image_b64: str, prompt: str, model: str) -> dict:
    """Use Google Gemini API for vision analysis with retry on rate limit."""
    import asyncio

    api_key = settings.GOOGLE_API_KEY
    if not api_key:
        raise RuntimeError("GOOGLE_API_KEY is not set")

    model_map = {
        "gemini-2.0-flash": "gemini-2.0-flash",
        "gemini-2.0-flash-lite": "gemini-2.0-flash-lite",
        "gemini-1.5-pro": "gemini-1.5-pro",
    }
    api_model = model_map.get(model, model)

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{api_model}:generateContent?key={api_key}"

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {
                        "inline_data": {
                            "mime_type": "image/jpeg",
                            "data": image_b64,
                        }
                    },
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.4,
            "maxOutputTokens": 2048,
        },
    }

    max_retries = 3
    last_error = None

    with observe_operation(
        name="gemini-vision-analyze",
        input_payload={"prompt": prompt, "model": api_model},
    ):
        async with httpx.AsyncClient(timeout=60.0) as client:
            for attempt in range(max_retries):
                response = await client.post(url, json=payload)
                if response.status_code == 429:
                    wait = (attempt + 1) * 5  # 5s, 10s, 15s
                    print(f"[Gemini] Rate limited, retrying in {wait}s (attempt {attempt + 1}/{max_retries})")
                    last_error = f"Rate limited (429). Retried {attempt + 1} times."
                    await asyncio.sleep(wait)
                    continue
                response.raise_for_status()
                data = response.json()
                break
            else:
                raise RuntimeError(f"Gemini API rate limited after {max_retries} retries. Please wait a minute and try again.")

    # Extract text from Gemini response
    text = ""
    try:
        candidates = data.get("candidates", [])
        if candidates:
            parts = candidates[0].get("content", {}).get("parts", [])
            text = "".join(p.get("text", "") for p in parts)
    except (KeyError, IndexError):
        text = str(data)

    return {
        "description": text,
        "answer": text,
        "model": api_model,
        "prompt": prompt,
    }


async def _analyze_with_ollama(image_b64: str, prompt: str, model: str) -> dict:
    """Send an image to LLaVA via Ollama for analysis."""
    with observe_operation(
        name="vision-analyze-image",
        input_payload={"prompt": prompt, "model": model or settings.OLLAMA_VISION_MODEL},
    ):
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{settings.OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": model or settings.OLLAMA_VISION_MODEL,
                    "prompt": prompt,
                    "images": [image_b64],
                    "stream": False,
                },
            )
            response.raise_for_status()
            data = response.json()

    return {
        "description": data.get("response", ""),
        "model": model,
        "prompt": prompt,
    }


async def stream_analyze_image(
    image_b64: str, prompt: str, model: str = "llava"
) -> AsyncIterator[str]:
    """Stream image analysis tokens from LLaVA via Ollama."""
    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream(
            "POST",
            f"{settings.OLLAMA_BASE_URL}/api/generate",
            json={
                "model": model or settings.OLLAMA_VISION_MODEL,
                "prompt": prompt,
                "images": [image_b64],
                "stream": True,
            },
        ) as response:
            response.raise_for_status()
            import json

            async for line in response.aiter_lines():
                if line.strip():
                    try:
                        chunk = json.loads(line)
                        if chunk.get("response"):
                            yield chunk["response"]
                    except Exception:
                        pass


# ────────────────────────────────────────────────────
# Image Generation via Stable Diffusion (diffusers)
# ────────────────────────────────────────────────────

# Lazy-loaded pipeline to avoid GPU memory on startup
_sd_pipeline = None


def _get_sd_pipeline():
    global _sd_pipeline
    if _sd_pipeline is None:
        try:
            from diffusers import StableDiffusionPipeline
            import torch

            device = "cuda" if torch.cuda.is_available() else "cpu"
            dtype = torch.float16 if device == "cuda" else torch.float32

            _sd_pipeline = StableDiffusionPipeline.from_pretrained(
                "runwayml/stable-diffusion-v1-5",
                torch_dtype=dtype,
            ).to(device)

            # Enable memory optimizations
            if device == "cuda":
                _sd_pipeline.enable_attention_slicing()

        except ImportError:
            raise RuntimeError(
                "Stable Diffusion not available. Install: diffusers, transformers, torch"
            )
    return _sd_pipeline


async def generate_image(
    prompt: str,
    negative_prompt: str = "",
    width: int = 512,
    height: int = 512,
    steps: int = 30,
    guidance_scale: float = 7.5,
) -> dict:
    """Generate an image from a text prompt and return as base64."""
    import asyncio

    pipeline = _get_sd_pipeline()

    # Run in executor to not block the event loop
    def _generate():
        result = pipeline(
            prompt=prompt,
            negative_prompt=negative_prompt or None,
            width=width,
            height=height,
            num_inference_steps=steps,
            guidance_scale=guidance_scale,
        )
        return result.images[0]

    with observe_operation(
        name="stable-diffusion-generate",
        input_payload={
            "prompt": prompt,
            "width": width,
            "height": height,
            "steps": steps,
            "guidance_scale": guidance_scale,
        },
    ):
        loop = asyncio.get_event_loop()
        image = await loop.run_in_executor(None, _generate)

    # Convert to base64 PNG
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    image_b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

    return {
        "image_base64": image_b64,
        "prompt": prompt,
        "width": width,
        "height": height,
        "steps": steps,
    }
