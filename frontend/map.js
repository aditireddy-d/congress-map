/**
 * @fileoverview D3.js map rendering for the US Congress Map dashboard.
 * Handles state rendering, representative count badges, state zoom transitions,
 * and representative dot placement at geographic district centroids.
 *
 * @requires data.js - DISTRICTS, CAPITALS, ABBR_TO_NAME, DEFAULT_COLORS, STATIC_HOUSE, STATIC_SENATE
 * @requires repcard.js - openRepCard()
 * @author Aditi Reddy Doma
 * @version 2.0.0
 */

/** @constant {string} API - Base URL for the REST API */
const API = "https://e7hb257lv6.execute-api.us-east-2.amazonaws.com/prod";

/**
 * D3 Albers USA projection. Scale 1300 centers the map on a 975x610 SVG canvas.
 * @type {d3.GeoProjection}
 */
const projection = d3.geoAlbersUsa().scale(1300).translate([487, 310]);

/**
 * D3 geographic path generator using flat (identity) projection.
 * Used for rendering pre-projected Albers USA TopoJSON paths.
 * @type {d3.GeoPath}
 */
const flatPath = d3.geoPath();

/** @constant {number} W - SVG canvas width in pixels */
const W = 975;

/** @constant {number} H - SVG canvas height in pixels */
const H = 610;

/** @type {Array<Object>} allReps - All loaded representative records for current congress/chamber */
let allReps = [];

/** @type {Object} repCounts - Map of state abbreviation to representative count */
let repCounts = { ...STATIC_HOUSE };

/** @type {boolean} isZoomed - Whether the map is currently zoomed into a state */
let isZoomed = false;

/** @type {Array<Object>|null} geoFeatures - GeoJSON features for all 50 states */
let geoFeatures = null;

const svg     = d3.select("#map").append("svg").attr("viewBox",[0,0,W,H]).style("width","100%").style("height","auto");
const statesG = svg.append("g").attr("stroke","#fff").attr("stroke-width",1);
const badgeG  = svg.append("g");
const dotsG   = svg.append("g");

/**
 * Converts a number to its ordinal string representation.
 * @param {number} n - The number to convert
 * @returns {string} Ordinal string e.g. "1st", "2nd", "119th"
 */
function ordinal(n) {
  const s = ["th","st","nd","rd"], v = n % 100;
  return n + (s[(v-20)%10] || s[v] || s[0]);
}

// Populate Congress dropdown
const congressSel = document.getElementById("congress-select");
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
    statesG.selectAll("path").data(geoFeatures).join("path")
      .attr("class","state-path")
      .attr("d", flatPath)
      .attr("fill", d => DEFAULT_COLORS[d.properties.name]||"#ddd")
      .on("mouseover", function(e,d){ if(!isZoomed) d3.select(this).attr("opacity",0.78); })
      .on("mouseout",  function(e,d){ if(!isZoomed) d3.select(this).attr("opacity",1); })
      .on("click", (e,d)=>{ if(!isZoomed){ const a=NAME_TO_ABBR[d.properties.name]; if(a) zoomToState(d,a); } });
    renderBadges();
    loadData();
  });

/**
 * Renders white pill badges showing representative count at the centroid of each state.
 * Badges are clickable and trigger {@link zoomToState} on click.
 */
function renderBadges() {
  badgeG.selectAll("*").remove();
  if (!geoFeatures) return;
  geoFeatures.forEach(d => {
    const abbr = NAME_TO_ABBR[d.properties.name]; if (!abbr) return;
    const count = repCounts[abbr]; if (count == null) return;
    const c = flatPath.centroid(d); if (!c || isNaN(c[0])) return;
    const [cx,cy] = c, label = String(count);
    const bw = Math.max(label.length*6+8,20), bh = 16;
    const g = badgeG.append("g").attr("class","badge-group").on("click",()=>zoomToState(d,abbr));
    g.append("rect").attr("class","rep-badge-bg").attr("x",cx-bw/2).attr("y",cy-bh/2).attr("width",bw).attr("height",bh).attr("rx",5);
    g.append("text").attr("class","rep-badge-text").attr("x",cx).attr("y",cy+1).text(label);
  });
}

/**
 * Zooms the map into a specific state using D3 transitions.
 * Fades out all other states, hides badges, and renders representative dots.
 * @param {Object} d - GeoJSON feature object for the state
 * @param {string} abbr - Two-letter state abbreviation e.g. "CA"
 */
function zoomToState(d, abbr) {
  isZoomed = true;
  const [[x0,y0],[x1,y1]] = flatPath.bounds(d);
  const scale = Math.min(9, 0.85/Math.max((x1-x0)/W,(y1-y0)/H));
  const tx = W/2-scale*(x0+x1)/2, ty = H/2-scale*(y0+y1)/2;
  badgeG.style("visibility","hidden").style("opacity",0);
  statesG.selectAll("path").transition().duration(600)
    .attr("opacity", dd=>NAME_TO_ABBR[dd.properties.name]===abbr?1:0.15)
    .attr("stroke-width", dd=>NAME_TO_ABBR[dd.properties.name]===abbr?0.2:1);
  statesG.transition().duration(700).attr("transform",`translate(${tx},${ty})scale(${scale})`);
  dotsG.transition().duration(700).attr("transform",`translate(${tx},${ty})scale(${scale})`)
    .on("end",()=>renderDots(abbr,scale));
  document.getElementById("back-btn").classList.add("visible");
}

/**
 * Resets the map to the full US view with smooth D3 transitions.
 * Removes all dots, tooltips, name list, and rep card visibility.
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
 * Renders colored dots for each representative in the zoomed state.
 *
 * House dots are placed at geographic centroid of congressional district
 * using the DISTRICTS lookup table, then clamped inside state bounds.
 *
 * Senate dots are placed at state centroid with directional offsets:
 * - Wide states (width > height): left and right of center
 * - Narrow/tall states: above and below center
 * - Single senator: placed at exact centroid
 *
 * Dot colors: Blue = Democrat, Red = Republican, Grey = Independent.
 *
 * @param {string} abbr - Two-letter state abbreviation
 * @param {number} scale - Current zoom scale factor
 */
function renderDots(abbr, scale) {
  dotsG.selectAll("*").remove();
  const chamber = getChamber();
  const reps = allReps.filter(r => r.state === abbr);
  const r = Math.max(3, 6/scale);

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
          senateCentroid = [[Math.max(sx0+8,cx-offset),cy],[Math.min(sx1-8,cx+offset),cy]];
        } else {
          senateCentroid = [[cx,Math.max(sy0+8,cy-offset)],[cx,Math.min(sy1-8,cy+offset)]];
        }
      }
    }
  }

  window._currentReps = reps;
  document.getElementById("name-list-title").textContent = chamber==="senate"?"Senators":"Representatives";
  document.getElementById("name-list-items").innerHTML = reps.map((rep,i) => {
    const color = rep.party.startsWith("R")?"#c0525a":rep.party.startsWith("D")?"#5a7fa8":"#888";
    return `<div class="name-list-item" onclick="openRepCard(window._currentReps[${i}])">
      <div class="name-dot" style="background:${color}"></div>
      <div class="name-text">${rep.name||"Unknown"}</div>
    </div>`;
  }).join("");
  document.getElementById("name-list").classList.add("visible");

  reps.forEach((rep, idx) => {
    let directPx = null, latLng = null;
    if (chamber === "senate") {
      directPx = senateCentroid?(senateCentroid[idx]||senateCentroid[0]):null;
    } else {
      const key = `${abbr}-${rep.district}`;
      latLng = DISTRICTS[key]||CAPITALS[abbr]||[39,-98];
    }
    let pt = directPx||(latLng?projection([latLng[1],latLng[0]]):null);
    if (!pt) return;
    if (chamber !== "senate") {
      const sf = geoFeatures.find(f=>NAME_TO_ABBR[f.properties.name]===abbr);
      if (sf) {
        const [[bx0,by0],[bx1,by1]] = flatPath.bounds(sf);
        pt = [Math.max(bx0+6,Math.min(bx1-6,pt[0])),Math.max(by0+6,Math.min(by1-6,pt[1]))];
      }
    }
    const color = rep.party.startsWith("R")?"#c0525a":rep.party.startsWith("D")?"#5a7fa8":"#888";
    dotsG.append("circle")
      .attr("class","rep-dot")
      .attr("cx",pt[0]).attr("cy",pt[1])
      .attr("r",r)
      .attr("fill",color)
      .attr("stroke","#fff")
      .attr("stroke-width",Math.max(0.5,1.5/scale))
      .on("mouseover",function(e){
        d3.select(this).attr("r",r*1.5);
        d3.select("body").append("div").attr("class","dot-tooltip")
          .text(rep.name||"Unknown")
          .style("left",(e.clientX+12)+"px")
          .style("top",(e.clientY-32)+"px");
      })
      .on("mousemove",function(e){
        d3.select(".dot-tooltip").style("left",(e.clientX+12)+"px").style("top",(e.clientY-32)+"px");
      })
      .on("mouseout",function(){
        d3.select(this).attr("r",r);
        d3.select(".dot-tooltip").remove();
      })
      .on("click",()=>openRepCard(rep));
  });
}

/**
 * Fetches representative data from the REST API for the current congress and chamber.
 * Falls back to static counts if the API call fails.
 * @async
 * @returns {Promise<void>}
 */
async function loadData() {
  showSpinner(true);
  try {
    const chamber = getChamber(), congress = getCongress();
    const res = await fetch(`${API}/reps/map?congress=${congress}&chamber=${chamber}`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    const raw = Array.isArray(data)?data:(data.data||[]);
    const target = parseInt(congress);
    allReps = [];
    raw.forEach(rep => {
      (rep.terms||[]).filter(t=>t.congress===target).forEach(term => {
        allReps.push({name:rep.name,party:term.party||"?",state:term.state,district:term.district,birth:rep.birth||"",death:rep.death||"",image:rep.image||"",url:rep.url||"",bio:rep.Bio||"",allTerms:rep.terms||[]});
      });
    });
    const counts = {};
    allReps.forEach(r=>{ if(r.state) counts[r.state]=(counts[r.state]||0)+1; });
    repCounts = Object.keys(counts).length>0?counts:(getChamber()==="senate"?STATIC_SENATE:STATIC_HOUSE);
    renderBadges();
  } catch {
    repCounts = getChamber()==="senate"?STATIC_SENATE:STATIC_HOUSE;
    renderBadges();
  } finally {
    showSpinner(false);
  }
}

/**
 * Gets the currently selected chamber from the dropdown.
 * @returns {string} "house" or "senate"
 */
function getChamber()  { return document.getElementById("chamber-select").value; }

/**
 * Gets the currently selected congress number from the dropdown.
 * @returns {string} Congress number as string e.g. "119"
 */
function getCongress() { return document.getElementById("congress-select").value; }

/**
 * Shows or hides the loading spinner overlay.
 * @param {boolean} on - true to show, false to hide
 */
function showSpinner(on) { document.getElementById("spinner").classList.toggle("active",on); }

document.getElementById("back-btn").addEventListener("click", zoomOut);
document.getElementById("chamber-select").addEventListener("change",()=>{ if(isZoomed) zoomOut(); loadData(); });
document.getElementById("congress-select").addEventListener("change",()=>{ if(isZoomed) zoomOut(); loadData(); });
