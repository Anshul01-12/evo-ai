from collections.abc import AsyncIterator
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate
from langchain_ollama import ChatOllama
from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI

from app.core.config import get_settings
from app.core.langfuse_client import get_langfuse_callback, observe_operation

settings = get_settings()

GROQ_MODELS = {
    "groq-llama3-70b",
    "groq-llama3-8b",
    "groq-mixtral",
    "groq-llama4-scout",
    "groq-qwen3-32b",
    "groq-kimi-k2",
}

GEMINI_MODELS = {
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-pro",
}

EVO_SYSTEM_PROMPT = (
    "You are Evo, an intelligent and helpful AI assistant. "
    "You are knowledgeable, friendly, and concise. You help users with a wide range of tasks "
    "including answering questions, writing, analysis, coding, and creative work. "
    "Always be helpful, accurate, and thoughtful in your responses."
)


GROQ_MODEL_MAP = {
    "groq-llama3-70b": "llama-3.3-70b-versatile",
    "groq-llama3-8b": "llama-3.1-8b-instant",
    "groq-mixtral": "llama-3.1-8b-instant",
    "groq-llama4-scout": "meta-llama/llama-4-scout-17b-16e-instruct",
    "groq-qwen3-32b": "qwen/qwen3-32b",
    "groq-kimi-k2": "moonshotai/kimi-k2-instruct",
}

GEMINI_MODEL_MAP = {
    "gemini-2.0-flash": "gemini-2.0-flash",
    "gemini-2.0-flash-lite": "gemini-2.0-flash-lite",
    "gemini-1.5-pro": "gemini-1.5-pro",
}


def get_chat_model(
    model: str | None = None,
    *,
    trace_name: str = "evo-chat",
    user_id: str | None = None,
    session_id: str | None = None,
    metadata: dict[str, Any] | None = None,
    temperature: float | None = None,
):
    callbacks = []
    callback = get_langfuse_callback(
        name=trace_name,
        user_id=user_id,
        session_id=session_id,
        metadata=metadata,
    )
    if callback:
        callbacks.append(callback)

    selected = model or settings.OLLAMA_CHAT_MODEL

    if selected in GROQ_MODELS:
        return ChatGroq(
            model=GROQ_MODEL_MAP[selected],
            api_key=settings.GROQ_API_KEY,
            callbacks=callbacks,
            **({"temperature": temperature} if temperature is not None else {}),
        )

    if selected in GEMINI_MODELS:
        return ChatGoogleGenerativeAI(
            model=GEMINI_MODEL_MAP[selected],
            google_api_key=settings.GOOGLE_API_KEY,
            callbacks=callbacks,
            **({"temperature": temperature} if temperature is not None else {}),
        )

    return ChatOllama(
        model=selected,
        base_url=settings.OLLAMA_BASE_URL,
        callbacks=callbacks,
        **({"temperature": temperature} if temperature is not None else {}),
    )


async def stream_chat(
    messages: list[dict],
    model: str | None = None,
    system_prompt: str | None = None,
    *,
    user_id: str | None = None,
    session_id: str | None = None,
) -> AsyncIterator[str]:
    llm = get_chat_model(
        model,
        trace_name="evo-chat-stream",
        user_id=user_id,
        session_id=session_id,
        metadata={"message_count": len(messages)},
    )

    lc_messages = [SystemMessage(content=system_prompt or EVO_SYSTEM_PROMPT)]
    for msg in messages:
        if msg["role"] == "user":
            lc_messages.append(HumanMessage(content=msg["content"]))
        elif msg["role"] == "assistant":
            lc_messages.append(AIMessage(content=msg["content"]))

    with observe_operation(
        name="llm-stream-chat",
        user_id=user_id,
        session_id=session_id,
        input_payload={"message_count": len(messages), "model": model or settings.OLLAMA_CHAT_MODEL},
    ):
        async for chunk in llm.astream(lc_messages):
            if chunk.content:
                yield chunk.content


async def generate_title(message: str, model: str | None = None) -> str:
    llm = get_chat_model(
        model,
        trace_name="evo-title",
        metadata={"purpose": "conversation-title"},
    )
    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                "Generate a concise title (max 6 words) for a conversation starting with this message. Reply with only the title, no quotes.",
            ),
            ("human", "{message}"),
        ]
    )
    chain = prompt | llm

    with observe_operation(
        name="llm-generate-title",
        input_payload={"message": message, "model": model or settings.OLLAMA_CHAT_MODEL},
    ):
        response = await chain.ainvoke({"message": message})

    return response.content.strip()[:100]
