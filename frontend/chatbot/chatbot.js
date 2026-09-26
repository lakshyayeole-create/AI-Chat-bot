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
    healthUrl: "http://localhost:8001/health",
    title: "ANANTYA '26 HUD",
    welcomeMessage:
      "**SYSTEM ONLINE.** Greetings! I am the **ANANTYA '26 Technical Symposium Assistant**.\n\nI have complete information on all events:\n- **She Solves 3.0** (Flagship Hackathon)\n- **BYTEME CTF '26** (Cybersecurity)\n- **Codigo 2026** (Competitive Programming)\n- **DecentraHACK** (Web3 & Blockchain)\n- **MasterChef UI 2026** (UI/UX & Frontend)\n- **IoThrone 2026** (IoT Hackathon)\n- **Make a Doodle** (Creative Arts)\n\nAsk me about any event's rules, team size, registration fees, eligibility, or prize pool!",
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
   * Initializes the chatbot widget upon DOM ready.
   */
  function init() {
    if (document.getElementById("anantya-hud-root")) return;

    injectHTML();
    cacheDOM();
    bindEvents();
    checkHealth();

    // Add initial greeting
    addMessage("assistant", CONFIG.welcomeMessage);
  }

  /**
   * Injects the complete launcher and HUD modal markup into document.body.
   */
  function injectHTML() {
    const root = document.createElement("div");
    root.id = "anantya-hud-root";
    root.innerHTML = `
      <!-- 1. Floating Circular Launcher -->
      <button class="anantya-hud-launcher" id="anantya-hud-launcher" aria-label="Open AI Event Assistant" title="Open Hologram Chatbot">
        <svg class="anantya-hud-launcher-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
          <path d="M2 12h20"></path>
        </svg>
        <span class="anantya-hud-status-badge" id="anantya-hud-badge"></span>
      </button>

      <!-- 2. Hologram HUD Window -->
      <div class="anantya-hud-window" id="anantya-hud-window" role="dialog" aria-modal="true" aria-label="Event Intelligence Chatbot">
        <div class="anantya-hud-scanlines"></div>

        <!-- Header -->
        <header class="anantya-hud-header">
          <div class="anantya-hud-brand">
            <div class="anantya-hud-core-orb"></div>
            <div class="anantya-hud-title-wrap">
              <h2 class="anantya-hud-title">${CONFIG.title}</h2>
              <div class="anantya-hud-subtitle">
                <span class="anantya-hud-live-dot" id="anantya-hud-live-dot"></span>
                <span id="anantya-hud-status-text">CONNECTING TO CORE...</span>
              </div>
            </div>
          </div>
          <div class="anantya-hud-header-actions">
            <button class="anantya-hud-btn-icon" id="anantya-hud-btn-clear" title="Clear Transmission History">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
            <button class="anantya-hud-btn-icon" id="anantya-hud-btn-close" title="Minimize Hologram HUD">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </header>

        <!-- Message Stream -->
        <div class="anantya-hud-stream" id="anantya-hud-stream"></div>

        <!-- Quick Query Chips Bar -->
        <div class="anantya-hud-chips-bar" id="anantya-hud-chips">
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
              placeholder="Query Anantya '26 database..." 
              autocomplete="off"
              maxlength="1000"
            />
            <button type="submit" class="anantya-hud-send-btn" id="anantya-hud-send" title="Transmit Query">
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
          ? "SYS: ONLINE • VECTOR DB READY"
          : "SYS: ONLINE • DB PENDING";
        return;
      }
    } catch (_) {
      // Backend offline
    }

    state.isOnline = false;
    dom.badge.classList.add("is-offline");
    dom.liveDot.classList.add("is-offline");
    dom.statusText.textContent = "BACKEND OFFLINE (PORT 8001)";
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
   * Sends user message to the backend RAG pipeline.
   */
  async function sendUserMessage(message) {
    addMessage("user", message);
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
      setLoading(false);
      addMessage("assistant", data.answer || "No response received.", data.sources || []);
    } catch (err) {
      setLoading(false);
      const isConnectionError =
        err.name === "TypeError" || err.message.includes("Failed to fetch");

      let errorMsg = `**TRANSMISSION FAILED**: ${err.message}`;
      if (isConnectionError) {
        errorMsg =
          "**ERROR**: Unable to connect to FastAPI backend at `http://localhost:8001`.\n\n" +
          "**Troubleshooting**:\n" +
          "1. Open your terminal in `backend/`\n" +
          "2. Start server: `uvicorn app.main:app --reload --port 8001`\n" +
          "3. Verify vector store: `python scripts/ingest.py`";
      }
      addMessage("assistant", errorMsg);
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
   * Toggles the loading visualizer state.
   */
  function setLoading(loading) {
    state.isLoading = loading;
    dom.sendBtn.disabled = loading;
    dom.input.disabled = loading;

    const existingViz = document.getElementById("anantya-hud-active-viz");
    if (loading && !existingViz) {
      const viz = document.createElement("div");
      viz.id = "anantya-hud-active-viz";
      viz.className = "anantya-hud-visualizer";
      viz.innerHTML = `
        <div class="anantya-hud-bars">
          <span class="anantya-hud-bar"></span>
          <span class="anantya-hud-bar"></span>
          <span class="anantya-hud-bar"></span>
        </div>
        <span>DECODING TRANSMISSION STREAM...</span>
      `;
      dom.stream.appendChild(viz);
      scrollToBottom();
    } else if (!loading && existingViz) {
      existingViz.remove();
      dom.input.focus();
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
