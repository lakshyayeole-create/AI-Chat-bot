# Anantya 2026 — Chatbot & Text-to-Speech Architecture

**Status:** Proposed implementation baseline  
**Scope owner:** Chatbot and TTS workstream  
**Project:** Anantya 2026, Marvel-inspired event website

## 1. Purpose and scope

This document defines the chatbot/TTS module only. The owner of this workstream does not necessarily have access to the full website repository. The module must therefore be built as a self-contained feature with documented integration contracts.

### In scope
- Speaking chatbot answers when voice output is enabled.
- Reading the visible page's relevant content aloud on request.
- An original, consistent futuristic assistant voice inspired by the *style* of a cinematic AI assistant.
- ElevenLabs as the primary neural TTS provider, subject to account access, plan quota, and terms.
- Browser Web Speech API as the fallback.
- Caching, bounded concurrency, error handling, API-key security, accessibility, and tests.
- A small adapter/interface for integration with the main website.

### Out of scope
- Rebuilding the full Anantya website or unrelated UI.
- Replacing the existing chatbot's answer-generation logic without a demonstrated need.
- Changing unrelated routes, 3D scenes, animations, event data, authentication, or styling.
- Cloning a real actor's voice or claiming the voice is an official Marvel/JARVIS voice.

## 2. Final decisions

| Area | Decision |
|---|---|
| User-facing modes | Two: **Chatbot Voice** and **Read Page** |
| Primary TTS | ElevenLabs API, called only from a trusted backend/serverless function |
| Fallback TTS | Browser `speechSynthesis` / `SpeechSynthesisUtterance` |
| Voice direction | Original futuristic, calm, clear, confident assistant voice; not an unauthorized clone |
| Read Page input | Relevant, visible page content supplied by the host website or extracted from an explicitly selected content container |
| Chatbot Voice input | The final text answer returned by the existing chatbot |
| Cache | **Pregenerated voice only:** Backend disk cache stores pregenerated narration audio (`full_website_read.mp3` & section clips); dynamic conversational speech is generated on-demand and streamed directly without backend disk persistence |
| Concurrency | Server-side bounded concurrency, request coalescing, queue timeout and rate limiting |
| Secrets | ElevenLabs API key stored only in server-side environment variables |
| Integration | A small API/adapter contract; do not assume access to the entire website codebase |


**Important:** provider plans, character quotas, request limits and concurrent-request limits change. Verify current limits in the actual ElevenLabs account and official documentation before launch. Do not hard-code a plan's assumed concurrency as a permanent fact.

## 3. Two user-facing modes

### Mode A — Chatbot Voice

**Purpose:** Speak the answer the chatbot has already produced.

Flow:
1. User submits a question to the existing chatbot.
2. Existing chatbot logic produces its normal text answer.
3. Display the answer as usual.
4. If voice output is enabled, pass the final answer text to the TTS manager.
5. The TTS manager checks cache, then requests audio from the backend if needed.
6. Backend returns audio or a structured error/fallback signal.
7. Play audio and expose stop/pause/resume controls where supported.
8. If neural TTS fails, use browser speech synthesis for that answer.

Rules:
- Text answers must continue to work when audio is disabled or fails.
- Do not send the user's question to TTS; speak the **answer**.
- Do not speak the same answer twice because of rerenders, retries, or duplicate events.
- Provide a user-controlled voice toggle. Do not unexpectedly autoplay audio on page load.
- If the answer changes, cancel or stop the old utterance before starting the new one.

### Mode B — Read Page

**Purpose:** Read the meaningful content of the current page on explicit user request.

Flow:
1. User selects **Read Page**.
2. The host page provides the relevant content, preferably from a known content container or structured page data.
3. Exclude navigation, buttons, cookie banners, hidden elements, decorative labels, repeated footer content and unrelated controls.
4. Normalize whitespace and divide long content into logical sections/chunks.
5. Generate or retrieve audio for each chunk.
6. Play chunks in order; allow pause/resume/stop.
7. If a chunk's neural audio cannot be generated, use browser speech synthesis for that chunk.
8. Stop playback when the user selects Stop or starts a conflicting audio session.

Rules:
- Never assume the entire DOM is safe or useful to read.
- Avoid reading hidden, duplicated, off-screen menu or accessibility-only text unless intentionally selected.
- Do not send arbitrary page content to the provider without checking that it is intended for speech.
- Support a configurable page-content selector/adapter instead of hard-coding unknown selectors.
- If no readable content is provided, show a helpful message rather than silently reading the whole page.

## 4. High-level architecture

```text
                      ANANTYA HOST WEBSITE
                               |
                    Host integration adapter
                               |
              +----------------+----------------+
              |                                 |
       Existing chatbot                   Page content provider
              |                                 |
       Final answer text                   Readable page text
              |                                 |
              +----------------+----------------+
                               |
                         TTS Manager
                               |
                         Cache lookup
                         /           \
                      HIT             MISS
                       |                |
                  Cached audio      TTS backend
                                        |
                              Validate + rate limit
                                        |
                              Cache/coalesce lookup
                                        |
                              Bounded work queue
                                        |
                                   ElevenLabs
                                        |
                               +--------+--------+
                               |                 |
                            Success            Failure
                               |                 |
                        Stream directly    Error handling
                       (No dynamic disk)
                               |                 |
                               +--------+--------+
                                        |
                                 Audio response
                                        |
                               Browser audio player
                                        |
                         Fallback: Web Speech API
```

The browser fallback is independent of the ElevenLabs quota and is intended to preserve basic functionality when the remote service is unavailable. Browser voice availability and quality vary by browser, operating system, and installed voices.

## 5. Recommended module boundaries

Adapt names and paths to the actual project; these are logical responsibilities, not a demand to create a specific framework layout.

### Frontend/client module
- `TTSManager`: unified interface for both modes.
- `ChatbotVoiceController`: sends chatbot answer text to TTS when voice is enabled.
- `PageReaderController`: accepts supplied page text and manages chunk playback.
- `AudioControls`: play/stop/pause/resume and status/error feedback.
- `BrowserSpeechProvider`: fallback implementation using Web Speech API.
- `TTSClient`: calls the project's backend endpoint.

### Backend/server module
- `POST /api/tts`: validate input, check pregenerated voice cache, coalesce identical in-flight work, enforce concurrency, call ElevenLabs, and stream audio directly to client without saving dynamic speech to disk.
- `GET /api/tts/page`: serve pregenerated complete website narration audio directly from `backend/data/audio_cache/full_website_read.mp3`.
- Optional `GET /api/tts/status`: only if operational status is genuinely needed; don't expose secrets or provider internals.
- Server-side provider adapter: isolates ElevenLabs-specific request/response handling.
- Audio cache adapter: dedicated to managing pregenerated voice assets on disk (not dynamic conversational responses).
- Queue/concurrency controller: limit active provider requests and reject or defer excess work safely.

If the existing project has no backend that you can modify, document the required server-side endpoint and build against a mock interface locally. Do **not** expose the ElevenLabs key in browser code as a shortcut.

## 6. Backend request/response contract

Illustrative request:

```json
{
  "text": "The registration deadline is Friday.",
  "mode": "chatbot",
  "voiceProfile": "anantya-assistant",
  "format": "mp3"
}
```

Allowed `mode` values: `chatbot`, `page`.

Illustrative success response:
- Preferred for modest, cached audio: `200` with `audio/mpeg` bytes and appropriate cache headers.
- Alternatively return a short-lived, authorized audio URL if using object storage.
- Do not return permanent public URLs for private or user-specific content.

Illustrative JSON error response:

```json
{
  "error": {
    "code": "TTS_BUSY",
    "message": "Voice is temporarily busy. Trying the browser voice instead."
  }
}
```

Suggested error codes:
- `INVALID_INPUT`
- `TEXT_TOO_LONG`
- `RATE_LIMITED`
- `TTS_BUSY`
- `PROVIDER_TIMEOUT`
- `PROVIDER_QUOTA_EXCEEDED`
- `PROVIDER_UNAVAILABLE`
- `AUDIO_GENERATION_FAILED`

Set and document an application-level maximum input size based on the selected provider/model. Split long page content into chunks rather than submitting a whole large page as one request.

## 7. Caching and duplicate-work prevention

### Cache key
Create a stable key from at least:
- normalized text (preserving meaningful punctuation),
- provider and model,
- voice ID/profile,
- output format and relevant voice settings,
- cache/schema version.

Do not normalize text so aggressively that different answers become the same key.

### Cache policy
- Page content: strong candidate for caching because many visitors hear the same content.
- Chatbot answers: cache only where answers are safe to reuse and are not user-specific, time-sensitive, personalized, or dependent on private data.
- Invalidate or version page-audio cache when page content, voice, model, or generation settings change.
- Store audio in an object store/CDN or suitable shared cache in production; an in-memory cache on one server is not shared across multiple instances and disappears on restart.
- Apply TTL, storage limits and cleanup. Respect provider terms and the project's privacy policy.

### Request coalescing
If multiple users request the exact same uncached audio at the same time, let one generation run and have equivalent requests await/share its result rather than generating duplicates.

## 8. Concurrency, queueing and rate limiting

- Enforce concurrency on the server, not only in the browser.
- Set the provider concurrency limit from verified account limits and leave headroom for other app usage.
- Queue only a bounded number of requests; do not allow an unlimited queue.
- Set queue wait and provider timeouts.
- When queue capacity is exceeded, return a structured busy/rate-limit response and use browser TTS.
- Apply exponential backoff with jitter to transient throttling/service errors; do not retry rapidly or indefinitely.
- Avoid automatic retries for invalid input, authentication failures, or exhausted account quota.
- Add per-session/IP or authenticated-user rate limits as appropriate, while accounting for campus/shared-network users behind one IP.
- Prevent a single user from creating many concurrent generations.
- Log latency, cache hit rate, provider error category and request counts without logging API keys or unnecessary personal text.

## 9. Fallback behavior

1. Try cached audio first.
2. If cache misses, try the server-side ElevenLabs path.
3. If provider is rate-limited, unavailable, times out, or quota is exhausted, use browser Web Speech API for that text.
4. If browser speech is unavailable, show the text and a clear non-blocking message; chatbot and navigation must continue to work.
5. Never leave controls stuck in a loading state. Always clean up pending requests and playback state.

Browser fallback example:

```javascript
export function speakWithBrowser(text, options = {}) {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    throw new Error("Browser speech synthesis is not supported.");
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = options.rate ?? 0.95;
  utterance.pitch = options.pitch ?? 0.9;
  utterance.volume = options.volume ?? 1;

  if (options.lang) {
    utterance.lang = options.lang;
  }

  window.speechSynthesis.speak(utterance);
  return utterance;
}
```

This is a fallback example, not a complete cross-browser playback manager. Browser `speechSynthesis` has its own pause/resume and event behavior that should be tested on supported browsers.

## 10. Voice profile: “JARVIS-like”

The desired direction is an **original** voice: calm, articulate, intelligent, polished, slightly deep, and futuristic. Do not assume that “JARVIS voice” means a particular provider has a licensed voice matching the fictional character. Do not clone or impersonate an actor without the necessary authorization.

Keep the voice provider settings in configuration:
- provider/model,
- voice ID,
- stability/style settings supported by the selected model,
- speaking rate and output format,
- configuration version.

Choose and test the final voice in the actual ElevenLabs account. Store the selected voice ID in server-side configuration, not scattered through frontend code. Browser fallback will not sound identical to the neural voice.

## 11. Security and privacy

- Keep the ElevenLabs API key server-side in environment variables/secrets management.
- Never put provider secrets in `VITE_*`, `NEXT_PUBLIC_*`, browser bundles, committed `.env` files, or client logs.
- Validate text length, mode, output settings and request origin/authentication as appropriate.
- Protect the endpoint against automated abuse and unexpectedly high costs.
- Use HTTPS in production.
- Do not log full chat answers or page text by default; log minimal operational metadata.
- Avoid caching personal/private chatbot answers in shared caches.
- Apply appropriate content handling and retention policies.
- Use provider APIs according to current terms and rate limits.

## 12. Accessibility and user experience

- Provide clear controls and visible states: Idle, Preparing audio, Playing, Paused, Fallback voice, and Error.
- Include Stop and a reliable way to cancel in-flight requests.
- Do not autoplay on initial page load.
- Ensure controls are keyboard accessible, have accessible names, and are usable on mobile.
- Do not rely on animation or color alone to indicate playback.
- Prevent overlapping playback: one active TTS session per browser tab by default. Starting one mode should stop the other unless product design explicitly decides otherwise.
- Respect reduced-motion settings for any synchronized effects.
- Keep the visible chatbot answer available while speech plays.

## 13. Observability and launch checks

Measure:
- cache hit/miss ratio,
- ElevenLabs success/failure rate by category,
- fallback activation rate,
- request latency and queue wait,
- rate-limit events,
- approximate character usage/cost,
- audio playback failures.

Before launch:
- Verify current provider plan, quotas, concurrency, model input size, voice rights and billing.
- Load-test simultaneous clicks and confirm duplicate requests coalesce.
- Confirm quota exhaustion and provider outage still trigger browser fallback.
- Confirm no API key appears in client assets or network requests to the browser.
- Test page-reader extraction on representative pages.
- Test current Chrome, Edge, Firefox and Safari versions that the project supports.
