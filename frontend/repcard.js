/**
 * repcard.js
 * Representative card display logic
 * Shows photo, name, party, chamber history, born/died dates
 * Depends on: data.js (ABBR_TO_NAME), map.js (ordinal, getChamber, getCongress)
 */

let currentRep = null;
let aiHistory = [];

/**
 * Formats a date string to MM-DD-YYYY
 * @param {string} d - Date string (YYYY-MM-DD or YYYY)
 * @returns {string}
 */
function formatDate(d) {
  if (!d) return "";
  // Full date YYYY-MM-DD → MM-DD-YYYY
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, dy] = d.split("-");
    return `${m}-${dy}-${y}`;
  }
  // Partial date YYYY-MM → MM-YYYY
  if (/^\d{4}-\d{2}$/.test(d)) {
    const [y, m] = d.split("-");
    return `${m}-${y}`;
  }
  // Just year → return as is
  return d;
}

/**
 * Builds a summary row for a chamber (House or Senate)
 * e.g. "South Dakota, District 2 93rd-96th (1973-1981)"
 * @param {Array} terms - Array of term objects
 * @param {string} chamberLabel - "House" or "Senate"
 * @returns {Array|null} [label, value] or null if no terms
 */
function buildChamberRow(terms, chamberLabel) {
  if (terms.length === 0) return null;
  const states = [...new Set(terms.map(t => ABBR_TO_NAME[t.state]||t.state).filter(Boolean))].join(", ");
  const districts = [...new Set(terms.map(t => t.district).filter(d => d && !String(d).includes("Region") && !String(d).includes("State")))];
  const distStr = districts.length > 0 ? `, District ${districts[0]}` : "";
  const congresses = terms.map(t => parseInt(t.congress)).filter(Boolean);
  const minC = Math.min(...congresses), maxC = Math.max(...congresses);
  const starts = terms.map(t => parseInt(t.start)||0).filter(Boolean);
  const ends = terms.map(t => t.departure ? parseInt(t.departure) : new Date().getFullYear()).filter(Boolean);
  const startY = Math.min(...starts), endY = Math.max(...ends);
  const congressRange = minC === maxC ? `${ordinal(minC)}` : `${ordinal(minC)}-${ordinal(maxC)}`;
  const showDistrict = chamberLabel === "House";
  return [chamberLabel, `${states}${showDistrict ? distStr : ""} ${congressRange} (${startY}-${endY})`];
}

/**
 * Opens the representative card below the map
 * @param {object} rep - Representative data object
 */
function openRepCard(rep) {
  currentRep = rep;
  aiHistory = [];

  const p = rep.party || "?";
  const code = p.startsWith("D") ? "D" : p.startsWith("R") ? "R" : "I";
  const label = p.startsWith("D") ? "Democrat" : p.startsWith("R") ? "Republican" : p;

  // Photo + name + party badge
  document.getElementById("rc-photo").src = rep.image || "https://via.placeholder.com/100?text=?";
  document.getElementById("rc-name").textContent = rep.name || "Unknown";
  document.getElementById("rc-badges").innerHTML = `<span class="rep-badge rb-${code}">${label}</span>`;

  // Build chamber history rows from all terms
  const allTerms = rep.allTerms || [];
  const houseTerms  = allTerms.filter(t => (t.chamber||"").toLowerCase().includes("house") || t.chamber==="Representative");
  const senateTerms = allTerms.filter(t => (t.chamber||"").toLowerCase().includes("senate") || t.chamber==="Senator");

  const rows = [];
  const senateRow = buildChamberRow(senateTerms, "Senate");
  const houseRow  = buildChamberRow(houseTerms, "House");
  if (senateRow) rows.push(senateRow);
  if (houseRow)  rows.push(houseRow);

  // Fallback if no term data
  if (rows.length === 0) {
    const state = ABBR_TO_NAME[rep.state] || rep.state || "";
    const dist = rep.district && !String(rep.district).includes("Region") ? `, District ${rep.district}` : "";
    rows.push([getChamber()==="senate" ? "Senate" : "House", `${state}${dist}`]);
  }

  rows.push(["Party", label]);
  if (rep.birth) rows.push(["Born", formatDate(rep.birth)]);
  if (rep.death) rows.push(["Died", formatDate(rep.death)]);

  document.getElementById("rc-details").innerHTML = rows.map(([l,v]) =>
    `<span class="rep-detail-label">${l}</span><span class="rep-detail-value">${v}</span>`
  ).join("");

  // Set up AI chatbot chips
  setupChatbot(rep);

  // Show card and scroll to it
  const sec = document.getElementById("rep-section");
  sec.classList.add("visible");
  setTimeout(() => sec.scrollIntoView({ behavior:"smooth", block:"start" }), 100);
}
