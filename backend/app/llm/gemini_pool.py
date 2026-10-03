"""Gemini API Key Pool and LLM Provider.

Manages 3 Gemini API keys with rotation, rate-limit cooldown tracking,
graceful 429 handling, and bounded retries.
"""
import asyncio
from dataclasses import dataclass
from pathlib import Path
import time
import httpx

from app.core.config import get_settings
from app.core.logging_config import get_logger

logger = get_logger(__name__)

# Cache for the system prompt
_system_prompt: str | None = None


def load_system_prompt() -> str:
    """Load the system prompt from file."""
    global _system_prompt
    if _system_prompt is None:
        prompt_path = (
            Path(__file__).resolve().parent.parent / "prompts" / "system_prompt.txt"
        )
        _system_prompt = prompt_path.read_text(encoding="utf-8").strip()
    return _system_prompt


@dataclass
class GeminiKeyStatus:
    """Status metadata for a single Gemini API key."""
    key: str
    index: int
    cooldown_until: float = 0.0
    success_count: int = 0
    failure_count: int = 0
    rate_limit_count: int = 0

    @property
    def masked_key(self) -> str:
        """Return masked key for logging safety."""
        if len(self.key) <= 8:
            return "***"
        return f"...{self.key[-4:]}"

    @property
    def is_cooling_down(self) -> bool:
        """Check if this key is currently rate-limited."""
        return time.time() < self.cooldown_until


class GeminiKeyPool:
    """Pool manager for multiple Gemini API keys."""

    def __init__(self, keys: list[str] | None = None):
        if keys is None:
            settings = get_settings()
            keys = [
                settings.gemini_api_key_1,
                settings.gemini_api_key_2,
                settings.gemini_api_key_3,
            ]
            # Strip empty strings
            keys = [k.strip() for k in keys if k and k.strip()]
            if not keys and settings.gemini_api_key.strip():
                keys = [settings.gemini_api_key.strip()]

        self.key_statuses: list[GeminiKeyStatus] = [
            GeminiKeyStatus(key=k, index=idx) for idx, k in enumerate(keys)
        ]
        self._round_robin_idx = 0
        self._lock = asyncio.Lock()

    @property
    def total_keys(self) -> int:
        return len(self.key_statuses)

    def get_candidate_keys(self, preferred_index: int | None = None) -> list[GeminiKeyStatus]:
        """Get candidate keys ordered by preference and health."""
        if not self.key_statuses:
            return []

        now = time.time()
        # Separate into available vs cooling down
        available = [k for k in self.key_statuses if now >= k.cooldown_until]
        cooling_down = [k for k in self.key_statuses if now < k.cooldown_until]
        cooling_down.sort(key=lambda k: k.cooldown_until)

        # If a preferred index is given, move that key to the front of available
        if preferred_index is not None and available:
            norm_idx = preferred_index % len(self.key_statuses)
            pref_key = self.key_statuses[norm_idx]
            if pref_key in available:
                available.remove(pref_key)
                available.insert(0, pref_key)

        return available + cooling_down

    def mark_rate_limited(self, key_status: GeminiKeyStatus, cooldown_seconds: float = 15.0) -> None:
        """Mark a key as rate-limited with a cooldown period."""
        key_status.cooldown_until = time.time() + cooldown_seconds
        key_status.rate_limit_count += 1
        logger.warning(
            "Gemini Key [%d] (%s) rate-limited (429). Cooldown: %.1fs",
            key_status.index,
            key_status.masked_key,
            cooldown_seconds,
        )

    def mark_success(self, key_status: GeminiKeyStatus) -> None:
        """Record successful call for a key."""
        key_status.success_count += 1
        key_status.cooldown_until = 0.0

    def mark_failure(self, key_status: GeminiKeyStatus) -> None:
        """Record general failure for a key."""
        key_status.failure_count += 1


# Module-level singleton key pool
_key_pool: GeminiKeyPool | None = None


def get_gemini_pool() -> GeminiKeyPool:
    """Get or initialize the global Gemini key pool."""
    global _key_pool
    if _key_pool is None:
        _key_pool = GeminiKeyPool()
    return _key_pool


def set_gemini_pool(pool: GeminiKeyPool) -> None:
    """Override the global Gemini key pool (e.g. for testing)."""
    global _key_pool
    _key_pool = pool


async def generate_gemini_answer(
    question: str,
    context: str,
    preferred_key_index: int | None = None,
    client: httpx.AsyncClient | None = None,
) -> str:
    """Generate answer from Gemini with bounded retries across the 3 API keys.

    Args:
        question: User's question.
        context: Grounded retrieved event context.
        preferred_key_index: Preferred key index (e.g. Worker 0 prefers Key 0).
        client: Optional pre-existing httpx AsyncClient.

    Returns:
        Generated answer text string.

    Raises:
        RuntimeError: If all keys fail or are unavailable.
    """
    settings = get_settings()
    pool = get_gemini_pool()

    if pool.total_keys == 0:
        # Fallback to Groq if legacy GROQ_API_KEY is present
        if settings.groq_api_key:
            logger.info("No Gemini keys found, falling back to legacy Groq LLM")
            from app.llm.client import generate_groq_answer
            return await generate_groq_answer(question, context)
        raise RuntimeError(
            "No Gemini API keys configured. Set GEMINI_API_KEY_1, GEMINI_API_KEY_2, "
            "and GEMINI_API_KEY_3 in your environment."
        )

    system_prompt = load_system_prompt()
    candidate_keys = pool.get_candidate_keys(preferred_key_index)

    user_prompt = (
        f"Based on the following event information, answer the user's question.\n\n"
        f"{context}\n\n"
        f"USER QUESTION:\n{question}"
    )

    gen_config = {
        "temperature": 0.3,
        "maxOutputTokens": 2048,
    }
    if "2.5" in settings.gemini_model:
        gen_config["thinkingConfig"] = {"thinkingBudget": 0}

    payload = {
        "system_instruction": {
            "parts": [{"text": system_prompt}]
        },
        "contents": [
            {
                "role": "user",
                "parts": [{"text": user_prompt}],
            }
        ],
        "generationConfig": gen_config,
    }

    max_attempts = min(3, len(candidate_keys))
    last_error: Exception | None = None

    close_client = False
    if client is None:
        client = httpx.AsyncClient(timeout=30.0)
        close_client = True

    try:
        for attempt_idx in range(max_attempts):
            key_status = candidate_keys[attempt_idx]
            key = key_status.key
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent?key={key}"

            logger.info(
                "Gemini request attempt %d/%d using Key [%d] (%s) model=%s",
                attempt_idx + 1,
                max_attempts,
                key_status.index,
                key_status.masked_key,
                settings.gemini_model,
            )

            try:
                resp = await client.post(url, json=payload)

                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get("candidates", [])
                    if candidates and "content" in candidates[0]:
                        parts = candidates[0]["content"].get("parts", [])
                        text_parts = [p.get("text", "") for p in parts if "text" in p]
                        full_text = "".join(text_parts).strip()
                        if full_text:
                            pool.mark_success(key_status)
                            return full_text
                    logger.warning("Empty content from Gemini response: %s", data)
                    return "That specific detail is not covered in our official event announcements right now. Please feel free to check our schedule or contact our event coordinators!"

                elif resp.status_code == 429:
                    pool.mark_rate_limited(key_status, cooldown_seconds=15.0)
                    last_error = RuntimeError(f"Rate limited (429) on Gemini Key [{key_status.index}]")
                    # Brief pause to allow quota replenishment
                    await asyncio.sleep(1.5)
                    continue

                else:
                    pool.mark_failure(key_status)
                    err_text = resp.text[:200]
                    logger.warning(
                        "Gemini API returned status %d on Key [%d]: %s",
                        resp.status_code,
                        key_status.index,
                        err_text,
                    )
                    last_error = RuntimeError(f"Gemini API Error {resp.status_code}: {err_text}")
                    continue

            except httpx.TimeoutException as e:
                pool.mark_failure(key_status)
                logger.warning("Gemini request timeout on Key [%d]: %s", key_status.index, e)
                last_error = e
                continue
            except Exception as e:
                pool.mark_failure(key_status)
                logger.warning("Gemini request exception on Key [%d]: %s", key_status.index, e)
                last_error = e
                continue

        # If rate limited across all keys, wait 4.0s and try once more on the earliest key
        if isinstance(last_error, RuntimeError) and "429" in str(last_error):
            logger.info("All Gemini keys were rate-limited. Waiting 4.0s for token bucket refill...")
            await asyncio.sleep(4.0)
            earliest_key = min(pool.key_statuses, key=lambda k: k.cooldown_until)
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent?key={earliest_key.key}"
            logger.info("Retrying with earliest key [%d] after rate-limit backoff", earliest_key.index)
            try:
                resp = await client.post(url, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get("candidates", [])
                    if candidates and "content" in candidates[0]:
                        parts = candidates[0]["content"].get("parts", [])
                        text_parts = [p.get("text", "") for p in parts if "text" in p]
                        full_text = "".join(text_parts).strip()
                        if full_text:
                            pool.mark_success(earliest_key)
                            return full_text
                elif resp.status_code == 429:
                    last_error = RuntimeError(f"Rate limited (429) on retry with Key [{earliest_key.index}]")
            except Exception as retry_e:
                last_error = retry_e

        # If primary model is quota exhausted (429), try fallback model (gemini-flash-lite-latest)
        if isinstance(last_error, RuntimeError) and "429" in str(last_error) and settings.gemini_model != "gemini-flash-lite-latest":
            fallback_model = "gemini-flash-lite-latest"
            logger.info("Primary model '%s' rate-limited. Failing over to '%s'...", settings.gemini_model, fallback_model)
            for fallback_key_status in pool.key_statuses:
                try:
                    fb_url = f"https://generativelanguage.googleapis.com/v1beta/models/{fallback_model}:generateContent?key={fallback_key_status.key}"
                    fb_resp = await client.post(fb_url, json=payload)
                    if fb_resp.status_code == 200:
                        data = fb_resp.json()
                        candidates = data.get("candidates", [])
                        if candidates and "content" in candidates[0]:
                            parts = candidates[0]["content"].get("parts", [])
                            text_parts = [p.get("text", "") for p in parts if "text" in p]
                            full_text = "".join(text_parts).strip()
                            if full_text:
                                pool.mark_success(fallback_key_status)
                                return full_text
                    elif fb_resp.status_code == 429:
                        last_error = RuntimeError(f"Rate limited (429) on fallback model {fallback_model}")
                except Exception as fb_e:
                    last_error = fb_e

    finally:
        if close_client:
            await client.aclose()

    logger.error("All Gemini API keys failed after %d attempts", max_attempts)
    raise RuntimeError(
        "All Gemini API keys are currently rate-limited or unavailable. "
        "Please try again shortly."
    ) from last_error
