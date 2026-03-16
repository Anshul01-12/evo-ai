import json
import re

from fastapi import APIRouter
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from app.services.agent.graph import run_agent
from app.services.llm.chat_service import EVO_SYSTEM_PROMPT, generate_title, stream_chat

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    messages: list[dict]
    model: str = "llama3"
    use_rag: bool = False
    collection_name: str | None = None
    system_prompt: str | None = None
    user_id: str = "chat-api"
    session_id: str | None = None


class TitleRequest(BaseModel):
    message: str
    model: str = "llama3"


class SummarizeRequest(BaseModel):
    messages: list[dict]
    model: str = "llama3"


@router.post("/stream")
async def chat_stream(request: ChatRequest):
    result = await run_agent(
        messages=request.messages,
        model=request.model,
        user_id=request.user_id,
        session_id=request.session_id,
        system_prompt=request.system_prompt or EVO_SYSTEM_PROMPT,
        use_rag=request.use_rag,
        collection_name=request.collection_name,
    )
    response_text = result.get("response", "")
    tokens = re.findall(r"\S+\s*", response_text) or [response_text]

    async def event_generator():
        for token in tokens:
            yield {"event": "token", "data": json.dumps({"token": token})}
        yield {
            "event": "done",
            "data": json.dumps(
                {
                    "status": "complete",
                    "metadata": result.get("metadata", {}),
                    "tool_calls": result.get("tool_calls", []),
                }
            ),
        }

    return EventSourceResponse(event_generator())


@router.post("/title")
async def create_title(request: TitleRequest):
    title = await generate_title(request.message, request.model)
    return {"title": title}


@router.post("/summarize")
async def summarize(request: SummarizeRequest):
    conversation_text = "\n".join(
        f"{m.get('role', 'user')}: {m.get('content', '')}"
        for m in request.messages[-20:]
    )

    summary_prompt = (
        "You summarize conversations for a memory system. "
        "Extract the key topics, user preferences, decisions, and action items "
        "in 2-3 concise sentences. Focus on facts that would be useful in future conversations."
    )

    messages = [{"role": "user", "content": f"Summarize this conversation:\n\n{conversation_text}"}]

    summary = ""
    async for token in stream_chat(messages, request.model, summary_prompt):
        summary += token

    return {"summary": summary.strip()}


class ExtractProfileRequest(BaseModel):
    messages: list[dict]
    model: str = "groq-llama3-8b"


@router.post("/extract-profile")
async def extract_profile(request: ExtractProfileRequest):
    conversation_text = "\n".join(
        f"{m.get('role', 'user')}: {m.get('content', '')}"
        for m in request.messages[-20:]
    )

    extraction_prompt = (
        "You are a fact extraction system. Analyze the conversation below and extract "
        "any personal facts the USER has shared about themselves. "
        "Return ONLY a valid JSON object with relevant keys. Common keys include:\n"
        "name, age, location, occupation, interests, language, timezone, "
        "preferences, skills, goals, company, education\n\n"
        "Rules:\n"
        "- Only include facts the USER explicitly stated, not the assistant\n"
        "- If no facts found, return {}\n"
        "- Values should be short strings\n"
        "- Do NOT invent or assume facts\n"
        "- Return ONLY the JSON object, no other text"
    )

    messages = [{"role": "user", "content": f"{extraction_prompt}\n\nConversation:\n{conversation_text}"}]

    result = ""
    async for token in stream_chat(messages, request.model, extraction_prompt):
        result += token

    result = result.strip()

    # Parse JSON from response
    try:
        # Handle markdown code blocks
        if "```" in result:
            result = result.split("```")[1]
            if result.startswith("json"):
                result = result[4:]
            result = result.strip()
        profile = json.loads(result)
        if not isinstance(profile, dict):
            profile = {}
        # Filter to string values only
        profile = {k: str(v) for k, v in profile.items() if v and str(v).strip()}
    except (json.JSONDecodeError, IndexError):
        profile = {}

    return {"profile": profile}
