# System Architecture

## Overview

The US Congress Analytics platform consists of four main components that work together to collect, store, analyze, and visualize congressional data.

```
┌─────────────────────────────────────────────────────────────┐
│                        DATA SOURCES                          │
│   Bioguide Website        Congress.gov API                   │
│   (biographical data)     (members + bills)                  │
└──────────────┬──────────────────────┬───────────────────────┘
               │                      │
               ▼                      ▼
┌─────────────────────────────────────────────────────────────┐
│                     INGESTION LAYER                          │
│   bioguide_members.py    current_reps_ingestion.py           │
│   bills_senate.py        populate_repterms.py                │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      AWS DYNAMODB                            │
│   Reps table             RepTerms table     Bills table      │
│   (biographical data)    (fast map queries) (senate bills)   │
└────────────┬─────────────────────────────────┬──────────────┘
             │                                 │
             ▼                                 ▼
┌────────────────────────┐      ┌──────────────────────────────┐
│     REST API (Flask)   │      │    SENATOR GRAPH PIPELINE     │
│     api/main.py        │      │    build_graph.py             │
│                        │      │    load_neo4j.py              │
│  /reps/map             │      │    run_clustering_v2.py       │
│  /reps/congresses      │      │    identify_clusters.py       │
│  /reps?name=...        │      └──────────────┬───────────────┘
│  /reps/<id>            │                     │
└────────────┬───────────┘                     ▼
             │                    ┌────────────────────────────┐
             │                    │       NEO4J AURADB          │
             │                    │  Senator nodes             │
             │                    │  Co-sponsorship edges      │
             │                    │  Community clusters        │
             │                    └──────────────┬─────────────┘
             │                                   │
             ▼                                   ▼
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND DASHBOARD                         │
│              frontend/congress-map.html                       │
│                                                              │
│   ┌─────────────────────┐    ┌──────────────────────────┐   │
│   │   Interactive Map    │    │      Rep Card + Chatbot   │   │
│   │   D3.js + TopoJSON  │    │   Semester 1: Gemini API  │   │
│   │   50 states         │    │   Semester 2: GraphRAG    │   │
│   │   Zoom + dots       │    │   (Neo4j grounded)        │   │
│   └─────────────────────┘    └──────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### Map Data Flow
1. User opens `congress-map.html`
2. Browser fetches US map shapes from TopoJSON CDN
3. D3.js renders 50 states with pastel colors
4. Frontend calls REST API: `GET /reps/map?congress=119&chamber=house`
5. API queries DynamoDB RepTerms table
6. Returns list of representatives with party, state, district, bio
7. D3.js places colored dots on the map

### Rep Card Data Flow
1. User clicks a dot on the map
2. Rep card appears below the map
3. Shows photo, name, party, chamber history, born/died dates
4. User types question in AI chat
5. **Semester 1:** Gemini API generates response using rep's bio as context
6. **Semester 2:** GraphRAG queries Neo4j graph → retrieves relevant senators and co-sponsorships → LLM generates grounded response

### Graph Pipeline Data Flow
1. Bills ingested from Congress.gov API
2. Co-sponsorships extracted from bill data
3. NetworkX graph built: senators = nodes, co-sponsorships = weighted edges
4. Community detection algorithms run (Louvain, Label Propagation, Spectral, Greedy)
5. Clusters identified and labeled
6. Graph loaded into Neo4j AuraDB
7. Interactive HTML visualization generated

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | HTML5, CSS3, JavaScript (ES6+) |
| Map Rendering | D3.js v7 + TopoJSON v3 |
| AI Chatbot (S1) | Google Gemini API |
| AI Chatbot (S2) | GraphRAG + Neo4j |
| REST API | Flask 3.0 + AWS Lambda |
| Primary Database | AWS DynamoDB |
| Graph Database | Neo4j AuraDB |
| Graph Analysis | NetworkX + scikit-learn |
| Data Collection | Playwright + Requests |
| Testing | Pytest + moto |
| CI/CD | GitHub Actions |
| Hosting | AWS S3 + CloudFront |
