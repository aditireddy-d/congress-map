/**
 * test_frontend.js
 * Unit tests for US Congress Map frontend functions
 * Run with: node test_frontend.js
 */

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`PASS: ${name}`);
    passed++;
  } catch (e) {
    console.log(`FAIL: ${name} — ${e.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

//ordinal
function ordinal(n) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

test("ordinal: 1st", () => assert(ordinal(1) === "1st"));
test("ordinal: 2nd", () => assert(ordinal(2) === "2nd"));
test("ordinal: 3rd", () => assert(ordinal(3) === "3rd"));
test("ordinal: 4th", () => assert(ordinal(4) === "4th"));
test("ordinal: 11th", () => assert(ordinal(11) === "11th"));
test("ordinal: 12th", () => assert(ordinal(12) === "12th"));
test("ordinal: 21st", () => assert(ordinal(21) === "21st"));
test("ordinal: 119th", () => assert(ordinal(119) === "119th"));

// Congress year range 

function congressYears(n) {
  const start = 1789 + (n - 1) * 2;
  return { start, end: start + 2 };
}

test("1st Congress starts 1789", () => assert(congressYears(1).start === 1789));
test("1st Congress ends 1791",   () => assert(congressYears(1).end === 1791));
test("119th Congress starts 2025", () => assert(congressYears(119).start === 2025));
test("119th Congress ends 2027",   () => assert(congressYears(119).end === 2027));
test("2nd Congress starts 1791",   () => assert(congressYears(2).start === 1791));

// formatDate

function formatDate(d) {
  if (!d) return "";
  if (/^\d{4}$/.test(d)) return d;
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, dy] = d.split("-");
    return `${m}-${dy}-${y}`;
  }
  return d;
}

test("formatDate: YYYY-MM-DD → MM-DD-YYYY", () => assert(formatDate("1961-11-07") === "11-07-1961"));
test("formatDate: year only stays as year",  () => assert(formatDate("1961") === "1961"));
test("formatDate: empty string returns empty", () => assert(formatDate("") === ""));
test("formatDate: null returns empty",         () => assert(formatDate(null) === ""));

// Party color
function partyColor(party) {
  if (!party) return "#888";
  if (party.startsWith("R")) return "#c0525a";
  if (party.startsWith("D")) return "#5a7fa8";
  return "#888";
}

test("partyColor: Republican → red",    () => assert(partyColor("Republican") === "#c0525a"));
test("partyColor: Democrat → blue",     () => assert(partyColor("Democratic") === "#5a7fa8"));
test("partyColor: Independent → grey",  () => assert(partyColor("Independent") === "#888"));
test("partyColor: null → grey",         () => assert(partyColor(null) === "#888"));

// DISTRICTS 

const DISTRICTS = {
  "CA-12": [37.8, -122.4],
  "TX-20": [29.4, -98.5],
  "NY-14": [40.7, -73.9],
  "WY-1":  [42.9, -107.5],
};

test("DISTRICTS: CA-12 exists",    () => assert(DISTRICTS["CA-12"] !== undefined));
test("DISTRICTS: TX-20 exists",    () => assert(DISTRICTS["TX-20"] !== undefined));
test("DISTRICTS: NY-14 lat valid", () => assert(DISTRICTS["NY-14"][0] > 0));
test("DISTRICTS: WY-1 lng valid",  () => assert(DISTRICTS["WY-1"][1] < 0));
test("DISTRICTS: unknown returns undefined", () => assert(DISTRICTS["ZZ-99"] === undefined));

// API URL 

function buildApiUrl(congress, chamber) {
  return `https://e7hb257lv6.execute-api.us-east-2.amazonaws.com/prod/reps/map?congress=${congress}&chamber=${chamber}`;
}

test("buildApiUrl: house 119", () =>
  assert(buildApiUrl(119, "house").includes("congress=119")));
test("buildApiUrl: senate 118", () =>
  assert(buildApiUrl(118, "senate").includes("chamber=senate")));
test("buildApiUrl: contains base URL", () =>
  assert(buildApiUrl(119, "house").includes("execute-api.us-east-2.amazonaws.com")));



console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
