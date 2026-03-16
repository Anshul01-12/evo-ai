import json

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from app.services.rag.document_service import ingest_document, retrieve_context
from app.services.llm.chat_service import stream_chat, EVO_SYSTEM_PROMPT

router = APIRouter(prefix="/documents", tags=["documents"])


class IngestRequest(BaseModel):
    file_path: str
    filename: str
    collection_name: str = "default"


class QARequest(BaseModel):
    question: str
    collection_name: str
    model: str = "llama3"
    top_k: int = 5


@router.post("/ingest")
async def ingest(request: IngestRequest):
    """Ingest a document into the vector store."""
    chunk_count = await ingest_document(
        request.file_path, request.filename, request.collection_name
    )
    return {"chunkCount": chunk_count, "status": "ready"}


@router.post("/qa")
async def qa(request: QARequest):
    """Answer a question using document context, with citations."""
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    context_chunks = await retrieve_context(
        request.question, request.collection_name, request.top_k
    )

    if not context_chunks:
        raise HTTPException(status_code=404, detail="No context found in collection")

    context_text = "\n\n".join(
        f"[{c['source']}#{c['chunk_index']}]: {c['text']}" for c in context_chunks
    )

    system_prompt = (
        EVO_SYSTEM_PROMPT
        + "\n\nYou are answering a question using only the provided document context. "
        "Provide a thorough answer and cite your sources using [source#chunk_index] notation. "
        "If the context does not contain enough information, clearly state what is missing."
        "\n\nContext:\n"
        + context_text
    )

    messages = [{"role": "user", "content": request.question}]

    answer = ""
    async for token in stream_chat(messages, request.model, system_prompt):
        answer += token

    return {
        "question": request.question,
        "answer": answer.strip(),
        "citations": [
            {
                "source": c["source"],
                "chunk_index": c["chunk_index"],
                "text": c["text"][:300],  # truncate for response size
                "score": round(c.get("score", 0), 4),
            }
            for c in context_chunks
        ],
        "collection_name": request.collection_name,
    }


@router.post("/qa/stream")
async def qa_stream(request: QARequest):
    """Stream a document Q&A answer with SSE, then emit citations at the end."""
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    context_chunks = await retrieve_context(
        request.question, request.collection_name, request.top_k
    )

    if not context_chunks:
        raise HTTPException(status_code=404, detail="No context found in collection")

    context_text = "\n\n".join(
        f"[{c['source']}#{c['chunk_index']}]: {c['text']}" for c in context_chunks
    )

    system_prompt = (
        EVO_SYSTEM_PROMPT
        + "\n\nYou are answering a question using only the provided document context. "
        "Provide a thorough answer and cite your sources using [source#chunk_index] notation. "
        "If the context does not contain enough information, clearly state what is missing."
        "\n\nContext:\n"
        + context_text
    )

    messages = [{"role": "user", "content": request.question}]

    citations = [
        {
            "source": c["source"],
            "chunk_index": c["chunk_index"],
            "text": c["text"][:300],
            "score": round(c.get("score", 0), 4),
        }
        for c in context_chunks
    ]

    async def event_generator():
        async for token in stream_chat(messages, request.model, system_prompt):
            yield {"event": "token", "data": json.dumps({"token": token})}
        yield {
            "event": "done",
            "data": json.dumps({"status": "complete", "citations": citations}),
        }

    return EventSourceResponse(event_generator())
