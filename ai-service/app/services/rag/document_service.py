import uuid

import fitz  # PyMuPDF
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_ollama import OllamaEmbeddings
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

from app.core.config import get_settings
from app.core.langfuse_client import observe_operation

settings = get_settings()


def get_qdrant() -> QdrantClient:
    return QdrantClient(host=settings.QDRANT_HOST, port=settings.QDRANT_PORT)


def get_embeddings() -> OllamaEmbeddings:
    return OllamaEmbeddings(
        model=settings.OLLAMA_EMBED_MODEL,
        base_url=settings.OLLAMA_BASE_URL,
    )


def extract_text(file_path: str) -> str:
    doc = fitz.open(file_path)
    text = ""
    for page in doc:
        text += page.get_text()
    doc.close()
    return text


def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> list[str]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=overlap,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    return splitter.split_text(text)


async def ingest_document(file_path: str, filename: str, collection_name: str) -> int:
    """Extract, chunk, embed, store. Returns chunk count."""
    with observe_operation(
        name="rag-ingest-document",
        input_payload={"filename": filename, "collection_name": collection_name},
    ):
        text = extract_text(file_path)
        chunks = chunk_text(text)

        embeddings = get_embeddings()
        vectors = await embeddings.aembed_documents(chunks)

        client = get_qdrant()
        existing = [c.name for c in client.get_collections().collections]
        if collection_name not in existing:
            client.create_collection(
                collection_name=collection_name,
                vectors_config=VectorParams(size=len(vectors[0]), distance=Distance.COSINE),
            )

        points = [
            PointStruct(
                id=str(uuid.uuid4()),
                vector=vec,
                payload={"text": chunk, "source": filename, "chunk_index": i},
            )
            for i, (chunk, vec) in enumerate(zip(chunks, vectors))
        ]
        client.upsert(collection_name=collection_name, points=points)

        return len(chunks)


async def retrieve_context(query: str, collection_name: str, top_k: int = 5) -> list[dict]:
    """Retrieve relevant chunks for a query with citation metadata."""
    with observe_operation(
        name="rag-retrieve-context",
        input_payload={"query": query, "collection_name": collection_name, "top_k": top_k},
    ):
        embeddings = get_embeddings()
        query_vector = await embeddings.aembed_query(query)

        client = get_qdrant()
        results = client.search(
            collection_name=collection_name,
            query_vector=query_vector,
            limit=top_k,
        )

        context_list = []
        for hit in results:
            payload = hit.payload or {}
            context_list.append(
                {
                    "text": payload.get("text", ""),
                    "source": payload.get("source", "unknown"),
                    "chunk_index": payload.get("chunk_index", -1),
                    "score": hit.score,
                }
            )

        return context_list
