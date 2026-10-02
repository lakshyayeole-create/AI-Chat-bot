/**
 * ============================================================================
 * ANANTYA '26 HOLOGRAM CHATBOT HUD — JAVASCRIPT MODULE
 * Standalone, self-mounting widget. Connects to FastAPI POST /api/chat.
 * Integrated with ElevenLabs Neural Voice + Browser Speech Fallback (TTS).
 * ============================================================================
 */
(function () {
  "use strict";

  // Base API configuration (Render Cloud Backend with Localhost Fallback)
  const isLocal = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  const BACKEND_BASE = (
    (typeof window !== "undefined" && window.ANANTYA_API_URL) ||
    (isLocal ? "http://localhost:8001" : "https://anantya-ai-backend-3rje.onrender.com")
  ).replace(/\/+$/, "");

  // Configuration
  const CONFIG = {
    apiUrl: `${BACKEND_BASE}/api/chat`,
    statusUrl: `${BACKEND_BASE}/api/chat/status`,
    healthUrl: `${BACKEND_BASE}/health`,
    ttsUrl: `${BACKEND_BASE}/api/tts`,
    title: "ANANTYA '26 JARVIS",
    welcomeMessage:
      "👋 **Hello and welcome!** I am **Anantya's Jarvis**, your official AI assistant for **Anantya '26**, the annual technical and creative symposium organized by the Department of Computer Engineering at PCCOE.\n\nI can help you with complete details on all 8 events:\n- **BYTE ME CTF '26** (Cybersecurity)\n- **Codigo 2026** (Competitive Programming)\n- **SHE SOLVES 3.0** (Women-Oriented Hackathon)\n- **DECENTRAHACK 2.0** (Web3 & AI Hackathon)\n- **MasterChef UI 2026** (UI/UX Design)\n- **IoThrone 2026** (IoT & Robotics Hackathon)\n- **MAKE A DOODLE! 2026** (Digital Art Competition)\n- **INNOVATE-X** (Final-Year Capstone Project & Architecture Showcase)\n\nAsk me about registration links, rules, eligibility, team sizes, fees, dates, or prize pools!",
    quickChips: [
      "What events are in Anantya '26?",
      "Tell me about INNOVATE-X",
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

  // Browser Speech Voices Preload Cache
  let cachedBrowserVoices = [];
  function populateVoices() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      cachedBrowserVoices = window.speechSynthesis.getVoices() || [];
    }
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    populateVoices();
    window.speechSynthesis.onvoiceschanged = populateVoices;
  }

  function getBestBrowserVoice() {
    const voices =
      cachedBrowserVoices.length > 0
        ? cachedBrowserVoices
        : typeof window !== "undefined" && "speechSynthesis" in window
        ? window.speechSynthesis.getVoices()
        : [];
    if (!voices || voices.length === 0) return null;
    return (
      voices.find((v) =>
        /Google UK English Male|Google US English|Natural|Daniel|Oliver|George|Guy|David|Arthur/i.test(
          v.name
        )
      ) ||
      voices.find((v) => v.lang === "en-GB" || v.lang === "en-US") ||
      voices.find((v) => v.lang.startsWith("en")) ||
      voices[0]
    );
  }

  /**
   * Cleans markdown syntax, emojis, URLs, and symbols for natural, fluent speech.
   */
  function cleanMarkdownForSpeech(text) {
    if (!text) return "";

    let s = text;

    // 1. Remove all emojis & graphical symbols
    s = s.replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{2B55}\u{2934}\u{2935}\u{25AA}\u{25AB}\u{25FE}\u{25FD}\u{25FC}\u{25FB}\u{25B6}\u{25C0}\u{1F004}\u{1F0CF}\u{200D}\u{FE0F}]/gu,
      ""
    );
    s = s.replace(/[◈◆◇○●■□►▻•★☆※]/g, "");

    // 2. Remove markdown images and URLs cleanly, keep link anchor text
    s = s.replace(/!\[.*?\]\(.*?\)/g, "");
    s = s.replace(/\[(.*?)\]\(.*?\)/g, "$1");
    s = s.replace(/https?:\/\/\S+/g, "");

    // 3. Currency, quantities, and symbols expansion for natural voice cadence
    s = s.replace(/₹\s*([0-9.]+)\s*(?:lakh|lakhs|LAKH|Lakh)\b/gi, "$1 Lakh Rupees");
    s = s.replace(/₹\s*([0-9.]+)\s*(?:k|K)\b/g, "$1 thousand Rupees");
    s = s.replace(/₹\s*([0-9,.]+)/g, "$1 Rupees");
    s = s.replace(/([0-9]+)\s*\/\s*(team|person|participant|head|member)/gi, "$1 per $2");

    s = s.replace(/\s*\|\s*/g, ", ");
    s = s.replace(/&amp;/g, " and ");
    s = s.replace(/&/g, " and ");
    s = s.replace(/\+/g, " plus");
    s = s.replace(/~/g, "");
    s = s.replace(/[_*`#]/g, "");

    // 4. Line-by-line sentence restructuring for natural breathing pauses
    const rawLines = s.split(/\r?\n/);
    const cleaned = [];

    for (let line of rawLines) {
      line = line.trim();
      if (!line) continue;

      // Strip leading list bullet marks: -, *, +, or 1., 2.
      line = line.replace(/^[-*+]\s+/, "").replace(/^\d+[\.\)]\s+/, "").trim();
      if (!line) continue;

      // Skip standalone prompt markers
      if (/^(link|registration|website|register):\s*$/i.test(line)) continue;

      // Ensure every independent bullet or line ends with a pause punctuation
      if (!/[.?!:;,]$/.test(line)) {
        line += ".";
      }
      cleaned.push(line);
    }

    return cleaned.join(" ").replace(/\s+/g, " ").trim();
  }

  /**
   * Extracts complete readable content covering the entire Anantya webpage from start to finish.
   * Walks through:
   * 1. Hero Introduction & Symposium theme
   * 2. Marvel Multiverse Arenas & 3D character showcases
   * 3. All 8 Events in the Multiverse Timeline (with domains, organizers, and prizes)
   * 4. Central Command, Coordination, and Contact details
   * 5. Closing & Host credits
   * Splits into natural, complete-sentence speech chunks (~250-320 chars) ideal for ElevenLabs disk caching.
   */
  function extractReadableContent() {
    const segments = [];

    // Optional contextual note if an event card or modal is currently open on screen
    const activeCard = document.querySelector(".event-card, .event-card-content, .all-events-modal");
    if (activeCard && activeCard.offsetHeight > 0) {
      const titleEl = activeCard.querySelector(".event-name, h2, h3");
      const categoryEl = activeCard.querySelector(".event-category");
      const orgEl = activeCard.querySelector(".organizer-badge, .organizer");
      const descEl = activeCard.querySelector(".event-card-desc, p");
      const title = titleEl ? titleEl.textContent.trim() : "";
      if (title) {
        let cardIntro = `Currently highlighting ${title}. `;
        if (categoryEl) cardIntro += `Category: ${categoryEl.textContent.trim()}. `;
        if (orgEl) cardIntro += `Organized by ${orgEl.textContent.trim()}. `;
        if (descEl) cardIntro += `${descEl.textContent.trim()} `;
        segments.push(cardIntro);
      }
    }

    // 1. Page Beginning: Welcome & Symposium Overview
    segments.push(
      "Welcome to Anantya 2026, the Annual National Technical Symposium organized by the Department of Computer Engineering at Pimpri Chinchwad College of Engineering, Pune."
    );
    segments.push(
      "Step into the Multiverse of Technology, Innovation, and Interdisciplinary Excellence from October 6 to October 10, 2026."
    );

    // 2. Multiverse Timeline — All 8 Official Events
    segments.push(
      "Here are the eight official events of Anantya 2026."
    );
    segments.push(
      "Event 1: DecentraHack 2.0. A 3-round Web3, Blockchain, Agentic AI, and Open Source Hackathon presented by the LFDT Student Chapter. Teams of 2 to 4 members compete for a 15,000 rupee prize pool."
    );
    segments.push(
      "Event 2: She Solves 3.0. The premier women-oriented hackathon organized by ACM-W PCCOE, empowering female developers to build impactful solutions with a 16,000 rupee prize pool."
    );
    segments.push(
      "Event 3: BYTE ME CTF '26. A national-level Capture The Flag cybersecurity competition organized by OWASP PCCOE, featuring Web Security, OSINT, Cryptography, and Forensics with 1.5 Lakhs in prizes."
    );
    segments.push(
      "Event 4: IoThrone 2026. Hardware and prototype innovation hackathon organized by IRIS PCCOE, integrating IoT, Edge AI, Computer Vision, and Robotics with a 15,000 rupee prize pool."
    );
    segments.push(
      "Event 5: MasterChef UI. A 3-round UI/UX and frontend design competition organized by GDGC PCCOE, testing designers on rapid prototyping and user experience with a 12,000 rupee prize pool."
    );
    segments.push(
      "Event 6: Make a Doodle 2026. A creative digital art and illustration challenge organized by the Computer Department Art Circle, celebrating artistic creativity with a 13,000 rupee prize pool."
    );
    segments.push(
      "Event 7: Codigo 2026. An ICPC-style 3-round competitive programming contest organized by CESA-SDW and ACM PCCOE, testing algorithmic speed and DSA with an 18,000 rupee prize pool."
    );
    segments.push(
      "Event 8: INNOVATE-X. The flagship B.Tech final-year capstone project presentation and system architecture showcase, organized by the Department of Computer Engineering across all student chapters. Round 1 online PPT evaluation on October 6, and Round 2 offline final presentation on October 10 with a 12,000 rupee prize pool. Participation is compulsory for all final-year students."
    );

    // 4. Central Command, Coordination, and Contact
    segments.push(
      "Anantya Central Command is located at PCCOE Sector 26, Pradhikaran, Nigdi, Pune. Connect with student coordinators Divya Ughade, Aditi Joshi, and Srushti Argade, or transmit an encrypted message directly through our contact terminal."
    );

    // 5. Page End: Closing
    segments.push(
      "Anantya 2026 is brought to you by CESA, ACM, ACM-W, OWASP, GDGC, LFDT and IRIS at PCCOE. We look forward to welcoming you to the Multiverse of Technology!"
    );

    // Natural speech chunking: split into chunks bounded by complete sentences (~250-320 chars)
    const chunks = [];
    let currentChunk = "";

    for (const seg of segments) {
      const cleanSeg = cleanMarkdownForSpeech(seg);
      if (!cleanSeg) continue;
      const withPunct = /[.?!:;]$/.test(cleanSeg) ? cleanSeg : `${cleanSeg}.`;
      if ((currentChunk + " " + withPunct).length > 320) {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = withPunct;
      } else {
        currentChunk = currentChunk ? `${currentChunk} ${withPunct}` : withPunct;
      }
    }
    if (currentChunk) chunks.push(currentChunk.trim());

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
    currentUtterances: [],
    isSpeakingWithBrowser: false,
    keepAliveInterval: null,

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
      if (this.keepAliveInterval) {
        clearInterval(this.keepAliveInterval);
        this.keepAliveInterval = null;
      }
      this.currentUtterances = [];
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
     * Speaks the final chatbot answer once (Mode A: when voice is toggled on).
     */
    async speakAnswer(text) {
      if (!state.voiceEnabled) return;
      return this.speakSingleAnswer(text);
    },

    /**
     * Speaks a specific text unconditionally (used by voice mode and message listen button).
     */
    async speakSingleAnswer(text) {
      const cleanText = cleanMarkdownForSpeech(text);
      if (!cleanText) return;

      this.stop();
      const sessionId = ++state.activeSpeechSessionId;
      state.ttsState = "loading";
      this.updateUI("JARVIS • Preparing Voice...");

      await this.playText(cleanText, sessionId, "chatbot", "JARVIS • Speaking Answer");
    },

    /**
     * Reads complete website audio from start to end directly from cached audio.
     */
    async readPage() {
      this.stop();
      const sessionId = ++state.activeSpeechSessionId;
      state.ttsState = "loading";
      this.updateUI("Anantya '26 • Loading Complete Website Narration...");

      try {
        // Stream complete pre-generated website audio directly
        // Try backend cache first with timestamp to bypass stale browser cache, then fallback to public static audio
        let res = await fetch(`${CONFIG.ttsUrl}/page?t=${Date.now()}`, { method: "GET" }).catch(() => null);
        if (!res || !res.ok) {
          res = await fetch(`/full_website_read.mp3?t=${Date.now()}`, { method: "GET" }).catch(() => null);
        }

        if (state.activeSpeechSessionId !== sessionId) return;

        if (res && res.ok) {
          const blob = await res.blob();
          if (blob.size > 0 && state.activeSpeechSessionId === sessionId) {
            this.playBlob(
              blob,
              "Welcome to Anantya 2026, the Annual National Technical Symposium organized by the Department of Computer Engineering at PCCOE Pune...",
              sessionId,
              "Anantya '26 • Complete Website Narration",
              () => {
                if (state.activeSpeechSessionId === sessionId) {
                  this.stop();
                }
              }
            );
            return;
          }
        }
      } catch (err) {
        console.warn("[TTS] Could not fetch cached full website audio directly, falling back to chunked extraction:", err);
      }

      // Fallback: sequential chunk playback if needed
      const chunks = extractReadableContent();
      if (!chunks || chunks.length === 0) {
        addMessage(
          "assistant",
          "🔍 **No readable page content found.** Please navigate to an event or information section on the page and try again."
        );
        return;
      }

      for (let i = 0; i < chunks.length; i++) {
        if (state.activeSpeechSessionId !== sessionId) break;

        const label = `Reading Page • ${i + 1} of ${chunks.length}`;
        this.updateUI(label);

        await new Promise((resolve) => {
          this.playText(chunks[i], sessionId, "page", label, resolve);
        });

        // Small pause between chunks
        if (state.activeSpeechSessionId === sessionId) {
          await new Promise((r) => setTimeout(r, 250));
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

        if (state.activeSpeechSessionId !== sessionId) {
          if (onDone) onDone();
          return;
        }

        if (res.ok) {
          const blob = await res.blob();
          if (blob.size > 0 && state.activeSpeechSessionId === sessionId) {
            this.playBlob(blob, text, sessionId, label, onDone);
            return;
          }
        }
      } catch (err) {
        // Backend / network error -> fall back to browser speech
      }

      // Fallback path: Browser Web Speech API
      if (state.activeSpeechSessionId === sessionId) {
        this.speakWithBrowser(text, sessionId, `${label} (Browser Voice)`, onDone);
      } else if (onDone) {
        onDone();
      }
    },

    playBlob(blob, originalText, sessionId, label, onDone) {
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
          // Playback failed -> try browser speech with the actual text
          this.speakWithBrowser(originalText, sessionId, label, onDone);
        } else if (onDone) {
          onDone();
        }
      };

      audio.play().catch(() => {
        // Autoplay policy or playback failure -> try browser speech with the actual text
        if (state.activeSpeechSessionId === sessionId) {
          this.speakWithBrowser(originalText, sessionId, label, onDone);
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
      this.isSpeakingWithBrowser = true;

      // Chrome Speech Synthesis Keepalive: ping every 10 seconds to avoid 14-second cutoff
      if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = setInterval(() => {
        if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }
      }, 10000);

      // Split into sentences for robust browser speech
      const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
      const selectedVoice = getBestBrowserVoice();
      let currentIndex = 0;

      const speakNextSentence = () => {
        if (state.activeSpeechSessionId !== sessionId) {
          window.speechSynthesis.cancel();
          if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
          if (onDone) onDone();
          return;
        }

        if (currentIndex >= sentences.length) {
          state.ttsState = "idle";
          this.updateUI();
          if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
          if (onDone) onDone();
          return;
        }

        const sentenceText = sentences[currentIndex++].trim();
        if (!sentenceText) {
          speakNextSentence();
          return;
        }

        const utterance = new SpeechSynthesisUtterance(sentenceText);
        if (selectedVoice) utterance.voice = selectedVoice;
        utterance.rate = 1.0;
        utterance.pitch = 0.95;

        // Keep reference in array to avoid Chrome garbage collection bug
        this.currentUtterances.push(utterance);

        utterance.onstart = () => {
          if (state.activeSpeechSessionId !== sessionId) {
            window.speechSynthesis.cancel();
            return;
          }
          state.ttsState = "playing";
          this.updateUI(label);
        };

        utterance.onend = () => {
          const idx = this.currentUtterances.indexOf(utterance);
          if (idx !== -1) this.currentUtterances.splice(idx, 1);
          speakNextSentence();
        };

        utterance.onerror = (e) => {
          const idx = this.currentUtterances.indexOf(utterance);
          if (idx !== -1) this.currentUtterances.splice(idx, 1);

          if (e.error === "canceled" || e.error === "interrupted") {
            return;
          }

          if (currentIndex < sentences.length && state.activeSpeechSessionId === sessionId) {
            speakNextSentence();
          } else {
            state.ttsState = "idle";
            this.updateUI();
            if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
            if (onDone) onDone();
          }
        };

        window.speechSynthesis.speak(utterance);
      };

      speakNextSentence();
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

        // 3. If scrolling over header, input, or any other part of HUD window
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
      true
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
      ttsManager.speakSingleAnswer("Voice mode activated. I am ready.");
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

    // Attach listen button to message header
    const meta = msgEl.querySelector(".anantya-hud-msg-meta");
    if (meta && !meta.querySelector(".anantya-hud-msg-listen-btn")) {
      const listenBtn = document.createElement("button");
      listenBtn.className = "anantya-hud-msg-listen-btn";
      listenBtn.title = "Read this answer aloud (JARVIS)";
      listenBtn.setAttribute("aria-label", "Listen to answer");
      listenBtn.innerHTML = `
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
        </svg>
        <span>Listen</span>
      `;
      listenBtn.addEventListener("click", () => {
        ttsManager.speakSingleAnswer(text);
      });
      meta.appendChild(listenBtn);
    }

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

    let escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    escaped = escaped.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

    escaped = escaped.replace(
      /`([^`]+)`/g,
      '<code style="background:rgba(0,243,255,0.1);padding:1px 5px;border-radius:3px;color:#00f3ff;font-family:monospace;">$1</code>'
    );

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

    // Add listen button for assistant messages
    if (!isUser) {
      const listenBtn = document.createElement("button");
      listenBtn.className = "anantya-hud-msg-listen-btn";
      listenBtn.title = "Read this answer aloud (JARVIS)";
      listenBtn.setAttribute("aria-label", "Listen to answer");
      listenBtn.innerHTML = `
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
        </svg>
        <span>Listen</span>
      `;
      listenBtn.addEventListener("click", () => {
        ttsManager.speakSingleAnswer(text);
      });
      meta.appendChild(listenBtn);
    }

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
      speakAnswer: (t) => ttsManager.speakSingleAnswer(t),
      readPage: () => ttsManager.readPage(),
      pause: () => ttsManager.pause(),
      resume: () => ttsManager.resume(),
      stop: () => ttsManager.stop(),
      toggleVoice: toggleVoice,
    },
  };
})();
