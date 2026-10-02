/**
 * ============================================================================
 * ANANTYA '26 HOLOGRAM CHATBOT HUD — JAVASCRIPT MODULE
 * Standalone, self-mounting widget. Connects to FastAPI POST /api/chat.
 * ============================================================================
 */
(function () {
  "use strict";

  // Configuration
  const CONFIG = {
    apiUrl: "http://localhost:8001/api/chat",
    statusUrl: "http://localhost:8001/api/chat/status",
    healthUrl: "http://localhost:8001/health",
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
  };

  // DOM Elements cache
  let dom = {};

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
            <button class="anantya-hud-btn-icon" id="anantya-hud-btn-clear" title="Clear Chat">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
            <button class="anantya-hud-btn-icon" id="anantya-hud-btn-close" title="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </header>

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
        const queryBtn = e.target.closest("[data-query]");

        // If clicking on external triggers
        if (openBtn) {
          e.preventDefault();
          openHUD();
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
    const maxAttempts = 100; // 60 seconds (100 * 600ms)
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
          updateTypingMessage(typingMsgEl, data.answer || "No response received.", data.sources || []);
          return;
        } else if (data.status === "failed") {
          updateTypingMessage(typingMsgEl, "I'm having trouble retrieving that information right now. Please try asking again in a moment, or check with our event coordinators!", []);
          return;
        }
        // status is "queued" or "processing" -> continue polling while typing indicator animates
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
    addMessage("user", message);

    // Create and attach WhatsApp-style animated 3-dot typing indicator immediately
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
        return;
      }

      // Case 2: CACHE MISS → Queued for worker
      if (data.status === "queued" && data.job_id) {
        await pollForJobCompletion(data.job_id, typingMsgEl);
        setLoading(false);
        return;
      }

      // Fallback
      updateTypingMessage(typingMsgEl, data.answer || "No response received.", data.sources || []);
      setLoading(false);

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
        chip.title = `Source File: ${src.source_file || "knowledge base"}`;
        chip.innerHTML = `◈ ${src.event_id || "SRC"} • ${src.event_name || "Event Document"}`;
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

  // Expose global API for the website to interact with if needed
  window.AnantyaChatbot = {
    open: openHUD,
    close: closeHUD,
    toggle: toggleHUD,
    send: sendUserMessage,
  };
})();
