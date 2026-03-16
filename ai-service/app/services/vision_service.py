import base64
import io
from pathlib import Path
from typing import Optional

from PIL import Image
from langchain_ollama import ChatOllama
from langchain_core.messages import HumanMessage, SystemMessage
from app.core.config import get_settings

settings = get_settings()


def get_vision_model() -> ChatOllama:
    return ChatOllama(model=settings.OLLAMA_VISION_MODEL, base_url=settings.OLLAMA_BASE_URL)


async def analyze_image(file_path: str, question: str = "Describe this image.") -> str:
    model = get_vision_model()

    # Assuming LLaVA style prompt where the image is referenced from file
    prompt = f"<img>{file_path}</img>\n{question}"

    content = ""
    async for token in model.astream([SystemMessage(content="You are an image-aware assistant."), HumanMessage(content=prompt)]):
        content += token.content or ""

    return content.strip()


async def generate_image(prompt_text: str, width: int = 512, height: int = 512, steps: int = 30) -> str:
    try:
        from diffusers import StableDiffusionPipeline
        import torch
    except ImportError as e:
        raise RuntimeError("Stable Diffusion dependencies not installed: " + str(e))

    pipe = StableDiffusionPipeline.from_pretrained(
        "runwayml/stable-diffusion-v1-5",
        torch_dtype=torch.float16,
    )
    pipe.to("cuda" if torch.cuda.is_available() else "cpu")

    image = pipe(prompt_text, num_inference_steps=steps, height=height, width=width).images[0]
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

    return b64


async def answer_image_question(file_path: str, question: str) -> str:
    return await analyze_image(file_path, question)
