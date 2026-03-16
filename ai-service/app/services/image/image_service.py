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
# Image Generation (multiple providers with fallback)
# ────────────────────────────────────────────────────


async def generate_image(
    prompt: str,
    negative_prompt: str = "",
    width: int = 512,
    height: int = 512,
    steps: int = 30,
    guidance_scale: float = 7.5,
) -> dict:
    """Generate an image — tries Gemini Imagen, then Pollinations.ai as fallback."""
    errors: list[str] = []

    providers = [
        ("Pollinations", lambda: _generate_with_pollinations(prompt, width, height, steps)),
        ("StableHorde", lambda: _generate_with_stable_horde(prompt, width, height, steps)),
    ]

    for name, fn in providers:
        try:
            result = await fn()
            if result:
                print(f"[ImageGen] {name} succeeded")
                return result
        except Exception as e:
            errors.append(f"{name}: {e}")
            print(f"[ImageGen] {name} failed: {e}")

    raise RuntimeError(f"Image generation failed. Tried: {'; '.join(errors)}")


async def _generate_with_pollinations(
    prompt: str, width: int, height: int, steps: int
) -> dict | None:
    """Generate image using Pollinations.ai free API."""
    import random
    from urllib.parse import quote

    encoded_prompt = quote(prompt)

    async with httpx.AsyncClient(timeout=120.0, follow_redirects=True) as client:
        last_error = None
        for attempt in range(3):
            seed = random.randint(1, 999999)
            url = (
                f"https://image.pollinations.ai/prompt/{encoded_prompt}"
                f"?width={width}&height={height}&seed={seed}&model=flux&nologo=true"
            )
            try:
                response = await client.get(url)
                if response.status_code == 200 and len(response.content) > 1000:
                    image_bytes = response.content
                    image_b64 = base64.b64encode(image_bytes).decode("utf-8")
                    return {
                        "image_base64": image_b64,
                        "prompt": prompt,
                        "width": width,
                        "height": height,
                        "steps": steps,
                    }
                last_error = f"Status {response.status_code}, size {len(response.content)}"
            except Exception as e:
                last_error = str(e)

        raise RuntimeError(f"Failed after 3 attempts: {last_error}")


async def _generate_with_stable_horde(
    prompt: str, width: int, height: int, steps: int
) -> dict | None:
    """Generate image using AI Horde (free, community-powered)."""
    import asyncio

    api_url = "https://aihorde.net/api/v2"
    headers = {
        "Content-Type": "application/json",
        "apikey": "0000000000",  # anonymous access
    }

    # Round dimensions to nearest 64 (required by SD)
    w = max(256, min(1024, (width // 64) * 64))
    h = max(256, min(1024, (height // 64) * 64))

    payload = {
        "prompt": prompt,
        "params": {
            "width": w,
            "height": h,
            "steps": min(steps, 30),
            "cfg_scale": 7.0,
            "sampler_name": "k_euler_a",
        },
        "nsfw": False,
        "models": ["stable_diffusion"],
        "r2": True,
    }

    async with httpx.AsyncClient(timeout=180.0) as client:
        # Submit job
        resp = await client.post(f"{api_url}/generate/async", json=payload, headers=headers)
        if resp.status_code != 202:
            raise RuntimeError(f"Horde submit failed: {resp.status_code} {resp.text[:200]}")

        job_id = resp.json().get("id")
        if not job_id:
            raise RuntimeError("No job ID returned")

        # Poll for completion (max 120 seconds)
        for _ in range(60):
            await asyncio.sleep(2)
            check = await client.get(f"{api_url}/generate/check/{job_id}")
            status = check.json()
            if status.get("done"):
                break
            if status.get("faulted"):
                raise RuntimeError("Generation faulted")
        else:
            raise RuntimeError("Generation timed out")

        # Get result
        result_resp = await client.get(f"{api_url}/generate/status/{job_id}")
        result_data = result_resp.json()
        generations = result_data.get("generations", [])
        if not generations:
            raise RuntimeError("No generations returned")

        img_url = generations[0].get("img")
        if not img_url:
            raise RuntimeError("No image URL")

        # Download the image
        img_resp = await client.get(img_url)
        if img_resp.status_code != 200 or len(img_resp.content) < 1000:
            raise RuntimeError(f"Image download failed: {img_resp.status_code}")

        image_b64 = base64.b64encode(img_resp.content).decode("utf-8")
        return {
            "image_base64": image_b64,
            "prompt": prompt,
            "width": w,
            "height": h,
            "steps": steps,
        }
