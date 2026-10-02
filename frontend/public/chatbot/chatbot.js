/**
 * ============================================================================
 * ANANTYA '26 HOLOGRAM CHATBOT HUD — JAVASCRIPT MODULE
 * Standalone, self-mounting widget. Connects to FastAPI POST /api/chat.
 * Integrated with ElevenLabs Neural Voice + Browser Speech Fallback (TTS).
 * ============================================================================
 */
(function () {
  "use strict";

  // Configuration
  const CONFIG = {
    apiUrl: "http://localhost:8001/api/chat",
    statusUrl: "http://localhost:8001/api/chat/status",
    healthUrl: "http://localhost:8001/health",
    ttsUrl: "http://localhost:8001/api/tts",
    title: "ANANTYA '26 JARVIS",
    welcomeMessage:
      "👋 **Hello and welcome!** I am **Anantya's Jarvis**, your official AI assistant for **Anantya '26**, the annual technical and creative symposium organized by the Department of Computer Engineering at PCCOE.\n\nI can help you with complete details on all 7 events:\n- **BYTE ME CTF '26** (Cybersecurity)\n- **Codigo 2026** (Competitive Programming)\n- **SHE SOLVES 3.0** (Women-Oriented Hackathon)\n- **DECENTRAHACK 2.0** (Web3 & AI Hackathon)\n- **MasterChef UI 2026** (UI/UX Design)\n- **IoThrone 2026** (IoT & Robotics Hackathon)\n- **MAKE A DOODLE! 2026** (Digital Art Competition)\n\nAsk me about registration links, rules, eligibility, team sizes, fees, dates, or prize pools!",
    quickChips: [
      "What events are in Anantya '26?",
      "Tell me about BYTEME CTF",
      "Tell me about Codigo 2026",
      "Tell me about She Solves 3.0",
      "Tell me about DecentraHACK",
      "What is MasterChef UI?",
      "Tell me about IoThrone",
      "What is Make a Doodle?",
    ],
  };

  // State
  const state = {
    isOpen: false,
    isLoading: false,
    isOnline: false,
    messages: [],
    voiceEnabled: localStorage.getItem("anantya_voice_enabled") === "true",
    activeSpeechSessionId: 0,
    ttsState: "idle", // "idle" | "loading" | "playing" | "paused"
    isPaused: false,
  };

  // DOM Elements cache
  let dom = {};

  /**
   * Cleans markdown syntax out of text for spoken speech.
   */
  function cleanMarkdownForSpeech(text) {
    if (!text) return "";
    return text
      .replace(/[*#_`~>]/g, "")
      .replace(/\[(.*?)\]\(.*?\)/g, "$1")
      .replace(/https?:\/\/\S+/g, "")
      .replace(/^[•\-+]\s+/gm, "")
      .replace(/\n+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Extracts readable visible content from the main host webpage.
   * Excludes navigation, forms, buttons, hidden sections, and chatbot HUD.
   */
  function extractReadableContent() {
    const root =
      document.querySelector("main") ||
      document.querySelector('[role="main"]') ||
      document.querySelector("article") ||
      document.getElementById("root") ||
      document.body;

    if (!root) return [];

    const ignoredTags = new Set([
      "SCRIPT", "STYLE", "NOSCRIPT", "SVG", "NAV", "FOOTER",
      "BUTTON", "INPUT", "TEXTAREA", "SELECT", "HEADER", "FORM", "IFRAME"
    ]);

    const paragraphs = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
      acceptNode(node) {
        if (ignoredTags.has(node.tagName)) return NodeFilter.FILTER_REJECT;
        if (node.id === "anantya-hud-root" || node.closest("#anantya-hud-root")) {
          return NodeFilter.FILTER_REJECT;
        }
        if (node.getAttribute("aria-hidden") === "true") return NodeFilter.FILTER_REJECT;

        // Skip visually hidden elements
        const style = window.getComputedStyle(node);
        if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
          return NodeFilter.FILTER_REJECT;
        }

        // Accept heading and paragraph-like elements
        if (/^(H1|H2|H3|H4|H5|H6|P|LI|BLOCKQUOTE)$/.test(node.tagName)) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      },
    });

    let current;
    while ((current = walker.nextNode())) {
      const text = cleanMarkdownForSpeech(current.innerText || current.textContent);
      if (text.length > 20) {
        paragraphs.push(text);
      }
    }

    if (paragraphs.length === 0) {
      // Fallback: try capturing text from any visible container
      const genericText = cleanMarkdownForSpeech(root.innerText);
      if (genericText.length > 30) {
        paragraphs.push(genericText.slice(0, 1000));
      }
    }

    // Chunk paragraphs into <= 250-word segments
    const chunks = [];
    let currentChunk = "";

    for (const p of paragraphs) {
      const combined = currentChunk ? `${currentChunk} ${p}` : p;
      if (combined.split(/\s+/).length > 200) {
        if (currentChunk) chunks.push(currentChunk);
        currentChunk = p;
      } else {
        currentChunk = combined;
      }
    }
    if (currentChunk) chunks.push(currentChunk);

    return chunks;
  }

  /**
   * Unified Text-to-Speech Manager
   * Primary: ElevenLabs neural backend API
   * Fallback: Browser Web Speech API
   * Enforces single active session, pause/resume, and stop across tab.
   */
  const ttsManager = {
    currentAudio: null,
    currentBlobUrl: null,
    currentUtterance: null,
    isSpeakingWithBrowser: false,

    stop() {
      state.activeSpeechSessionId++;
      state.ttsState = "idle";
      state.isPaused = false;

      // Stop Audio element
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        this.currentAudio = null;
      }
      if (this.currentBlobUrl) {
        URL.revokeObjectURL(this.currentBlobUrl);
        this.currentBlobUrl = null;
      }

      // Stop browser speech synthesis
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      this.currentUtterance = null;
      this.isSpeakingWithBrowser = false;

      this.updateUI();
    },

    togglePause() {
      if (state.ttsState === "playing") {
        this.pause();
      } else if (state.ttsState === "paused") {
        this.resume();
      }
    },

    pause() {
      if (state.ttsState !== "playing") return;
      state.ttsState = "paused";
      state.isPaused = true;

      if (this.currentAudio) {
        this.currentAudio.pause();
      } else if (this.isSpeakingWithBrowser && "speechSynthesis" in window) {
        window.speechSynthesis.pause();
      }
      this.updateUI();
    },

    resume() {
      if (state.ttsState !== "paused") return;
      state.ttsState = "playing";
      state.isPaused = false;

      if (this.currentAudio) {
        this.currentAudio.play().catch(() => {});
      } else if (this.isSpeakingWithBrowser && "speechSynthesis" in window) {
        window.speechSynthesis.resume();
      }
      this.updateUI();
    },

    updateUI(label = null) {
      if (!dom.audioBar) return;

      if (state.ttsState === "playing" || state.ttsState === "paused" || state.ttsState === "loading") {
        dom.audioBar.style.display = "flex";
        if (label) dom.audioLabel.textContent = label;

        if (state.ttsState === "paused") {
          dom.audioBar.classList.add("is-paused");
          dom.audioPauseBtn.textContent = "Resume";
        } else {
          dom.audioBar.classList.remove("is-paused");
          dom.audioPauseBtn.textContent = "Pause";
        }
      } else {
        dom.audioBar.style.display = "none";
        dom.audioBar.classList.remove("is-paused");
      }
    },

    /**
     * Speaks the final chatbot answer once (Mode A).
     */
    async speakAnswer(text) {
      if (!state.voiceEnabled) return;

      const cleanText = cleanMarkdownForSpeech(text);
      if (!cleanText) return;

      this.stop();
      const sessionId = ++state.activeSpeechSessionId;
      state.ttsState = "loading";
      this.updateUI("JARVIS • Preparing Voice...");

      await this.playText(cleanText, sessionId, "chatbot", "JARVIS • Speaking Answer");
    },

    /**
     * Reads visible page content aloud sequentially (Mode B).
     */
    async readPage() {
      const chunks = extractReadableContent();
      if (!chunks || chunks.length === 0) {
        addMessage(
          "assistant",
          "🔍 **No readable page content found.** Please navigate to an event or information section on the page and try again."
        );
        return;
      }

      this.stop();
      const sessionId = ++state.activeSpeechSessionId;
      state.ttsState = "loading";
      this.updateUI(`Reading Page • Chunk 1 of ${chunks.length}...`);

      for (let i = 0; i < chunks.length; i++) {
        if (state.activeSpeechSessionId !== sessionId) break;

        const label = `Reading Page • ${i + 1}/${chunks.length}`;
        this.updateUI(label);

        await new Promise((resolve) => {
          this.playText(chunks[i], sessionId, "page", label, resolve);
        });

        // Small pause between chunks
        if (state.activeSpeechSessionId === sessionId) {
          await new Promise((r) => setTimeout(r, 400));
        }
      }

      if (state.activeSpeechSessionId === sessionId) {
        this.stop();
      }
    },

    /**
     * Core playback routine: tries ElevenLabs backend first, falls back to Web Speech API.
     */
    async playText(text, sessionId, mode = "chatbot", label = "JARVIS Voice", onDone = null) {
      try {
        const res = await fetch(CONFIG.ttsUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: text,
            mode: mode,
            format: "mp3",
          }),
        });

        // If session became stale while waiting for response, abort
        if (state.activeSpeechSessionId !== sessionId) {
          if (onDone) onDone();
          return;
        }

        if (res.ok) {
          const blob = await res.blob();
          if (blob.size > 0 && state.activeSpeechSessionId === sessionId) {
            this.playBlob(blob, sessionId, label, onDone);
            return;
          }
        }
      } catch (err) {
        // Network / service error -> proceed to browser fallback
      }

      // Fallback path: Browser Web Speech API
      if (state.activeSpeechSessionId === sessionId) {
        this.speakWithBrowser(text, sessionId, `${label} (Browser Fallback)`, onDone);
      } else if (onDone) {
        onDone();
      }
    },

    playBlob(blob, sessionId, label, onDone) {
      if (this.currentBlobUrl) {
        URL.revokeObjectURL(this.currentBlobUrl);
      }

      this.currentBlobUrl = URL.createObjectURL(blob);
      const audio = new Audio(this.currentBlobUrl);
      this.currentAudio = audio;
      this.isSpeakingWithBrowser = false;

      audio.onplay = () => {
        if (state.activeSpeechSessionId !== sessionId) {
          audio.pause();
          return;
        }
        state.ttsState = "playing";
        this.updateUI(label);
      };

      audio.onended = () => {
        if (state.activeSpeechSessionId === sessionId) {
          state.ttsState = "idle";
          this.updateUI();
        }
        if (onDone) onDone();
      };

      audio.onerror = () => {
        if (state.activeSpeechSessionId === sessionId) {
          state.ttsState = "idle";
          this.updateUI();
        }
        if (onDone) onDone();
      };

      audio.play().catch(() => {
        // Autoplay policy or playback failure -> try browser speech
        if (state.activeSpeechSessionId === sessionId) {
          this.speakWithBrowser(cleanMarkdownForSpeech(label), sessionId, label, onDone);
        } else if (onDone) {
          onDone();
        }
      });
    },

    speakWithBrowser(text, sessionId, label, onDone) {
      if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
        state.ttsState = "idle";
        this.updateUI();
        if (onDone) onDone();
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      this.currentUtterance = utterance;
      this.isSpeakingWithBrowser = true;

      // Select a clear English voice if available
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        const preferred =
          voices.find((v) => /Daniel|David|Oliver|Arthur|Google UK English Male/i.test(v.name)) ||
          voices.find((v) => v.lang.startsWith("en"));
        if (preferred) utterance.voice = preferred;
      }

      utterance.rate = 1.0;
      utterance.pitch = 0.95;

      utterance.onstart = () => {
        if (state.activeSpeechSessionId !== sessionId) {
          window.speechSynthesis.cancel();
          return;
        }
        state.ttsState = "playing";
        this.updateUI(label);
      };

      utterance.onend = () => {
        if (state.activeSpeechSessionId === sessionId) {
          state.ttsState = "idle";
          this.updateUI();
        }
        if (onDone) onDone();
      };

      utterance.onerror = () => {
        if (state.activeSpeechSessionId === sessionId) {
          state.ttsState = "idle";
          this.updateUI();
        }
        if (onDone) onDone();
      };

      window.speechSynthesis.speak(utterance);
    },
  };

  /**
   * Automatically loads chatbot.css if not already present on the page.
   */
  function ensureStylesLoaded() {
    if (document.querySelector('link[href*="chatbot.css"]')) return;

    let cssHref = "chatbot/chatbot.css";
    const currentScript =
      document.currentScript ||
      document.querySelector('script[src*="chatbot.js"]');
    if (currentScript && currentScript.src) {
      cssHref = currentScript.src.replace(/chatbot\.js(\?.*)?$/, "chatbot.css$1");
    }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = cssHref;
    document.head.appendChild(link);
  }

  /**
   * Initializes the chatbot widget upon DOM ready.
   */
  function init() {
    if (document.getElementById("anantya-hud-root")) return;

    ensureStylesLoaded();
    injectHTML();
    cacheDOM();
    bindEvents();
    checkHealth();

    // Add initial greeting
    addMessage("assistant", CONFIG.welcomeMessage);
  }

  function getReactorImageUrl() {
    const currentScript =
      document.currentScript ||
      document.querySelector('script[src*="chatbot.js"]');
    if (currentScript && currentScript.src) {
      try {
        return new URL("1351322.webp", currentScript.src).href;
      } catch (_) {}
    }
    return "/assets/1351322.webp";
  }

  /**
   * Injects the complete launcher and HUD modal markup into document.body.
   */
  function injectHTML() {
    const reactorImgSrc = getReactorImageUrl();
    const root = document.createElement("div");
    root.id = "anantya-hud-root";
    root.setAttribute("data-lenis-prevent", "true");
    root.innerHTML = `
      <!-- 1. Floating Circular Launcher (Iron Man Arc Reactor) -->
      <button class="anantya-hud-launcher" id="anantya-hud-launcher" aria-label="Open Anantya's Jarvis" title="Open Anantya's Jarvis Arc Reactor">
        <div class="anantya-hud-launcher-core">
          <img 
            class="anantya-hud-launcher-reactor" 
            src="${reactorImgSrc}" 
            alt="Jarvis Arc Reactor"
            loading="eager"
            onerror="if(this.dataset.err!=='1'){this.dataset.err='1';this.src='/assets/1351322.webp';}else if(this.dataset.err==='1'){this.dataset.err='2';this.src='chatbot/1351322.webp';}"
          />
          <div class="anantya-hud-reactor-glow"></div>
        </div>
        <span class="anantya-hud-status-badge" id="anantya-hud-badge"></span>
      </button>

      <!-- 2. Hologram HUD Window -->
      <div class="anantya-hud-window" id="anantya-hud-window" data-lenis-prevent="true" role="dialog" aria-modal="true" aria-label="Anantya's Jarvis Event Assistant">
        <div class="anantya-hud-scanlines"></div>

        <!-- Header -->
        <header class="anantya-hud-header">
          <div class="anantya-hud-brand">
            <div class="anantya-hud-core-orb">
              <img 
                class="anantya-hud-header-reactor" 
                src="${reactorImgSrc}" 
                alt="Arc Reactor Core"
                loading="eager"
                onerror="if(this.dataset.err!=='1'){this.dataset.err='1';this.src='/assets/1351322.webp';}else if(this.dataset.err==='1'){this.dataset.err='2';this.src='chatbot/1351322.webp';}"
              />
            </div>
            <div class="anantya-hud-title-wrap">
              <h2 class="anantya-hud-title">${CONFIG.title}</h2>
              <div class="anantya-hud-subtitle">
                <span class="anantya-hud-live-dot" id="anantya-hud-live-dot"></span>
                <span id="anantya-hud-status-text">Connecting...</span>
              </div>
            </div>
          </div>
          <div class="anantya-hud-header-actions">
            <!-- Read Page Aloud -->
            <button class="anantya-hud-btn-icon" id="anantya-hud-btn-read-page" title="Read Current Page Aloud (TTS)" aria-label="Read Current Page Aloud">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
              </svg>
            </button>
            <!-- Voice Output Toggle -->
            <button class="anantya-hud-btn-icon ${state.voiceEnabled ? "is-active" : ""}" id="anantya-hud-btn-voice" title="Toggle Assistant Voice (JARVIS)" aria-label="Toggle Assistant Voice">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
              </svg>
            </button>
            <!-- Clear Chat -->
            <button class="anantya-hud-btn-icon" id="anantya-hud-btn-clear" title="Clear Chat" aria-label="Clear Chat">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
            <!-- Close HUD -->
            <button class="anantya-hud-btn-icon" id="anantya-hud-btn-close" title="Close" aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </header>

        <!-- Audio HUD Playback Status Bar -->
        <div class="anantya-hud-audio-bar" id="anantya-hud-audio-bar" style="display: none;">
          <div class="anantya-hud-audio-info">
            <div class="anantya-hud-waveform">
              <span class="anantya-hud-wave-bar"></span>
              <span class="anantya-hud-wave-bar"></span>
              <span class="anantya-hud-wave-bar"></span>
              <span class="anantya-hud-wave-bar"></span>
            </div>
            <span id="anantya-hud-audio-label">JARVIS Voice Active</span>
          </div>
          <div class="anantya-hud-audio-controls">
            <button class="anantya-hud-audio-btn" id="anantya-hud-audio-pause-btn" title="Pause or Resume Speech">Pause</button>
            <button class="anantya-hud-audio-btn" id="anantya-hud-audio-stop-btn" title="Stop Speech">Stop</button>
          </div>
        </div>

        <!-- Message Stream -->
        <div class="anantya-hud-stream" id="anantya-hud-stream" data-lenis-prevent="true"></div>

        <!-- Quick Query Chips Bar -->
        <div class="anantya-hud-chips-bar" id="anantya-hud-chips" data-lenis-prevent="true">
          ${CONFIG.quickChips
            .map(
              (chip) => `<button class="anantya-hud-chip" data-prompt="${chip}">${chip}</button>`
            )
            .join("")}
        </div>

        <!-- Input Deck -->
        <footer class="anantya-hud-input-deck">
          <form class="anantya-hud-input-box" id="anantya-hud-form">
            <input 
              type="text" 
              class="anantya-hud-input" 
              id="anantya-hud-input" 
              placeholder="Ask anything about Anantya '26 events..." 
              autocomplete="off"
              maxlength="1000"
            />
            <button type="submit" class="anantya-hud-send-btn" id="anantya-hud-send" title="Send Message">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </form>
        </footer>
      </div>
    `;

    document.body.appendChild(root);
  }

  /**
   * Caches references to injected DOM elements.
   */
  function cacheDOM() {
    dom.launcher = document.getElementById("anantya-hud-launcher");
    dom.badge = document.getElementById("anantya-hud-badge");
    dom.window = document.getElementById("anantya-hud-window");
    dom.stream = document.getElementById("anantya-hud-stream");
    dom.chips = document.getElementById("anantya-hud-chips");
    dom.form = document.getElementById("anantya-hud-form");
    dom.input = document.getElementById("anantya-hud-input");
    dom.sendBtn = document.getElementById("anantya-hud-send");
    dom.btnClear = document.getElementById("anantya-hud-btn-clear");
    dom.btnClose = document.getElementById("anantya-hud-btn-close");
    dom.btnVoice = document.getElementById("anantya-hud-btn-voice");
    dom.btnReadPage = document.getElementById("anantya-hud-btn-read-page");
    dom.audioBar = document.getElementById("anantya-hud-audio-bar");
    dom.audioLabel = document.getElementById("anantya-hud-audio-label");
    dom.audioPauseBtn = document.getElementById("anantya-hud-audio-pause-btn");
    dom.audioStopBtn = document.getElementById("anantya-hud-audio-stop-btn");
    dom.liveDot = document.getElementById("anantya-hud-live-dot");
    dom.statusText = document.getElementById("anantya-hud-status-text");
  }

  /**
   * Binds user event listeners.
   */
  function bindEvents() {
    dom.launcher.addEventListener("click", toggleHUD);
    dom.btnClose.addEventListener("click", closeHUD);
    dom.btnClear.addEventListener("click", clearChat);
    dom.form.addEventListener("submit", handleSubmit);

    // TTS Buttons
    dom.btnVoice.addEventListener("click", toggleVoice);
    dom.btnReadPage.addEventListener("click", () => {
      openHUD();
      ttsManager.readPage();
    });
    dom.audioPauseBtn.addEventListener("click", () => ttsManager.togglePause());
    dom.audioStopBtn.addEventListener("click", () => ttsManager.stop());

    // Quick chips
    dom.chips.addEventListener("click", function (e) {
      const chip = e.target.closest(".anantya-hud-chip");
      if (chip && !state.isLoading) {
        const prompt = chip.getAttribute("data-prompt");
        if (prompt) {
          sendUserMessage(prompt);
        }
      }
    });

    // Close HUD on Escape
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && state.isOpen) {
        closeHUD();
      }
    });

    // Isolate scrolling to chatbot window only when hovering
    dom.window.addEventListener("mouseenter", function () {
      if (window.__lenis && state.isOpen) {
        window.__lenis.stop();
      }
    });

    dom.window.addEventListener("mouseleave", function () {
      if (window.__lenis) {
        window.__lenis.start();
      }
    });

    // Strictly trap wheel events inside the chatbot window
    dom.window.addEventListener(
      "wheel",
      function (e) {
        // Prevent event from bubbling to window / Lenis / ScrollTrigger
        e.stopPropagation();

        const stream = dom.stream;
        const chips = dom.chips;
        const target = e.target;

        // 1. If scrolling over message stream
        if (stream && (stream.contains(target) || target === stream)) {
          const delta = e.deltaY;
          const isAtTop = stream.scrollTop <= 0 && delta < 0;
          const isAtBottom =
            stream.scrollTop + stream.clientHeight >= stream.scrollHeight - 1 &&
            delta > 0;

          // If at boundary, prevent default so the outer webpage doesn't scroll chain
          if (isAtTop || isAtBottom) {
            e.preventDefault();
          }
          return;
        }

        // 2. If scrolling over quick chips bar horizontally
        if (chips && (chips.contains(target) || target === chips)) {
          if (chips.scrollWidth > chips.clientWidth) {
            chips.scrollLeft += e.deltaY;
            e.preventDefault();
            return;
          }
        }

        // 3. If scrolling over header, input, or any other part of HUD window,
        // prevent page scrolling entirely
        e.preventDefault();
      },
      { passive: false }
    );

    // Trap touchmove events on mobile/tablets
    dom.window.addEventListener(
      "touchmove",
      function (e) {
        e.stopPropagation();
        const stream = dom.stream;
        if (!stream || (!stream.contains(e.target) && e.target !== stream)) {
          e.preventDefault();
        }
      },
      { passive: false }
    );

    // Global click listener for website triggers & click-outside-to-close
    document.addEventListener(
      "click",
      function (e) {
        const isClickInsideWindow = dom.window && dom.window.contains(e.target);
        const isClickOnLauncher = dom.launcher && dom.launcher.contains(e.target);
        const openBtn = e.target.closest("[data-action='open-chatbot']");
        const readBtn = e.target.closest("[data-action='read-page']");
        const queryBtn = e.target.closest("[data-query]");

        // If clicking on external triggers
        if (openBtn) {
          e.preventDefault();
          openHUD();
          return;
        }

        if (readBtn) {
          e.preventDefault();
          openHUD();
          ttsManager.readPage();
          return;
        }

        if (queryBtn) {
          e.preventDefault();
          const query = queryBtn.getAttribute("data-query");
          openHUD();
          if (query) {
            sendUserMessage(query);
          }
          return;
        }

        // When the chatbot is open, clicking on any part of the website outside the chatbot area closes it
        if (state.isOpen && !isClickInsideWindow && !isClickOnLauncher) {
          closeHUD();
        }
      },
      true // capture phase ensures reliability even if website elements prevent bubbling
    );
  }

  /**
   * Toggles assistant voice output mode.
   */
  function toggleVoice() {
    state.voiceEnabled = !state.voiceEnabled;
    localStorage.setItem("anantya_voice_enabled", String(state.voiceEnabled));

    if (state.voiceEnabled) {
      dom.btnVoice.classList.add("is-active");
      dom.btnVoice.title = "Assistant Voice Active (Click to mute)";
      // Speak brief confirmation
      ttsManager.speakAnswer("Voice mode activated. I am ready.");
    } else {
      dom.btnVoice.classList.remove("is-active");
      dom.btnVoice.title = "Toggle Assistant Voice (JARVIS)";
      ttsManager.stop();
    }
  }

  /**
   * Polls the backend health check endpoint.
   */
  async function checkHealth() {
    try {
      const res = await fetch(CONFIG.healthUrl, { method: "GET" });
      if (res.ok) {
        const data = await res.json();
        state.isOnline = true;
        const vsLoaded = data.vector_store === "loaded";
        dom.badge.classList.remove("is-offline");
        dom.liveDot.classList.remove("is-offline");
        dom.statusText.textContent = vsLoaded
          ? "Online • Jarvis Ready"
          : "Online • Loading Events";
        return;
      }
    } catch (_) {
      // Backend offline
    }

    state.isOnline = false;
    dom.badge.classList.add("is-offline");
    dom.liveDot.classList.add("is-offline");
    dom.statusText.textContent = "Offline • Reconnecting...";
  }

  /**
   * Toggles HUD window open/closed state.
   */
  function toggleHUD() {
    if (state.isOpen) {
      closeHUD();
    } else {
      openHUD();
    }
  }

  function openHUD() {
    state.isOpen = true;
    dom.window.classList.add("is-active");
    dom.launcher.classList.add("is-open");
    checkHealth();
    setTimeout(() => dom.input.focus(), 250);
  }

  function closeHUD() {
    state.isOpen = false;
    dom.window.classList.remove("is-active");
    dom.launcher.classList.remove("is-open");
    if (window.__lenis) {
      window.__lenis.start();
    }
  }

  /**
   * Handles user submission.
   */
  function handleSubmit(e) {
    e.preventDefault();
    if (state.isLoading) return;

    const message = dom.input.value.trim();
    if (!message) return;

    dom.input.value = "";
    sendUserMessage(message);
  }

  /**
   * Creates a WhatsApp-style three-dot typing indicator assistant message.
   */
  function createTypingMessage() {
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const msgEl = document.createElement("div");
    msgEl.className = "anantya-hud-msg assistant is-typing";

    const meta = document.createElement("div");
    meta.className = "anantya-hud-msg-meta";
    meta.textContent = `ANANTYA JARVIS • ${time}`;
    msgEl.appendChild(meta);

    const bubble = document.createElement("div");
    bubble.className = "anantya-hud-bubble";
    bubble.innerHTML = `
      <div class="anantya-hud-typing-dots">
        <span class="anantya-hud-typing-dot"></span>
        <span class="anantya-hud-typing-dot"></span>
        <span class="anantya-hud-typing-dot"></span>
      </div>
    `;
    msgEl.appendChild(bubble);
    return msgEl;
  }

  /**
   * Replaces the typing indicator inside msgEl with the assistant response.
   */
  function updateTypingMessage(msgEl, text, sources = []) {
    msgEl.classList.remove("is-typing");
    const bubble = msgEl.querySelector(".anantya-hud-bubble");
    if (!bubble) return;
    bubble.innerHTML = formatMarkdown(text);

    if (sources && sources.length > 0) {
      const sourcesWrap = document.createElement("div");
      sourcesWrap.className = "anantya-hud-sources";
      sources.forEach((src) => {
        const chip = document.createElement("span");
        chip.className = "anantya-hud-source-chip";
        chip.title = `Source: ${src.source_file || "Official Anantya Knowledge Base"}`;
        chip.innerHTML = `◈ ${src.event_name || "Event Document"}`;
        sourcesWrap.appendChild(chip);
      });
      bubble.appendChild(sourcesWrap);
    }
    scrollToBottom();
  }

  /**
   * Polls the backend job status endpoint until completion or timeout.
   */
  async function pollForJobCompletion(jobId, typingMsgEl) {
    const maxAttempts = 100;
    const pollInterval = 600;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      try {
        const res = await fetch(`${CONFIG.statusUrl}/${jobId}`, { method: "GET" });
        if (!res.ok) {
          continue;
        }

        const data = await res.json();
        if (data.status === "completed") {
          const finalAnswer = data.answer || "No response received.";
          updateTypingMessage(typingMsgEl, finalAnswer, data.sources || []);
          ttsManager.speakAnswer(finalAnswer);
          return;
        } else if (data.status === "failed") {
          updateTypingMessage(
            typingMsgEl,
            "I'm having trouble retrieving that information right now. Please try asking again in a moment, or check with our event coordinators!",
            []
          );
          return;
        }
      } catch (err) {
        // Transient network glitch during polling -> retry
      }
    }

    updateTypingMessage(
      typingMsgEl,
      "Retrieving this information is taking a bit longer than usual. Please try asking again shortly, or explore our other event details!",
      []
    );
  }

  /**
   * Sends user message to the backend pipeline.
   * Handles:
   * - Immediate WhatsApp-style typing indicator
   * - Cache hit: immediate answer replaces typing indicator
   * - Cache miss: queued -> poll while typing indicator animates -> answer replaces typing indicator
   */
  async function sendUserMessage(message) {
    // Immediately stop any active speech when a new user query begins
    ttsManager.stop();

    addMessage("user", message);

    const typingMsgEl = createTypingMessage();
    dom.stream.appendChild(typingMsgEl);
    scrollToBottom();
    setLoading(true);

    try {
      const response = await fetch(CONFIG.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message }),
      });

      if (!response.ok) {
        let errorDetail = `HTTP Error ${response.status}`;
        try {
          const errData = await response.json();
          if (errData.detail) errorDetail = errData.detail;
        } catch (_) {}
        throw new Error(errorDetail);
      }

      const data = await response.json();

      // Case 1: CACHE HIT → Immediate answer
      if (data.answer) {
        updateTypingMessage(typingMsgEl, data.answer, data.sources || []);
        setLoading(false);
        ttsManager.speakAnswer(data.answer);
        return;
      }

      // Case 2: CACHE MISS → Queued for worker
      if (data.status === "queued" && data.job_id) {
        await pollForJobCompletion(data.job_id, typingMsgEl);
        setLoading(false);
        return;
      }

      // Fallback
      const fallbackAnswer = data.answer || "No response received.";
      updateTypingMessage(typingMsgEl, fallbackAnswer, data.sources || []);
      setLoading(false);
      ttsManager.speakAnswer(fallbackAnswer);

    } catch (err) {
      setLoading(false);
      const isConnectionError =
        err.name === "TypeError" || err.message.includes("Failed to fetch");

      let errorMsg = "I'm having trouble retrieving that information right now. Please try asking again in a moment!";
      if (isConnectionError) {
        errorMsg =
          "**Assistant Offline**: Unable to connect to the Anantya '26 assistant service. Please ensure the backend is running and try again shortly.";
      }
      updateTypingMessage(typingMsgEl, errorMsg, []);
      checkHealth();
    }
  }

  /**
   * Formats markdown-like text to safe HTML.
   */
  function formatMarkdown(text) {
    if (!text) return "";

    // Escape basic HTML
    let escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Bold: **text**
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

    // Inline code: `code`
    escaped = escaped.replace(
      /`([^`]+)`/g,
      '<code style="background:rgba(0,243,255,0.1);padding:1px 5px;border-radius:3px;color:#00f3ff;font-family:monospace;">$1</code>'
    );

    // Bullet points: lines starting with "- " or "* "
    const lines = escaped.split("\n");
    let inList = false;
    let html = "";

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        if (!inList) {
          html += "<ul>";
          inList = true;
        }
        html += `<li>${trimmed.substring(2)}</li>`;
      } else {
        if (inList) {
          html += "</ul>";
          inList = false;
        }
        if (trimmed === "") {
          html += "<br/>";
        } else {
          html += `<p>${line}</p>`;
        }
      }
    });

    if (inList) html += "</ul>";
    return html;
  }

  /**
   * Appends a message bubble into the stream.
   */
  function addMessage(role, text, sources = []) {
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const isUser = role === "user";

    const msgEl = document.createElement("div");
    msgEl.className = `anantya-hud-msg ${isUser ? "user" : "assistant"}`;

    const meta = document.createElement("div");
    meta.className = "anantya-hud-msg-meta";
    meta.textContent = isUser ? `OPERATIVE • ${time}` : `ANANTYA CORE • ${time}`;
    msgEl.appendChild(meta);

    const bubble = document.createElement("div");
    bubble.className = "anantya-hud-bubble";
    bubble.innerHTML = formatMarkdown(text);

    // Append source citations if available
    if (sources && sources.length > 0) {
      const sourcesWrap = document.createElement("div");
      sourcesWrap.className = "anantya-hud-sources";
      sources.forEach((src) => {
        const chip = document.createElement("span");
        chip.className = "anantya-hud-source-chip";
        chip.title = `Source: ${src.source_file || "Official Anantya Knowledge Base"}`;
        chip.innerHTML = `◈ ${src.event_name || "Event Document"}`;
        sourcesWrap.appendChild(chip);
      });
      bubble.appendChild(sourcesWrap);
    }

    msgEl.appendChild(bubble);
    dom.stream.appendChild(msgEl);
    scrollToBottom();
  }

  /**
   * Toggles the loading state of input controls.
   */
  function setLoading(loading) {
    state.isLoading = loading;
    dom.sendBtn.disabled = loading;
    dom.input.disabled = loading;
    if (!loading) {
      setTimeout(() => dom.input.focus(), 100);
    }
  }

  /**
   * Clears conversation stream and adds welcome note back.
   */
  function clearChat() {
    ttsManager.stop();
    dom.stream.innerHTML = "";
    addMessage("assistant", CONFIG.welcomeMessage);
  }

  /**
   * Scrolls stream to the latest transmission.
   */
  function scrollToBottom() {
    dom.stream.scrollTop = dom.stream.scrollHeight;
  }

  // Auto-init when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Expose global API for host website integration
  window.AnantyaChatbot = {
    open: openHUD,
    close: closeHUD,
    toggle: toggleHUD,
    send: sendUserMessage,
    tts: {
      speakAnswer: (t) => ttsManager.speakAnswer(t),
      readPage: () => ttsManager.readPage(),
      pause: () => ttsManager.pause(),
      resume: () => ttsManager.resume(),
      stop: () => ttsManager.stop(),
      toggleVoice: toggleVoice,
    },
  };
})();
