# System Architecture

## Overview

This project makes U.S. Congressional legislative data accessible to the public through graph-based data modeling, interactive visualization, and a conversational AI chatbot.

- **Aditi Reddy Doma** — Data ingestion, Interactive US Map, Semester 2 GraphRAG chatbot
- **Sai Kiran Gopu** — REST API, Senate co-sponsorship graph, Community detection, Semester 2 evaluation framework

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          DATA SOURCES                                    │
│         Bioguide API                    Congress.gov API                 │
│   (12,310 members, 119 Congresses)   (119th Congress members + bills)   │
└──────────────┬──────────────────────────────────┬───────────────────────┘
               │                                  │
               ▼                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        DATA INGESTION (Aditi)                            │
│   bioguide_members.py         current_reps_ingestion.py                  │
│   populate_repterms.py        bills_senate.py                            │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        AWS DYNAMODB                                      │
│                                                                          │
│  Reps table          RepTerms table         SenateBills table            │
│  (12,310 records)    (49,778 records)       (Senate bills +              │
│  one record/person   one record/term        sponsors/co-sponsors)        │
│  full bio data       congress, chamber,                                  │
│                      bioguideId                                          │
└──────────┬───────────────────────────────────────────┬───────────────────┘
           │                                           │
           ▼                                           ▼
┌──────────────────────────┐           ┌───────────────────────────────────┐
│  REST API (Sai Kiran)    │           │  CO-SPONSORSHIP GRAPH (Sai Kiran) │
│  Python 3.12 AWS Lambda  │           │  build_graph.py                   │
│  1024MB, 29s timeout     │           │  load_neo4j.py                    │
│  Flask + serverless-wsgi │           │  run_clustering_v2.py             │
│  API Gateway (us-east-2) │           │  analyze_clusters.py              │
│                          │           │  identify_clusters.py             │
│  GET /reps/map           │           └──────────────────┬────────────────┘
│  GET /reps/congresses    │                              │
└──────────┬───────────────┘                              ▼
           │                              ┌───────────────────────────────────┐
           │                              │       NEO4J AURA DB               │
           │                              │  Senator nodes (100 senators)     │
           │                              │  Properties: bioguideId, name,    │
           │                              │  state, party, community          │
           │                              │  CO_SPONSORS edges (weight =      │
           │                              │  number of bills co-sponsored)    │
           │                              │  Centrality metrics: degree,      │
           │                              │  closeness, eigenvector           │
           │                              └──────────────────┬────────────────┘
           │                                                 │
           ▼                                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     FRONTEND DASHBOARD (Aditi)                           │
│                     frontend/congress-map.html                           │
│                                                                          │
│  ┌────────────────────────────┐    ┌──────────────────────────────────┐  │
│  │   Interactive US Map       │    │    Rep Card + AI Chatbot         │  │
│  │   D3.js + TopoJSON         │    │                                  │  │
│  │   50 states colored        │    │  Semester 1: Gemini API chatbot  │  │
│  │   Rep count badges         │    │  (bio, party, state as context)  │  │
│  │   Zoom + dots per rep      │    │                                  │  │
│  │   Blue=Dem, Red=Rep        │    │  Semester 2: GraphRAG chatbot    │  │
│  │   Hover tooltips           │    │  grounded in Neo4j graph         │  │
│  │   Name scroll list         │    │  e.g. "Which NY senators support │  │
│  │                            │    │  AI research?"                   │  │
│  │   Semester 2:              │    │                                  │  │
│  │   Community cluster        │    │                                  │  │
│  │   overlays on map          │    │                                  │  │
│  └────────────────────────────┘    └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              SEMESTER 2 EVALUATION FRAMEWORK (Sai Kiran)                 │
│   Measures chatbot accuracy: context adherence, hallucination rate       │
│   Quantitative comparison: Baseline LLM vs GraphRAG                     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## DynamoDB Design

### Why Two Tables?

The original design stored all terms as a nested list inside each representative record. This required a full scan of 12,310 records per map request, taking ~7 seconds.

The normalized two-table design:
1. Queries `RepTerms` first → retrieves only relevant bioguideIds (e.g. 437 for a House request)
2. Calls `BatchGetItem` on `Reps` → fetches only those records

**Result: response time reduced from ~7 seconds to under 1 second.**

| Table | Records | Description |
|-------|---------|-------------|
| `Reps` | 12,310 | One record per person, full biographical data |
| `RepTerms` | 49,778 | One record per congress term (congress, chamber, bioguideId) |
| `SenateBills` | varies | Senate bills with sponsor and co-sponsor bioguideIds |

---

## REST API

- **Runtime:** Python 3.12 AWS Lambda
- **Memory:** 1024 MB, 29-second timeout
- **Region:** us-east-2
- **Framework:** Flask + serverless-wsgi + Serverless Framework v4
- **Deploy:** `sls deploy --stage prod` from `api/` directory

| Endpoint | Description |
|----------|-------------|
| `GET /reps/map?congress=119&chamber=senate` | All members for given congress and chamber |
| `GET /reps/congresses` | Available congress numbers (1–119) for dropdown |

**Live API:**
```
https://e7hb257lv6.execute-api.us-east-2.amazonaws.com/prod/reps/map?congress=119&chamber=senate
```

---

## Senate Co-Sponsorship Graph

### Nodes
100 senators of the 119th Congress with properties:
- `bioguideId`, `name`, `state`, `party`, `community`

### Edges
`CO_SPONSORS` edges with:
- `weight` = number of bills co-sponsored together
- `direction` = sponsor–co-sponsor relationship

### Centrality Metrics (pre-computed at build time)
| Metric | Description |
|--------|-------------|
| **Degree** | Number of distinct co-sponsorship partners |
| **Closeness** | Inverse mean shortest path to all other senators |
| **Eigenvector** | Influence weighted by neighbors' influence |

### Community Detection Algorithms
| Algorithm | Method |
|-----------|--------|
| **Louvain** | Greedy modularity maximization (primary) |
| **Label Propagation** | Each node adopts neighbors' most frequent label |
| **Girvan-Newman** | Iteratively removes highest-betweenness edges |
| **Spectral** | Cross-validation algorithm |

Convergence of cluster assignments across all four indicates genuine community structure rather than algorithmic artifact.

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | JavaScript, HTML5, CSS3 |
| Map Library | D3.js v7 + TopoJSON v3 |
| AI Chatbot (S1) | Google Gemini API |
| AI Chatbot (S2) | GraphRAG + Neo4j |
| Backend | Python 3.12 + Flask |
| Serverless | AWS Lambda + API Gateway |
| Database | AWS DynamoDB |
| Graph Database | Neo4j AuraDB |
| Graph Analysis | NetworkX, scikit-learn |
| Data Collection | Playwright, Requests |
| Testing | Pytest, moto |
| CI/CD | GitHub Actions |
| Hosting | AWS S3 + CloudFront |
