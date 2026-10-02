"""Concurrency limiter, request coalescer, and queue management for TTS."""
import asyncio
from typing import Callable, Coroutine, Dict, Any, Optional

from app.core.config import get_settings
from app.core.logging_config import get_logger

logger = get_logger(__name__)


class TTSBusyException(Exception):
    """Raised when TTS concurrency queue is full or timed out."""
    def __init__(self, message: str = "Voice server is temporarily busy. Please try again or use browser speech."):
        super().__init__(message)
        self.code = "TTS_BUSY"


class TTSCoalescingLimiter:
    """Manages bounded concurrency and coalescing of duplicate in-flight TTS generation requests."""

    def __init__(
        self,
        max_concurrent: int = 2,
        queue_max_size: int = 10,
        queue_timeout_sec: float = 8.0,
    ):
        self.max_concurrent = max_concurrent
        self.queue_max_size = queue_max_size
        self.queue_timeout_sec = queue_timeout_sec

        self._semaphore = asyncio.Semaphore(max_concurrent)
        self._in_flight: Dict[str, asyncio.Task] = {}
        self._queue_waiters = 0
        self._lock = asyncio.Lock()

    @property
    def queue_size(self) -> int:
        return self._queue_waiters

    async def execute_coalesced(
        self,
        key: str,
        generator_fn: Callable[[], Coroutine[Any, Any, bytes]],
    ) -> bytes:
        """Execute a generation function, coalescing duplicate concurrent calls with the same key."""
        task = None
        async with self._lock:
            if key in self._in_flight:
                logger.info("Coalescing in-flight TTS request for key: %s", key[:12])
                task = self._in_flight[key]
            else:
                # 2. Check queue capacity
                if self._queue_waiters >= self.queue_max_size:
                    logger.warning("TTS queue capacity exceeded (%d/%d)", self._queue_waiters, self.queue_max_size)
                    raise TTSBusyException("Voice service queue is full.")

                self._queue_waiters += 1

                # 3. Create the future / task for this key
                async def _run():
                    try:
                        # Acquire semaphore with timeout
                        try:
                            await asyncio.wait_for(
                                self._semaphore.acquire(),
                                timeout=self.queue_timeout_sec,
                            )
                        except asyncio.TimeoutError:
                            logger.warning("TTS queue wait timed out for key: %s", key[:12])
                            raise TTSBusyException("Voice queue wait timed out.")

                        try:
                            return await generator_fn()
                        finally:
                            self._semaphore.release()
                    finally:
                        async with self._lock:
                            self._queue_waiters = max(0, self._queue_waiters - 1)
                            self._in_flight.pop(key, None)

                task = asyncio.create_task(_run())
                self._in_flight[key] = task

        return await task


# Global singleton limiter
_limiter: Optional[TTSCoalescingLimiter] = None


def get_tts_limiter() -> TTSCoalescingLimiter:
    global _limiter
    if _limiter is None:
        settings = get_settings()
        _limiter = TTSCoalescingLimiter(
            max_concurrent=settings.tts_max_concurrent_requests,
            queue_max_size=settings.tts_queue_max_size,
            queue_timeout_sec=settings.tts_queue_timeout_ms / 1000.0,
        )
    return _limiter
