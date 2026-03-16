from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.agent_service import run_agent_workflow

router = APIRouter(prefix="/agent", tags=["agent"])


class AgentRequest(BaseModel):
    messages: list[dict]
    model: str = "llama3"
    user_id: str = ""
    session_id: str | None = None
    system_prompt: str | None = None
    use_rag: bool = False
    collection_name: str | None = None


@router.post("/run")
async def run(request: AgentRequest):
    """Run the full LangGraph agent workflow (memory -> RAG -> LLM -> tools -> response)."""
    if not request.messages:
        raise HTTPException(status_code=400, detail="messages list is required")

    result = await run_agent_workflow(
        messages=request.messages,
        model=request.model,
        user_id=request.user_id,
        session_id=request.session_id,
        system_prompt=request.system_prompt,
        use_rag=request.use_rag,
        collection_name=request.collection_name,
    )
    return result
