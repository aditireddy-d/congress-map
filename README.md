# US Congress Analytics & Interactive Map

A full-stack platform for exploring US Congressional data. Collects representative and bill data from public APIs, stores it in AWS DynamoDB, builds a Senate co-sponsorship graph in Neo4j, runs community detection algorithms to identify senator clusters, and visualizes everything through an interactive map dashboard with an AI-powered chatbot.

**Live Demo:** https://staging.icitizen.com/congress-map

---

## Project Structure

```
us-congress-analytics/
├── frontend/                           # Interactive map dashboard
│   └── congress-map.html               # Standalone map + rep card + AI chatbot
├── api/                                # REST API (Flask + AWS Lambda)
│   └── main.py
├── ingestion/                          # Data collection scripts
│   ├── bioguide_members.py             # Scrapes Bioguide website for member bios
│   ├── current_reps_ingestion.py       # Fetches current members from Congress.gov
│   ├── populate_repterms.py            # Populates RepTerms table from Reps table
│   └── bills_senate.py                 # Fetches Senate bills from Congress.gov
├── senator_graph/                      # Neo4j graph + community detection
│   ├── build_graph.py                  # Builds co-sponsorship graph
│   ├── load_neo4j.py                   # Loads graph into Neo4j
│   ├── identify_clusters.py            # Runs community detection algorithms
│   ├── run_clustering_v2.py            # Executes clustering pipeline
│   ├── analyze_clusters.py             # Analyzes cluster results
│   └── visualize_interactive_v5.py     # Generates interactive HTML visualization
├── tests/                              # Pytest test suite (75 tests)
│   ├── test_api.py                     # REST API route and helper tests
│   ├── test_ingestion.py               # Data ingestion and format validation tests
│   └── test_senator_graph.py           # Graph construction and clustering tests
├── .github/workflows/                  # GitHub Actions CI/CD
├── requirements.txt                    # Python dependencies
├── pyproject.toml                      # Project metadata
└── README.md
```

---

## 1. Requirements

### Frontend
**Languages:** JavaScript (ES6+), HTML5, CSS3

**Libraries (loaded via CDN — no installation required):**

| Library | Version | Purpose |
|---------|---------|---------|
| D3.js | v7 | Map rendering and SVG visualization |
| TopoJSON | v3 | US map geographic data |
| Google Fonts | - | Playfair Display, DM Sans typography |

**APIs:**

| API | Purpose |
|-----|---------|
| AWS API Gateway | Fetches representative data from DynamoDB |
| Google Gemini API | AI chatbot (`gemini-3-flash-preview`) |
| US Atlas TopoJSON CDN | US state map shapes |

### Backend
**Language:** Python 3.12

**Required Libraries:**

| Library | Version | Purpose |
|---------|---------|---------|
| boto3 | >=1.34 | AWS DynamoDB access |
| flask | >=3.0 | REST API framework |
| flask-cors | >=4.0 | Cross-origin resource sharing |
| neo4j | >=5.0 | Neo4j graph database driver |
| networkx | >=3.3 | Graph construction and analysis |
| scikit-learn | >=1.4 | Community detection algorithms |
| numpy | >=1.26 | Numerical computations |
| requests | >=2.31 | HTTP requests to Congress.gov API |
| playwright | >=1.40 | Browser automation for Bioguide scraping |
| python-dotenv | >=1.0 | Environment variable management |
| pytest | >=8.0 | Testing framework |
| moto | >=5.0 | AWS mocking for tests |
| flake8 | >=7.0 | Code style enforcement |

**Installation:**

```bash
# Clone the repository
git clone https://github.com/your-team/us-congress-analytics.git
cd us-congress-analytics

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate       # Mac/Linux
venv\Scripts\activate          # Windows

# Install all dependencies
python -m pip install -r requirements.txt

# Install Playwright browser
playwright install chromium
```

**Environment Variables** — create a `.env` file at the root:

```
CONGRESS_API_KEY=your_congress_api_key
NEO4J_URI=neo4j+s://your-instance.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_password
GEMINI_API_KEY=your_gemini_api_key
```

---

## 2. Data Collection / Preparation

There are four data collection scripts. Run them in this order:

### Step 1 — Scrape Bioguide member bios
Scrapes the Bioguide website using Playwright to collect biographical data for all historical US representatives. Stores records in the `Reps` DynamoDB table.

```bash
python ingestion/bioguide_members.py --letters A-Z --table Reps --region us-east-2
```

| Argument | Default | Description |
|----------|---------|-------------|
| `--letters` | A | Letters to scan e.g. `A-Z` or `A,B,C` |
| `--table` | required | DynamoDB table name |
| `--region` | us-east-2 | AWS region |
| `--headless` | false | Run browser without visible window |
| `--stop-after-misses` | 3 | Stop after N consecutive misses |

### Step 2 — Fetch current members from Congress.gov API
Fetches current members for a given congress from the Congress.gov API and updates missing fields in the `Reps` table. Never overwrites existing data.

```bash
python ingestion/current_reps_ingestion.py --congress 119 --table Reps

# Preview changes without writing to DynamoDB
python ingestion/current_reps_ingestion.py --congress 119 --table Reps --dry-run
```

| Argument | Default | Description |
|----------|---------|-------------|
| `--congress` | 119 | Congress number to fetch |
| `--table` | required | DynamoDB table name |
| `--total` | 545 | Max members to process, 0 = all |
| `--dry-run` | false | Preview without writing to DynamoDB |

### Step 3 — Populate RepTerms table
Reads all records from the `Reps` table and creates one record per congress term per representative in the `RepTerms` table. Enables fast map queries (under 1 second instead of 7 seconds).

```bash
python ingestion/populate_repterms.py
```

### Step 4 — Fetch Senate bills
Fetches Senate bills from the Congress.gov API into the `bills` DynamoDB table. Supports incremental updates.

```bash
# Fetch latest 100 bills
python ingestion/bills_senate.py --congress 119 --table bills --total 100

# Full ingestion
python ingestion/bills_senate.py --congress 119 --table bills --full

# Incremental from a specific date
python ingestion/bills_senate.py --congress 119 --table bills \
    --from-date 2025-01-01T00:00:00Z
```

| Argument | Default | Description |
|----------|---------|-------------|
| `--congress` | 119 | Congress number |
| `--table` | bills | DynamoDB table name |
| `--total` | 10 | Max bills to fetch, 0 = all |
| `--full` | false | Force full ingestion |
| `--from-date` | None | Only fetch bills updated after this date |

### Data Verification Test

```bash
python -m pytest tests/test_ingestion.py -v
```

### Frontend API Verification
Open browser console and run:

```javascript
fetch("https://e7hb257lv6.execute-api.us-east-2.amazonaws.com/prod/reps/map?congress=119&chamber=house")
  .then(r => r.json())
  .then(d => console.log(`✅ ${d.count} representatives loaded`))
  .catch(e => console.error("❌ API error:", e));
```
Expected: `✅ 435 representatives loaded`

---

## 3. Model Training — Senate Co-sponsorship Graph

Builds a weighted graph where each node is a senator and each edge represents the number of bills they co-sponsored together. Runs community detection algorithms to identify clusters of senators with shared policy interests.

### Step 1 — Build the co-sponsorship graph

```bash
python senator_graph/build_graph.py
```

### Step 2 — Load graph into Neo4j

```bash
python senator_graph/load_neo4j.py
```

### Step 3 — Run community detection
Runs Louvain, Label Propagation, Spectral Clustering, and Greedy Modularity algorithms:

```bash
python senator_graph/run_clustering_v2.py
```

### Step 4 — Identify and label clusters

```bash
python senator_graph/identify_clusters.py
```

### Model Verification Test

```bash
python -m pytest tests/test_senator_graph.py -v
```

---

## 4. Data Exploration / Visualization

### Interactive Congress Map (Frontend)

Open `frontend/congress-map.html` directly in a browser, or run a local server:

```bash
python3 -m http.server 8000
# Open: http://localhost:8000/frontend/congress-map.html
```

**Map Features:**

| Feature | Description |
|---------|-------------|
| State badges | Rep count shown at center of each state |
| Chamber filter | Switch between House and Senate |
| Congress filter | Browse all 119 Congresses (1789–2027) |
| State zoom | Click any state to zoom in |
| Rep dots | 🔵 Democrat · 🔴 Republican · ⚫ Independent |
| Hover tooltip | Shows representative name on hover |
| Name scroll list | Lists all reps for the selected state |

**Dot placement:**
- **House** — geographic centroid of each congressional district
- **Senate** — state center (left/right for wide states, above/below for narrow)

### Senate Co-sponsorship Graph Visualization

```bash
python senator_graph/visualize_interactive_v5.py
# Generates senate_graph_v5.html — open in any browser
```

Features:
- Click nodes to see senator details (name, state, party, cluster)
- Click legend items to highlight a single community
- Hover tooltips on nodes and edges
- Zoom and pan the network

### Cluster Analysis

```bash
python senator_graph/analyze_clusters.py

# Report for a specific algorithm only
python senator_graph/analyze_clusters.py --algo louvain_res0.5

# Include cross-party analysis
python senator_graph/analyze_clusters.py --algo louvain_res0.5 --cross-party
```

---

## 5. Results Postprocessing / Visualization

### REST API

The REST API exposes processed congressional data for the frontend map.

**Run locally:**

```bash
cd api
python main.py
# Runs at http://localhost:5001
```

**Endpoints:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check |
| `/reps/map?congress=119&chamber=senate` | GET | Members for US map display |
| `/reps/congresses` | GET | List of available congress numbers |
| `/reps?name=Warren&party=Democrat` | GET | Search with optional filters |
| `/reps/<bioguide_id>` | GET | Single representative by bioguide ID |

**Example requests:**

```bash
# Get all Senate members for the 119th Congress
curl "http://localhost:5001/reps/map?congress=119&chamber=senate"

# Search by name
curl "http://localhost:5001/reps?name=Warren"

# Get a single representative
curl "http://localhost:5001/reps/W000817"
```

### AI Chatbot (Rep Card)

When a user clicks a representative dot on the map, a rep card appears below with an AI chatbot. The chatbot uses Google Gemini API with the representative's data as context.

**To test:**
1. Open `frontend/congress-map.html` in browser
2. Click any state → click any dot → scroll down to rep card
3. Click a suggestion chip or type a question
4. Expected: AI responds within 2–3 seconds

### API Verification Test

```bash
python -m pytest tests/test_api.py -v
```

### Run All Tests

```bash
python -m pytest tests/ -v --durations=0
```

75 tests covering API routes, data format validation, graph construction, and clustering output. All tests run without real AWS or Neo4j connections using `moto` for DynamoDB mocking.

---

## CI/CD

GitHub Actions runs automatically on every push:
- **Flake8** — enforces code style on pushes to `main`
- **Pytest** — runs full test suite on every branch

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | JavaScript, HTML5, CSS3 |
| Map Library | D3.js v7 + TopoJSON |
| AI Chatbot | Google Gemini API (gemini-3-flash-preview) |
| Backend | Python 3.12 + Flask |
| Serverless | AWS Lambda + API Gateway |
| Database | AWS DynamoDB |
| Graph Database | Neo4j AuraDB |
| Graph Analysis | NetworkX, scikit-learn |
| Data Collection | Playwright, Requests |
| Testing | Pytest, moto |
| CI/CD | GitHub Actions |

---

## Team

| Name | Role |
|------|------|
| **Aditi Reddy Doma** | Frontend — Interactive Congress Map, AI Chatbot Integration |
| **Sai Kiran** | Backend — Data Pipeline, REST API, Neo4j Graph Analysis |
| **Professor Tony Harkin** | Project Advisor |
