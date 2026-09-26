/**
 * ============================================================================
 * ANANTYA '26 EVENT WEBSITE — JAVASCRIPT
 * Handles website interactions and communicates cleanly with the Chatbot API.
 * ============================================================================
 */

document.addEventListener("DOMContentLoaded", () => {
  // Bind all buttons that trigger the Hologram Chatbot
  const assistantTriggers = document.querySelectorAll("[data-action='open-chatbot']");
  assistantTriggers.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      if (window.AnantyaChatbot && typeof window.AnantyaChatbot.open === "function") {
        window.AnantyaChatbot.open();
      }
    });
  });

  // Query-specific buttons (e.g. "Ask details about She Solves 3.0")
  const queryTriggers = document.querySelectorAll("[data-query]");
  queryTriggers.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const query = btn.getAttribute("data-query");
      if (window.AnantyaChatbot) {
        window.AnantyaChatbot.open();
        if (query && typeof window.AnantyaChatbot.send === "function") {
          window.AnantyaChatbot.send(query);
        }
      }
    });
  });

  // Smooth scroll for internal links
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      const targetId = this.getAttribute("href");
      if (targetId && targetId !== "#") {
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
          e.preventDefault();
          targetElement.scrollIntoView({ behavior: "smooth" });
        }
      }
    });
  });
});
