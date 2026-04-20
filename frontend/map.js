/**
 * map.js
 * D3.js map rendering for the US Congress Map
 * Handles: state rendering, rep count badges, zoom into state, rep dots
 * Depends on: data.js (DISTRICTS, CAPITALS, ABBR_TO_NAME, etc.)
 */

const API = "https://e7hb257lv6.execute-api.us-east-2.amazonaws.com/prod";

// D3 map projection — Albers USA centers the map on the SVG canvas
const projection = d3.geoAlbersUsa().scale(1300).translate([487, 310]);
const flatPath = d3.geoPath();

// SVG canvas dimensions
const W = 975, H = 610;

// Global state
let allReps = [];
let repCounts = { ...STATIC_HOUSE };
let isZoomed = false;
let geoFeatures = null;

// Build SVG layers
const svg    = d3.select("#map").append("svg").attr("viewBox", [0,0,W,H]).style("width","100%").style("height","auto");
const statesG = svg.append("g").attr("stroke","#fff").attr("stroke-width",1);
const badgeG  = svg.append("g");
const dotsG   = svg.append("g");

// Populate Congress dropdown
const congressSel = document.getElementById("congress-select");

/**
 * Returns the ordinal string for a number (e.g. 1 → "1st", 2 → "2nd")
 * @param {number} n
 * @returns {string}
 */
function ordinal(n) {
  const s = ["th","st","nd","rd"], v = n % 100;
  return n + (s[(v-20)%10] || s[v] || s[0]);
}

// Populate congress dropdown with ordinal + year range
for (let i = 119; i >= 1; i--) {
  const start = 1789 + (i-1)*2, end = start + 2;
  const o = document.createElement("option");
  o.value = i;
  o.textContent = `${ordinal(i)} · ${start}–${end}`;
  if (i === 119) o.selected = true;
  congressSel.appendChild(o);
}

// Load US map shapes from TopoJSON CDN
fetch("https://cdn.jsdelivr.net/npm/us-atlas@3/states-albers-10m.json")
  .then(r => r.json())
  .then(us => {
    geoFeatures = topojson.feature(us, us.objects.states).features;
    statesG.selectAll("path")
      .data(geoFeatures)
      .join("path")
      .attr("class", "state-path")
      .attr("d", flatPath)
      .attr("fill", d => DEFAULT_COLORS[d.properties.name] || "#ddd")
      .on("mouseover", function(e, d) { if (!isZoomed) d3.select(this).attr("opacity", 0.78); })
      .on("mouseout",  function(e, d) { if (!isZoomed) d3.select(this).attr("opacity", 1); })
      .on("click", (e, d) => {
        if (!isZoomed) {
          const abbr = NAME_TO_ABBR[d.properties.name];
          if (abbr) zoomToState(d, abbr);
        }
      });
    renderBadges();
    loadData();
  });

/**
 * Renders white pill badges showing rep count at center of each state
 */
function renderBadges() {
  badgeG.selectAll("*").remove();
  if (!geoFeatures) return;
  geoFeatures.forEach(d => {
    const abbr = NAME_TO_ABBR[d.properties.name]; if (!abbr) return;
    const count = repCounts[abbr]; if (count == null) return;
    const c = flatPath.centroid(d); if (!c || isNaN(c[0])) return;
    const [cx, cy] = c;
    const label = String(count);
    const bw = Math.max(label.length*6+8, 20), bh = 16;
    const g = badgeG.append("g").attr("class","badge-group").on("click", () => zoomToState(d, abbr));
    g.append("rect").attr("class","rep-badge-bg").attr("x",cx-bw/2).attr("y",cy-bh/2).attr("width",bw).attr("height",bh).attr("rx",5);
    g.append("text").attr("class","rep-badge-text").attr("x",cx).attr("y",cy+1).text(label);
  });
}

/**
 * Zooms into a state and renders rep dots
 * @param {object} d - GeoJSON feature
 * @param {string} abbr - State abbreviation e.g. "CA"
 */
function zoomToState(d, abbr) {
  isZoomed = true;
  const [[x0,y0],[x1,y1]] = flatPath.bounds(d);
  const scale = Math.min(9, 0.85 / Math.max((x1-x0)/W, (y1-y0)/H));
  const tx = W/2 - scale*(x0+x1)/2, ty = H/2 - scale*(y0+y1)/2;

  badgeG.style("visibility","hidden").style("opacity",0);
  statesG.selectAll("path").transition().duration(600)
    .attr("opacity", dd => NAME_TO_ABBR[dd.properties.name] === abbr ? 1 : 0.15)
    .attr("stroke-width", dd => NAME_TO_ABBR[dd.properties.name] === abbr ? 0.2 : 1);
  statesG.transition().duration(700).attr("transform", `translate(${tx},${ty})scale(${scale})`);
  dotsG.transition().duration(700).attr("transform", `translate(${tx},${ty})scale(${scale})`)
    .on("end", () => renderDots(abbr, scale));

  document.getElementById("back-btn").classList.add("visible");
}

/**
 * Resets the map to full US view
 */
function zoomOut() {
  isZoomed = false;
  dotsG.selectAll("*").remove();
  d3.select(".dot-tooltip").remove();
  document.getElementById("name-list").classList.remove("visible");
  document.getElementById("rep-section").classList.remove("visible");
  statesG.transition().duration(600).attr("transform","");
  statesG.selectAll("path").transition().duration(600).attr("opacity",1).attr("stroke-width",1);
  badgeG.style("visibility","visible").transition().duration(600).attr("transform","").style("opacity",1);
  dotsG.transition().duration(600).attr("transform","");
  document.getElementById("back-btn").classList.remove("visible");
}

/**
 * Renders colored dots for each representative in the zoomed state
 * House dots: placed at district centroid
 * Senate dots: placed left/right or above/below state center
 * @param {string} abbr - State abbreviation
 * @param {number} scale - Current zoom scale
 */
function renderDots(abbr, scale) {
  dotsG.selectAll("*").remove();
  const chamber = getChamber();
  const reps = allReps.filter(r => r.state === abbr);
  const r = Math.max(3, 6/scale);

  // Calculate senate dot positions from state centroid
  let senateCentroid = null;
  if (chamber === "senate") {
    const stateFeat = geoFeatures.find(f => NAME_TO_ABBR[f.properties.name] === abbr);
    if (stateFeat) {
      const [[sx0,sy0],[sx1,sy1]] = flatPath.bounds(stateFeat);
      const stateW = sx1-sx0, stateH = sy1-sy0;
      const [cx,cy] = flatPath.centroid(stateFeat);
      if (reps.length === 1) {
        senateCentroid = [[cx,cy]];
      } else {
        const offset = Math.min(stateW,stateH)*0.25;
        if (stateW >= stateH) {
          // Wide state → left and right
          senateCentroid = [[Math.max(sx0+8,cx-offset),cy],[Math.min(sx1-8,cx+offset),cy]];
        } else {
          // Tall/narrow state → above and below
          senateCentroid = [[cx,Math.max(sy0+8,cy-offset)],[cx,Math.min(sy1-8,cy+offset)]];
        }
      }
    }
  }

  // Populate name scroll list
  window._currentReps = reps;
  document.getElementById("name-list-title").textContent = chamber === "senate" ? "Senators" : "Representatives";
  document.getElementById("name-list-items").innerHTML = reps.map((rep,i) => {
    const color = rep.party.startsWith("R") ? "#c0525a" : rep.party.startsWith("D") ? "#5a7fa8" : "#888";
    return `<div class="name-list-item" onclick="openRepCard(window._currentReps[${i}])">
      <div class="name-dot" style="background:${color}"></div>
      <div class="name-text">${rep.name||"Unknown"}</div>
    </div>`;
  }).join("");
  document.getElementById("name-list").classList.add("visible");

  // Draw each dot
  reps.forEach((rep, idx) => {
    let directPx = null, latLng = null;
    if (chamber === "senate") {
      directPx = senateCentroid ? (senateCentroid[idx] || senateCentroid[0]) : null;
    } else {
      const key = `${abbr}-${rep.district}`;
      latLng = DISTRICTS[key] || CAPITALS[abbr] || [39,-98];
    }

    let pt = directPx || (latLng ? projection([latLng[1], latLng[0]]) : null);
    if (!pt) return;

    // Clamp house dots inside state bounds
    if (chamber !== "senate") {
      const sf = geoFeatures.find(f => NAME_TO_ABBR[f.properties.name] === abbr);
      if (sf) {
        const [[bx0,by0],[bx1,by1]] = flatPath.bounds(sf);
        pt = [Math.max(bx0+6, Math.min(bx1-6, pt[0])), Math.max(by0+6, Math.min(by1-6, pt[1]))];
      }
    }

    const color = rep.party.startsWith("R") ? "#c0525a" : rep.party.startsWith("D") ? "#5a7fa8" : "#888";
    dotsG.append("circle")
      .attr("class","rep-dot")
      .attr("cx", pt[0]).attr("cy", pt[1])
      .attr("r", r)
      .attr("fill", color)
      .attr("stroke","#fff")
      .attr("stroke-width", Math.max(0.5, 1.5/scale))
      .on("mouseover", function(e) {
        d3.select(this).attr("r", r*1.5);
        d3.select("body").append("div").attr("class","dot-tooltip")
          .text(rep.name || "Unknown")
          .style("left", (e.clientX+12)+"px")
          .style("top", (e.clientY-32)+"px");
      })
      .on("mousemove", function(e) {
        d3.select(".dot-tooltip").style("left",(e.clientX+12)+"px").style("top",(e.clientY-32)+"px");
      })
      .on("mouseout", function() {
        d3.select(this).attr("r", r);
        d3.select(".dot-tooltip").remove();
      })
      .on("click", () => openRepCard(rep));
  });
}

/**
 * Fetches representative data from the REST API
 */
async function loadData() {
  showSpinner(true);
  try {
    const chamber = getChamber(), congress = getCongress();
    const res = await fetch(`${API}/reps/map?congress=${congress}&chamber=${chamber}`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    const raw = Array.isArray(data) ? data : (data.data || []);
    const target = parseInt(congress);
    allReps = [];
    raw.forEach(rep => {
      (rep.terms||[]).filter(t => t.congress === target).forEach(term => {
        allReps.push({
          name: rep.name, party: term.party||"?", state: term.state,
          district: term.district, birth: rep.birth||"", death: rep.death||"",
          image: rep.image||"", url: rep.url||"", bio: rep.Bio||"",
          allTerms: rep.terms||[]
        });
      });
    });
    const counts = {};
    allReps.forEach(r => { if (r.state) counts[r.state] = (counts[r.state]||0)+1; });
    repCounts = Object.keys(counts).length > 0 ? counts : (getChamber()==="senate" ? STATIC_SENATE : STATIC_HOUSE);
    renderBadges();
  } catch {
    repCounts = getChamber()==="senate" ? STATIC_SENATE : STATIC_HOUSE;
    renderBadges();
  } finally {
    showSpinner(false);
  }
}

// Helper functions
function getChamber()  { return document.getElementById("chamber-select").value; }
function getCongress() { return document.getElementById("congress-select").value; }
function showSpinner(on) { document.getElementById("spinner").classList.toggle("active", on); }

// Event listeners
document.getElementById("back-btn").addEventListener("click", zoomOut);
document.getElementById("chamber-select").addEventListener("change", () => { if(isZoomed) zoomOut(); loadData(); });
document.getElementById("congress-select").addEventListener("change", () => { if(isZoomed) zoomOut(); loadData(); });
