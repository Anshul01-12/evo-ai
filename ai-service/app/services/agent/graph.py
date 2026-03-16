from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from typing import Any, Literal, TypedDict

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langgraph.graph import END, StateGraph

from app.core.config import get_settings
from app.core.langfuse_client import get_langfuse_callback, observe_operation
from app.services.llm.chat_service import EVO_SYSTEM_PROMPT, get_chat_model
from app.services.memory.memory_service import ConversationMemory
from app.services.rag.document_service import retrieve_context

settings = get_settings()


class AgentState(TypedDict):
    messages: list[dict[str, str]]
    user_id: str
    session_id: str | None
    model: str
    system_prompt: str
    use_rag: bool
    collection_name: str | None
    memory_context: str
    rag_context: str
    reasoning: dict[str, Any]
    tool_result: dict[str, Any] | None
    response: str
    metadata: dict[str, Any]
    error: str | None


TOOLS = {
    "calculator": "Evaluate numeric expressions for arithmetic questions.",
    "current_time": "Return the current UTC date and time.",
    "rag_lookup": "Fetch supporting document chunks when the user asks about uploaded documents.",
}


def _make_llm(model: str, *, user_id: str | None, session_id: str | None, metadata: dict[str, Any]):
    return get_chat_model(
        model or settings.AGENT_DEFAULT_MODEL,
        trace_name="evo-agent-llm",
        user_id=user_id,
        session_id=session_id,
        metadata=metadata,
        temperature=settings.AGENT_REASONING_TEMPERATURE,
    )


def _safe_eval(expression: str) -> float:
    allowed_names = {"abs": abs, "round": round, "ceil": math.ceil, "floor": math.floor}
    return float(eval(expression, {"__builtins__": {}}, allowed_names))


async def load_memory(state: AgentState) -> AgentState:
    memory = ConversationMemory()
    session_id = state.get("session_id")
    history = []
    summary = ""

    with observe_operation(
        name="agent-load-memory",
        user_id=state.get("user_id"),
        session_id=session_id,
        input_payload={"session_id": session_id},
    ):
        if session_id:
            history = await memory.get_history(session_id, last_n=settings.AGENT_MAX_HISTORY)
            summary = await memory.get_summary(session_id) or ""

    sections: list[str] = []
    if summary:
        sections.append(f"Conversation summary:\n{summary}")
    if history:
        recent = "\n".join(
            f"{message.get('role', 'user')}: {message.get('content', '')[:200]}"
            for message in history[-4:]
        )
        sections.append(f"Recent history:\n{recent}")

    state["memory_context"] = "\n\n".join(sections)
    state["metadata"] = {
        **state.get("metadata", {}),
        "memory_loaded": bool(sections),
        "memory_messages": len(history),
    }
    return state


async def check_rag(state: AgentState) -> AgentState:
    state["rag_context"] = ""

    if not state.get("use_rag") or not settings.AGENT_ENABLE_RAG:
        return state

    collection_name = state.get("collection_name")
    if not collection_name:
        return state

    last_user_message = next(
        (message["content"] for message in reversed(state["messages"]) if message.get("role") == "user"),
        "",
    )
    if not last_user_message:
        return state

    with observe_operation(
        name="agent-rag-lookup",
        user_id=state.get("user_id"),
        session_id=state.get("session_id"),
        input_payload={"query": last_user_message, "collection_name": collection_name},
    ) as trace:
        chunks = await retrieve_context(last_user_message, collection_name, top_k=5)
        if chunks:
            state["rag_context"] = "\n\n".join(
                f"[{chunk['source']}#{chunk['chunk_index']}] {chunk['text']}"
                for chunk in chunks
            )
            state["metadata"] = {
                **state.get("metadata", {}),
                "rag_chunks": len(chunks),
                "rag_collection": collection_name,
            }
            if trace:
                trace.update(output={"chunks": chunks})

    return state


async def reasoning_node(state: AgentState) -> AgentState:
    llm = _make_llm(
        state["model"],
        user_id=state.get("user_id"),
        session_id=state.get("session_id"),
        metadata={
            "stage": "reasoning",
            "use_rag": state.get("use_rag"),
            "collection_name": state.get("collection_name"),
        },
    )

    tool_instructions = "\n".join(f"- {name}: {description}" for name, description in TOOLS.items())
    prompt = (
        "You are the routing and reasoning layer for an AI assistant.\n"
        "Analyze the latest user request and decide whether a tool is needed.\n"
        "Respond with valid JSON only using this schema:\n"
        '{'
        '"thought": "short reasoning", '
        '"use_tool": true, '
        '"tool_name": "calculator|current_time|rag_lookup|none", '
        '"tool_input": {"expression": "..."} , '
        '"final_answer": "draft answer if no tool is needed"'
        '}\n'
        "Available tools:\n"
        f"{tool_instructions}\n"
        "Use rag_lookup only when document context is relevant but missing or insufficient."
    )

    context_blocks = [state.get("system_prompt") or EVO_SYSTEM_PROMPT]
    if state.get("memory_context"):
        context_blocks.append(f"Memory context:\n{state['memory_context']}")
    if state.get("rag_context"):
        context_blocks.append(f"Retrieved document context:\n{state['rag_context']}")

    messages = [
        SystemMessage(content="\n\n".join(context_blocks)),
        SystemMessage(content=prompt),
    ]
    for item in state["messages"][-settings.AGENT_MAX_HISTORY :]:
        if item["role"] == "assistant":
            messages.append(AIMessage(content=item["content"]))
        else:
            messages.append(HumanMessage(content=item["content"]))

    with observe_operation(
        name="agent-reasoning",
        user_id=state.get("user_id"),
        session_id=state.get("session_id"),
        input_payload={"message_count": len(state["messages"])},
    ):
        response = await llm.ainvoke(messages)

    raw_content = response.content if isinstance(response.content, str) else json.dumps(response.content)
    try:
        state["reasoning"] = json.loads(raw_content)
    except json.JSONDecodeError:
        state["reasoning"] = {
            "thought": "Fallback because the reasoning output was not valid JSON.",
            "use_tool": False,
            "tool_name": "none",
            "tool_input": {},
            "final_answer": raw_content,
        }

    return state


async def tool_node(state: AgentState) -> AgentState:
    reasoning = state.get("reasoning", {})
    if not settings.AGENT_ENABLE_TOOLS or not reasoning.get("use_tool"):
        state["tool_result"] = None
        return state

    tool_name = reasoning.get("tool_name") or "none"
    tool_input = reasoning.get("tool_input") or {}
    result: dict[str, Any]

    with observe_operation(
        name="agent-tool-call",
        user_id=state.get("user_id"),
        session_id=state.get("session_id"),
        input_payload={"tool_name": tool_name, "tool_input": tool_input},
        metadata={"tool_name": tool_name},
    ) as trace:
        if tool_name == "calculator":
            expression = str(tool_input.get("expression", "")).strip()
            result = {"tool_name": tool_name, "output": str(_safe_eval(expression))}
        elif tool_name == "current_time":
            result = {
                "tool_name": tool_name,
                "output": datetime.now(timezone.utc).isoformat(),
            }
        elif tool_name == "rag_lookup" and state.get("collection_name"):
            query = str(tool_input.get("query") or state["messages"][-1]["content"])
            chunks = await retrieve_context(query, state["collection_name"], top_k=5)
            result = {"tool_name": tool_name, "output": chunks}
        else:
            result = {"tool_name": "none", "output": None}

        if trace:
            trace.update(output=result)

    state["tool_result"] = result
    state["metadata"] = {
        **state.get("metadata", {}),
        "tool_called": result["tool_name"] != "none",
        "tool_name": result["tool_name"],
    }
    return state


async def response_node(state: AgentState) -> AgentState:
    llm = _make_llm(
        state["model"],
        user_id=state.get("user_id"),
        session_id=state.get("session_id"),
        metadata={
            "stage": "response",
            "tool_name": (state.get("tool_result") or {}).get("tool_name"),
        },
    )

    system_parts = [state.get("system_prompt") or EVO_SYSTEM_PROMPT]
    if state.get("memory_context"):
        system_parts.append(f"Long-term memory:\n{state['memory_context']}")
    if state.get("rag_context"):
        system_parts.append(
            "Document context below can be used and cited with [source#chunk]:\n"
            f"{state['rag_context']}"
        )
    if state.get("tool_result") and state["tool_result"]["tool_name"] != "none":
        system_parts.append(f"Tool output:\n{json.dumps(state['tool_result']['output'], ensure_ascii=True)}")

    prompt_messages = [SystemMessage(content="\n\n".join(system_parts))]
    for item in state["messages"][-settings.AGENT_MAX_HISTORY :]:
        if item["role"] == "assistant":
            prompt_messages.append(AIMessage(content=item["content"]))
        else:
            prompt_messages.append(HumanMessage(content=item["content"]))

    if state.get("reasoning", {}).get("final_answer"):
        prompt_messages.append(
            SystemMessage(
                content=(
                    "Draft answer from reasoning layer:\n"
                    f"{state['reasoning']['final_answer']}\n"
                    "Refine it into the final response."
                )
            )
        )

    with observe_operation(
        name="agent-response",
        user_id=state.get("user_id"),
        session_id=state.get("session_id"),
        input_payload={"has_tool_result": bool(state.get("tool_result"))},
    ):
        response = await llm.ainvoke(prompt_messages)

    state["response"] = response.content if isinstance(response.content, str) else json.dumps(response.content)
    return state


async def persist_memory_node(state: AgentState) -> AgentState:
    memory = ConversationMemory()
    session_id = state.get("session_id")
    if not session_id:
        return state

    last_user = next(
        (message for message in reversed(state["messages"]) if message.get("role") == "user"),
        None,
    )

    with observe_operation(
        name="agent-persist-memory",
        user_id=state.get("user_id"),
        session_id=session_id,
        input_payload={"session_id": session_id},
    ):
        if last_user:
            await memory.add(session_id, "user", last_user["content"])
        await memory.add(session_id, "assistant", state.get("response", ""))

    return state


def build_agent_graph():
    graph = StateGraph(AgentState)
    graph.add_node("load_memory", load_memory)
    graph.add_node("check_rag", check_rag)
    graph.add_node("reasoning", reasoning_node)
    graph.add_node("tool_usage", tool_node)
    graph.add_node("response", response_node)
    graph.add_node("persist_memory", persist_memory_node)

    graph.set_entry_point("load_memory")
    graph.add_edge("load_memory", "check_rag")
    graph.add_edge("check_rag", "reasoning")
    graph.add_edge("reasoning", "tool_usage")
    graph.add_edge("tool_usage", "response")
    graph.add_edge("response", "persist_memory")
    graph.add_edge("persist_memory", END)
    return graph.compile()


agent_graph = build_agent_graph()


async def run_agent(
    *,
    messages: list[dict[str, str]],
    model: str = "llama3",
    user_id: str = "",
    session_id: str | None = None,
    system_prompt: str | None = None,
    use_rag: bool = False,
    collection_name: str | None = None,
) -> dict[str, Any]:
    initial_state: AgentState = {
        "messages": messages,
        "user_id": user_id,
        "session_id": session_id,
        "model": model or settings.AGENT_DEFAULT_MODEL,
        "system_prompt": system_prompt or EVO_SYSTEM_PROMPT,
        "use_rag": use_rag,
        "collection_name": collection_name,
        "memory_context": "",
        "rag_context": "",
        "reasoning": {},
        "tool_result": None,
        "response": "",
        "metadata": {},
        "error": None,
    }

    result = await agent_graph.ainvoke(initial_state)
    tool_result = result.get("tool_result")

    return {
        "response": result.get("response", ""),
        "tool_calls": [tool_result] if tool_result and tool_result.get("tool_name") != "none" else [],
        "metadata": result.get("metadata", {}),
    }
