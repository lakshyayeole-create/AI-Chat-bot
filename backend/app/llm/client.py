"""LLM client abstraction.

Isolates the LLM provider so the rest of the application calls
`generate_answer(question, context, preferred_key_index)` without provider-specific dependencies.
Uses Gemini with a 3-key pool as primary provider, with optional Groq fallback.
"""
from app.core.config import get_settings
from app.core.logging_config import get_logger
from app.llm.gemini_pool import generate_gemini_answer, load_system_prompt

logger = get_logger(__name__)


async def generate_groq_answer(question: str, context: str) -> str:
    """Legacy Groq answer generation for backward compatibility."""
    settings = get_settings()
    if not settings.groq_api_key:
        raise RuntimeError("No LLM API keys configured.")

    from groq import AsyncGroq
    system_prompt = load_system_prompt()
    user_message = f"""Based on the following event information, answer the user's question.

{context}

USER QUESTION:
{question}"""

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
    return response.choices[0].message.content.strip()


async def generate_answer(
    question: str,
    context: str,
    preferred_key_index: int | None = None,
) -> str:
    """Generate a grounded answer using the LLM provider.

    Sends the system prompt + context + user question to Gemini (distributing
    across the 3-key pool) and returns the generated answer.

    Args:
        question: User's question text.
        context: Grounded context block from the retriever.
        preferred_key_index: Optional key index preference for worker pool.

    Returns:
        LLM-generated answer string.

    Raises:
        RuntimeError: If all LLM requests fail.
    """
    settings = get_settings()

    # If any Gemini key is present or no Groq key, use Gemini
    has_gemini = bool(
        settings.gemini_api_key_1
        or settings.gemini_api_key_2
        or settings.gemini_api_key_3
        or settings.gemini_api_key
    )

    if has_gemini or not settings.groq_api_key:
        return await generate_gemini_answer(
            question=question,
            context=context,
            preferred_key_index=preferred_key_index,
        )

    return await generate_groq_answer(question=question, context=context)
