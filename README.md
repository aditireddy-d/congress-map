# API Reference

The REST API is built with Flask and deployed on AWS Lambda + API Gateway.

**Base URL:** `https://e7hb257lv6.execute-api.us-east-2.amazonaws.com/prod`

**Local URL:** `http://localhost:5001` (when running `python api/main.py`)

---

## Endpoints

### GET /
Health check endpoint.

**Response:**
```json
{ "status": "ok" }
```

---

### GET /reps/map
Returns all members for a given congress and chamber. Used by the frontend map.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `congress` | integer | Yes | Congress number (1–119) |
| `chamber` | string | Yes | `house` or `senate` |

**Example:**
```bash
curl "http://localhost:5001/reps/map?congress=119&chamber=house"
curl "http://localhost:5001/reps/map?congress=118&chamber=senate"
```

**Response:**
```json
{
  "count": 435,
  "data": [
    {
      "bioguideId": "E000294",
      "name": "Ron Estes",
      "birth": "1956-07-19",
      "death": null,
      "image": "https://...",
      "url": "https://...",
      "Bio": "A Representative from Kansas...",
      "terms": [
        {
          "chamber": "House",
          "congress": 119,
          "district": 4,
          "state": "KS",
          "party": "Republican",
          "start": "2017",
          "departure": null
        }
      ]
    }
  ]
}
```

---

### GET /reps/congresses
Returns a list of all available congress numbers in the database.

**Example:**
```bash
curl "http://localhost:5001/reps/congresses"
```

**Response:**
```json
{ "congresses": [119, 118, 117, 116, ...] }
```

---

### GET /reps
Search representatives with optional filters.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | No | Search by name (partial match) |
| `party` | string | No | Filter by party |
| `state` | string | No | Filter by state abbreviation |

**Example:**
```bash
curl "http://localhost:5001/reps?name=Warren"
curl "http://localhost:5001/reps?party=Democrat&state=NY"
curl "http://localhost:5001/reps?name=Sanders"
```

**Response:**
```json
{
  "count": 1,
  "data": [
    {
      "bioguideId": "W000817",
      "name": "Elizabeth Warren",
      "party": "Democrat",
      "state": "MA",
      "birth": "1949-06-22"
    }
  ]
}
```

---

### GET /reps/\<bioguide_id\>
Returns a single representative by their Bioguide ID.

**Example:**
```bash
curl "http://localhost:5001/reps/W000817"
curl "http://localhost:5001/reps/S000033"
```

**Response:**
```json
{
  "bioguideId": "W000817",
  "name": "Elizabeth Warren",
  "birth": "1949-06-22",
  "death": null,
  "image": "https://...",
  "Bio": "A Senator from Massachusetts...",
  "terms": [...]
}
```

---

## Error Responses

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 400 | Bad request — missing required parameters |
| 404 | Representative not found |
| 500 | Internal server error |

---

## Running Tests

```bash
# Test all API endpoints
python -m pytest tests/test_api.py -v

# Test with sample data
python -m pytest tests/test_api.py -v -k "test_map"
```
