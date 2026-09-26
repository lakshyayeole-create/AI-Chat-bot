"""LLM client abstraction using Groq API.

Isolates the LLM provider so the rest of the application only calls
`generate_answer(question, context)` without provider-specific dependencies.
"""
from pathlib import Path

from groq import AsyncGroq

from app.core.config import get_settings
from app.core.logging_config import get_logger

logger = get_logger(__name__)

# Cache the system prompt
_system_prompt: str | None = None


def _load_system_prompt() -> str:
    """Load the system prompt from file.

    Returns:
        System prompt text.
    """
    global _system_prompt
    if _system_prompt is None:
        prompt_path = (
            Path(__file__).resolve().parent.parent / "prompts" / "system_prompt.txt"
        )
        _system_prompt = prompt_path.read_text(encoding="utf-8").strip()
        logger.info("System prompt loaded from %s", prompt_path)
    return _system_prompt


async def generate_answer(question: str, context: str) -> str:
    """Generate a grounded answer using the LLM.

    Sends the system prompt + context + user question to Groq and returns
    the generated answer.

    Args:
        question: User's question text.
        context: Grounded context block from the retriever.

    Returns:
        LLM-generated answer string.

    Raises:
        RuntimeError: If the LLM request fails.
    """
    settings = get_settings()

    if not settings.groq_api_key:
        raise RuntimeError(
            "GROQ_API_KEY is not configured. "
            "Set it in your .env file to enable LLM responses."
        )

    system_prompt = _load_system_prompt()

    # Build the user message with context
    user_message = f"""Based on the following event information, answer the user's question.

{context}

USER QUESTION:
{question}"""

    try:
        client = AsyncGroq(api_key=settings.groq_api_key)

        response = await client.chat.completions.create(
            model=settings.llm_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            temperature=0.3,
            max_tokens=800,
        )

        answer = response.choices[0].message.content.strip()
        logger.info(
            "LLM response generated (model=%s, tokens=%s)",
            settings.llm_model,
            response.usage.total_tokens if response.usage else "unknown",
        )
        return answer

    except Exception as e:
        logger.error("LLM request failed: %s", str(e))
        raise RuntimeError(f"LLM request failed: {type(e).__name__}: {str(e)}") from e
