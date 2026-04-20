/**
 * chatbot.js
 * AI chatbot powered by Google Gemini API
 *
 * Semester 1: Uses Gemini API with rep's bio/party/state as context
 * Semester 2: Will be replaced with GraphRAG grounded in Neo4j
 *             co-sponsorship graph for queries like:
 *             "Which senators support AI research for NY?"
 *
 * Depends on: repcard.js (currentRep, aiHistory)
 */

const GEMINI_KEY   = "AIzaSyA6XLmH4TyqZgtQHRyqJk2i55DmZk8_bgk";
const GEMINI_MODEL = "gemini-3-flash-preview";
const GEMINI_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;

/**
 * Sets up the AI chatbot suggestion chips for a representative
 * @param {object} rep - Representative data object
 */
function setupChatbot(rep) {
  document.getElementById("ai-subheading").textContent = `Ask anything about ${rep.name || "this representative"}`;
  document.getElementById("ai-msgs").innerHTML = "";

  const name = rep.name || "this representative";
  const last = name.split(" ").slice(-2,-1)[0] || name.split(" ").pop();

  const chipQuestions = [
    `What are ${last}'s key positions?`,
    `What committees does ${last} serve on?`,
    `What has ${last} sponsored?`,
    `Tell me about ${last}'s background`
  ];

  const chipsContainer = document.getElementById("ai-chips");
  chipsContainer.innerHTML = chipQuestions.map((q,i) =>
    `<button class="ai-chip" data-idx="${i}">${q}</button>`
  ).join("");

  // Use event listeners instead of inline onclick for reliability
  chipsContainer.querySelectorAll(".ai-chip").forEach((btn, i) => {
    btn.addEventListener("click", function(e) {
      e.preventDefault();
      e.stopPropagation();
      askAI(chipQuestions[i]);
    });
  });
}

/**
 * Sends a question to the Gemini API and displays the response
 * @param {string|null} q - Question text, or null to read from input field
 */
async function askAI(q) {
  if (!q) q = document.getElementById("ai-input").value.trim();
  if (!q) return;
  document.getElementById("ai-input").value = "";

  const msgs = document.getElementById("ai-msgs");
  msgs.innerHTML += `<div class="ai-msg user">${q}</div>
                     <div class="ai-msg bot loading" id="ai-loading">Thinking...</div>`;
  msgs.scrollTop = msgs.scrollHeight;

  // Add to conversation history
  aiHistory.push({ role:"user", parts:[{ text:q }] });

  // Build system prompt with rep's known data as context
  const rep = currentRep;
  const systemPrompt = `You are a helpful assistant answering questions about ${rep.name||"this US Congress member"}.
Known info — Party: ${rep.party||"?"}, State: ${rep.state||"?"}, District: ${rep.district||"N/A"}, Birth: ${rep.birth||"?"}, Bio: ${rep.bio||"Not available"}.
Be concise and factual. If unsure, say so.`;

  // Build full conversation contents
  const fullContents = aiHistory.length === 1
    ? [{ role:"user", parts:[{ text: systemPrompt + "\n\n" + q }] }]
    : [{ role:"user", parts:[{ text: systemPrompt }] }, ...aiHistory];

  try {
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ contents: fullContents })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(err);
    }

    const data = await res.json();
    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, no response.";

    // Add response to history
    aiHistory.push({ role:"model", parts:[{ text:answer }] });

    // Render markdown bold (**text**) and newlines
    const formatted = answer
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");

    document.getElementById("ai-loading").remove();
    msgs.innerHTML += `<div class="ai-msg bot">${formatted}</div>`;
    msgs.scrollTop = msgs.scrollHeight;

  } catch(e) {
    document.getElementById("ai-loading").remove();
    msgs.innerHTML += `<div class="ai-msg bot">Error: ${e.message}</div>`;
  }
}

// Wire up Ask button and Enter key
document.getElementById("ai-btn").addEventListener("click", () => askAI(null));
document.getElementById("ai-input").addEventListener("keydown", e => {
  if (e.key === "Enter") askAI(null);
});
