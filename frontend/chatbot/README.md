# Anantya '26 Jarvis — Chatbot Frontend Module

This directory contains the **completely isolated, self-contained frontend module** for **Anantya's Jarvis**.

It is designed to be **100% decoupled from the website**. You can completely redesign, replace, or update the website UI (HTML, CSS, JS, React, Vue, WordPress, etc.) without altering any code in this folder.

---

## 📁 Folder Structure

```text
frontend/
├── chatbot/               <-- 🤖 CHATBOT ONLY (DO NOT MODIFY WHEN CHANGING WEBSITE UI)
│   ├── chatbot.js         <-- Self-mounting widget, API client, HUD markup
│   ├── chatbot.css        <-- Hologram HUD stylesheet (namespaced under .anantya-hud-*)
│   ├── 1351322.webp       <-- Iron Man Arc Reactor launcher icon asset
│   └── README.md          <-- This guide
│
├── public/                <-- 🌐 Static assets served by Vite
│   └── chatbot/           <-- Mirrored chatbot assets served at root /chatbot/
├── src/                   <-- ⚛️ React 18 + Three.js Website source code
└── index.html             <-- 🌐 Main Website entrypoint
```

---

## 🚀 How to Embed the Chatbot in ANY Website Page

To include the chatbot in any HTML page (current or newly created), simply add this **single line** right before the closing `</body>` tag:

```html
<script src="chatbot/chatbot.js" defer></script>
```

That's it! When `chatbot.js` runs, it will **automatically**:
1. Inject its own stylesheet (`chatbot.css`) into `<head>`.
2. Inject the floating circular button (bottom-right) and the Hologram HUD modal into `<body>`.
3. Connect to the FastAPI backend at `http://localhost:8001`.
4. Handle typing indicators, animations, polling, and Markdown rendering.

*(Optional: You can also explicitly include `<link rel="stylesheet" href="chatbot/chatbot.css" />` in your `<head>` if you prefer preloading styles).*

---

## 🎯 How to Trigger the Chatbot from Your Website UI

You can add buttons anywhere in your website to open the chatbot or trigger specific questions. **No custom JavaScript is required** — just use HTML data attributes:

### 1. Open the Chatbot
Add `data-action="open-chatbot"` to any button or link:
```html
<button data-action="open-chatbot">
  Ask Anantya's Jarvis
</button>
```

### 2. Open and Ask a Specific Question
Add `data-query="Your Question Here"` to any button:
```html
<button data-query="What are the rules and team size for She Solves 3.0?">
  Ask About She Solves 3.0
</button>

<button data-query="What is the prize pool for DecentraHACK?">
  Check DecentraHACK Prizes
</button>
```

---

## 🛠️ Global JavaScript API (Optional)

If your website scripts ever need programmatic control, the chatbot exposes a global `window.AnantyaChatbot` object:

```javascript
// Open the chatbot HUD
window.AnantyaChatbot.open();

// Close the chatbot HUD
window.AnantyaChatbot.close();

// Toggle open / closed
window.AnantyaChatbot.toggle();

// Send a question programmatically
window.AnantyaChatbot.send("What are the dates for Anantya '26?");
```

---

## 🛡️ Style Isolation Guarantee

All CSS rules inside `chatbot.css` are strictly scoped under the `.anantya-hud-*` namespace:
- It **does not reset** any global HTML tags (`body`, `p`, `a`, `button`, `h1-h6`).
- Your website CSS will **never break the chatbot**, and the chatbot will **never break your website UI**.
