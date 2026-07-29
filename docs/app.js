const API_BASE_URL = location.hostname.endsWith("github.io")
  ? "https://atlantic-coast-tours.onrender.com"
  : location.origin;

const conversation = document.querySelector("#conversation");
const form = document.querySelector("#chat-form");
const textarea = document.querySelector("#message");
const sendButton = document.querySelector("#send-button");
const suggestions = document.querySelector("#suggestions");
const newChatButton = document.querySelector("#new-chat");

const initialGreeting =
  "Hello. Where would you like the Atlantic to take you? I can check live tours, prices, spaces, special offers, and local forecasts.";
let history = [];
let pending = false;

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await sendMessage(textarea.value);
});

textarea.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

textarea.addEventListener("input", resizeTextarea);

suggestions.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  await sendMessage(button.textContent.trim());
});

newChatButton.addEventListener("click", resetConversation);

async function sendMessage(rawMessage) {
  const message = String(rawMessage || "").trim();
  if (!message || pending) return;

  pending = true;
  setBusy(true);
  suggestions.hidden = true;
  appendMessage("user", message);
  textarea.value = "";
  resizeTextarea();

  const typing = appendTypingMessage();
  const statusMessages = [
    "Checking the live sources",
    "Reading the latest tour details",
    "Putting the answer together"
  ];
  let statusIndex = 0;
  const statusTimer = setInterval(() => {
    statusIndex = (statusIndex + 1) % statusMessages.length;
    const label = typing.querySelector(".typing-status");
    if (label) label.textContent = statusMessages[statusIndex];
  }, 1_400);

  try {
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || "The assistant could not respond.");
    }

    history.push({ role: "user", content: message });
    history.push({ role: "assistant", content: body.reply });
    history = history.slice(-10);
    replaceTypingMessage(typing, body.reply, body.evidence || []);
  } catch (error) {
    replaceTypingMessage(
      typing,
      error.message ||
        "I could not reach the live service. Please try again in a moment.",
      [],
      true
    );
  } finally {
    clearInterval(statusTimer);
    pending = false;
    setBusy(false);
    textarea.focus();
  }
}

function appendMessage(role, text, evidence = [], isError = false) {
  const message = document.createElement("div");
  message.className = `message ${role}-message${isError ? " error-message" : ""}`;

  const label = document.createElement("div");
  label.className = "message-label";
  label.textContent = role === "user" ? "You" : "Maeve";

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.textContent = text;

  message.append(label, bubble);
  if (evidence.length) {
    message.append(createEvidence(evidence));
  }
  conversation.append(message);
  scrollConversation();
  return message;
}

function appendTypingMessage() {
  const message = document.createElement("div");
  message.className = "message assistant-message typing-message";

  const label = document.createElement("div");
  label.className = "message-label";
  label.textContent = "Maeve";

  const bubble = document.createElement("div");
  bubble.className = "message-bubble typing-bubble";

  const status = document.createElement("span");
  status.className = "typing-status";
  status.textContent = "Checking the live sources";

  const dots = document.createElement("span");
  dots.className = "typing-dots";
  dots.setAttribute("aria-hidden", "true");
  dots.innerHTML = "<i></i><i></i><i></i>";

  bubble.append(status, dots);
  message.append(label, bubble);
  conversation.append(message);
  scrollConversation();
  return message;
}

function replaceTypingMessage(element, text, evidence, isError = false) {
  const replacement = appendMessage("assistant", text, evidence, isError);
  element.replaceWith(replacement);
  scrollConversation();
}

function createEvidence(evidence) {
  const line = document.createElement("div");
  line.className = "evidence";

  const sources = [...new Set(evidence.map((item) => item.source))];
  const latest = evidence
    .map((item) => new Date(item.fetchedAt))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((left, right) => right - left)[0];

  const time = latest
    ? latest.toLocaleTimeString("en-IE", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Dublin"
      })
    : "";

  line.textContent = `Checked live: ${sources.join(" + ")}${time ? ` at ${time}` : ""}`;
  return line;
}

function resetConversation() {
  history = [];
  conversation.innerHTML = "";
  appendMessage("assistant", initialGreeting);
  suggestions.hidden = false;
  textarea.value = "";
  resizeTextarea();
  textarea.focus();
}

function setBusy(value) {
  textarea.disabled = value;
  sendButton.disabled = value;
  sendButton.textContent = value ? "Checking..." : "Send";
}

function resizeTextarea() {
  textarea.style.height = "auto";
  textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
}

function scrollConversation() {
  requestAnimationFrame(() => {
    conversation.scrollTo({
      top: conversation.scrollHeight,
      behavior: "smooth"
    });
  });
}

