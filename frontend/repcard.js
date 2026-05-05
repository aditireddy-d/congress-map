/**
 * @fileoverview Representative card display logic for the US Congress Map.
 * Renders the biographical card when a representative dot is clicked,
 * showing photo, name, party badge, chamber history, and born/died dates.
 * Also initializes the AI chatbot suggestion chips.
 *
 * @requires data.js - ABBR_TO_NAME
 * @requires map.js - ordinal(), getChamber()
 * @requires chatbot.js - setupChatbot()
 * @author Aditi Reddy Doma
 * @version 2.0.0
 */

/** @type {Object|null} currentRep - The currently displayed representative record */
let currentRep = null;

/** @type {Array<Object>} aiHistory - Multi-turn conversation history for the AI chatbot */
let aiHistory = [];

/**
 * Formats a date string from YYYY-MM-DD to MM-DD-YYYY format.
 * Handles full dates, partial dates (YYYY-MM), and year-only strings.
 *
 * @param {string|null} d - Date string in YYYY-MM-DD, YYYY-MM, or YYYY format
 * @returns {string} Formatted date string or empty string if input is null/empty
 *
 * @example
 * formatDate("1961-11-07") // returns "11-07-1961"
 * formatDate("1961-11")    // returns "11-1961"
 * formatDate("1961")       // returns "1961"
 * formatDate(null)         // returns ""
 */
function formatDate(d) {
  if (!d) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y,m,dy] = d.split("-");
    return `${m}-${dy}-${y}`;
  }
  if (/^\d{4}-\d{2}$/.test(d)) {
    const [y,m] = d.split("-");
    return `${m}-${y}`;
  }
  return d;
}

/**
 * Builds a summary row for a chamber (House or Senate) from an array of term records.
 * Groups terms to show: state, district (House only), congress range, and year range.
 *
 * @param {Array<Object>} terms - Array of term objects with congress, state, district, start, departure fields
 * @param {string} chamberLabel - Display label "House" or "Senate"
 * @returns {Array<string>|null} [label, value] tuple or null if no terms provided
 *
 * @example
 * // Returns ["Senate", "New York 103rd-119th (1999-2025)"]
 * buildChamberRow(senateTerms, "Senate")
 */
function buildChamberRow(terms, chamberLabel) {
  if (terms.length === 0) return null;
  const states = [...new Set(terms.map(t=>ABBR_TO_NAME[t.state]||t.state).filter(Boolean))].join(", ");
  const districts = [...new Set(terms.map(t=>t.district).filter(d=>d&&!String(d).includes("Region")&&!String(d).includes("State")))];
  const distStr = districts.length>0?`, District ${districts[0]}`:"";
  const congresses = terms.map(t=>parseInt(t.congress)).filter(Boolean);
  const minC = Math.min(...congresses), maxC = Math.max(...congresses);
  const starts = terms.map(t=>parseInt(t.start)||0).filter(Boolean);
  const ends = terms.map(t=>t.departure?parseInt(t.departure):new Date().getFullYear()).filter(Boolean);
  const startY = Math.min(...starts), endY = Math.max(...ends);
  const congressRange = minC===maxC?`${ordinal(minC)}`:`${ordinal(minC)}-${ordinal(maxC)}`;
  const showDistrict = chamberLabel === "House";
  return [chamberLabel, `${states}${showDistrict?distStr:""} ${congressRange} (${startY}-${endY})`];
}

/**
 * Opens and populates the representative card below the map.
 * Sets photo, name, party badge, chamber history rows, born/died dates,
 * and initializes the AI chatbot with suggestion chips.
 * Scrolls the card into view with smooth behavior.
 *
 * @param {Object} rep - Representative data object
 * @param {string} rep.name - Full name of the representative
 * @param {string} rep.party - Party affiliation (e.g., "Republican", "Democratic")
 * @param {string} rep.state - Two-letter state abbreviation
 * @param {string} rep.district - District number
 * @param {string} rep.birth - Birth date string
 * @param {string} rep.death - Death date string (if applicable)
 * @param {string} rep.image - URL to representative's photo
 * @param {string} rep.bio - Biographical text
 * @param {Array<Object>} rep.allTerms - All congressional terms across both chambers
 */
function openRepCard(rep) {
  currentRep = rep;
  aiHistory = [];

  const p = rep.party || "?";
  const code = p.startsWith("D")?"D":p.startsWith("R")?"R":"I";
  const label = p.startsWith("D")?"Democrat":p.startsWith("R")?"Republican":p;

  // Photo, name, party badge
  document.getElementById("rc-photo").src = rep.image || "https://via.placeholder.com/100?text=?";
  document.getElementById("rc-name").textContent = rep.name || "Unknown";
  document.getElementById("rc-badges").innerHTML = `<span class="rep-badge rb-${code}">${label}</span>`;

  // Build chamber history from all terms
  const allTerms = rep.allTerms || [];
  const houseTerms  = allTerms.filter(t=>(t.chamber||"").toLowerCase().includes("house")||t.chamber==="Representative");
  const senateTerms = allTerms.filter(t=>(t.chamber||"").toLowerCase().includes("senate")||t.chamber==="Senator");

  const rows = [];
  const senateRow = buildChamberRow(senateTerms, "Senate");
  const houseRow  = buildChamberRow(houseTerms, "House");
  if (senateRow) rows.push(senateRow);
  if (houseRow)  rows.push(houseRow);

  // Fallback if no allTerms data
  if (rows.length === 0) {
    const state = ABBR_TO_NAME[rep.state]||rep.state||"";
    const dist = rep.district&&!String(rep.district).includes("Region")?`, District ${rep.district}`:"";
    rows.push([getChamber()==="senate"?"Senate":"House", `${state}${dist}`]);
  }

  rows.push(["Party", label]);
  if (rep.birth) rows.push(["Born", formatDate(rep.birth)]);
  if (rep.death) rows.push(["Died", formatDate(rep.death)]);

  document.getElementById("rc-details").innerHTML = rows.map(([l,v]) =>
    `<span class="rep-detail-label">${l}</span><span class="rep-detail-value">${v}</span>`
  ).join("");

  // Initialize AI chatbot
  setupChatbot(rep);

  // Show card and scroll into view
  document.getElementById("ai-msgs").innerHTML = "";
  const sec = document.getElementById("rep-section");
  sec.classList.add("visible");
  setTimeout(() => sec.scrollIntoView({behavior:"smooth",block:"start"}), 100);
}
