/**
 * @fileoverview AI chatbot powered by Google Gemini API for the US Congress Map.
 *
 * Semester 1 (current): Uses Gemini API with representative biographical data as context.
 * Semester 2 (planned): Will be replaced with GraphRAG grounded in the Neo4j
 * Senate co-sponsorship graph, enabling queries like:
 * "Which senators support AI research for New York?"
 *
 * @requires repcard.js - currentRep, aiHistory
 * @author Aditi Reddy Doma
 * @version 2.0.0
 */

/**
 * Google Gemini API key.
 * For the public GitHub repo this is set to a placeholder.
 * The live staging site uses the real key stored in AWS S3.
 * @constant {string}
 */
const GEMINI_KEY = "YOUR_GEMINI_API_KEY_HERE";

/**
 * Gemini model identifier.
 * @constant {string}
 */
const GEMINI_MODEL = "gemini-3-flash-preview";

/**
 * Full Gemini API endpoint URL with key interpolated.
 * @constant {string}
 */
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;

/**
 * Sets up the AI chatbot suggestion chips for a representative.
 * Generates four context-aware chip questions using the representative's last name.
 * Uses addEventListener (not inline onclick) for reliable cross-browser click handling.
 *
 * @param {Object} rep - Representative data object
 * @param {string} rep.name - Full name of the representative
 */
function setupChatbot(rep) {
  document.getElementById("ai-subheading").textContent = `Ask anything about ${rep.name||"this representative"}`;

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

  chipsContainer.querySelectorAll(".ai-chip").forEach((btn, i) => {
    btn.addEventListener("click", function(e) {
      e.preventDefault();
      e.stopPropagation();
      askAI(chipQuestions[i]);
    });
  });
}

/**
 * Sends a question to the Gemini API and displays the response in the chat window.
 * Maintains multi-turn conversation history in the aiHistory array.
 * Formats markdown bold (**text**) and newlines in the response.
 *
 * The system prompt grounds the AI in the representative's known biographical data
 * (party, state, district, birth date, bio text) to improve factual accuracy.
 *
 * @async
 * @param {string|null} q - Question text, or null to read from the AI input field
 * @returns {Promise<void>}
 *
 * @example
 * askAI("What are this senator's key positions?")
 * askAI(null) // reads from #ai-input field
 */
async function askAI(q) {
  if (!q) q = document.getElementById("ai-input").value.trim();
  if (!q) return;
  document.getElementById("ai-input").value = "";

  const msgs = document.getElementById("ai-msgs");
  msgs.innerHTML += `<div class="ai-msg user">${q}</div>
                     <div class="ai-msg bot loading" id="ai-loading">Thinking...</div>`;
  msgs.scrollTop = msgs.scrollHeight;

  aiHistory.push({ role:"user", parts:[{ text:q }] });

  const rep = currentRep;
  const systemPrompt = `You are a helpful assistant answering questions about ${rep.name||"this US Congress member"}.
Known info — Party: ${rep.party||"?"}, State: ${rep.state||"?"}, District: ${rep.district||"N/A"}, Birth: ${rep.birth||"?"}, Bio: ${rep.bio||"Not available"}.
Be concise and factual. If unsure, say so.`;

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

    aiHistory.push({ role:"model", parts:[{ text:answer }] });

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
