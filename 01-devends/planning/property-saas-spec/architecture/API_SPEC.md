# Carina AI - API Specification

**Version:** 1.0  
**Base URL:** `https://carina.verlox.uk/api/v1`  
**Auth:** Bearer token (`Authorization: Bearer {api_key}`)  

---

## Authentication

All API requests require an API key. Generate keys from the web UI (`/settings/api-keys`).

```http
Authorization: Bearer ca_live_abc123def456
```

Rate limits:
- Free tier: 10 req/min
- Starter: 60 req/min
- Professional: 300 req/min
- Enterprise: Custom

---

## Endpoints

### Chat

```http
POST /v1/chat
Content-Type: application/json

{
  "message": "What's the yield on a BTL at £350k with £2k rent?",
  "conversation_id": "optional-uuid",
  "context": {
    "page": "/deals",
    "tenant_id": "optional"
  }
}

Response:
{
  "reply": "At 5% interest with a £70k deposit...",
  "conversation_id": "uuid",
  "sources": [
    {"title": "UK Sourcing Manual", "relevance": 0.89}
  ],
  "tokens_used": 1245,
  "provider_used": "deepseek"
}
```

### Stream Chat

```http
POST /v1/chat/stream
Content-Type: application/json

{
  "message": "Analyse this deal...",
  "conversation_id": "uuid"
}

Response: SSE stream of tokens
```

### Knowledge

```http
POST /v1/knowledge/upload
Content-Type: multipart/form-data

file: document.pdf
source: "optional source name"

Response:
{
  "document_id": 42,
  "status": "processing",
  "chunks": 15
}
```

```http
GET /v1/knowledge/search?q=HMO+licensing+requirements&limit=5

Response:
{
  "results": [
    {"chunk": "Manchester requires minimum 6.51 sqm...", "score": 0.92}
  ]
}
```

### Analysis

```http
POST /v1/analyze/deal
Content-Type: application/json

{
  "strategy": "btl",
  "purchase_price": 350000,
  "deposit": 70000,
  "monthly_rent": 2000,
  "interest_rate": 5
}

Response:
{
  "monthly_cashflow": 1302,
  "gross_yield": 6.86,
  "net_yield": 4.46,
  "roi_pct": 69.42,
  "assumptions": [
    "Management fee: 12%",
    "Void rate: 5%"
  ]
}
```

```http
POST /v1/analyze/area
Content-Type: application/json

{
  "postcode": "M1 1AA",
  "radius_km": 5
}

Response:
{
  "avg_yield": 6.2,
  "price_trend": "up",
  "rental_demand": "high",
  "development_activity": 15,
  "score": 78
}
```

### Agent Bridge

```http
POST /v1/agent/chat
Content-Type: application/json

{
  "message": "What's the best strategy for this property?",
  "tool_results": [
    {"tool": "run_calculator", "result": {"monthly_cashflow": 1302}}
  ],
  "agent_name": "Propreneur"
}

Response:
{
  "reply": "Based on the BTL calculation showing positive cashflow...",
  "provider_used": "deepseek"
}
```

This endpoint is used by external agents (Propreneur, Loom, third-party). The agent sends its tool execution results, and Carina analyses them in context.

### Usage

```http
GET /v1/usage?from=2026-05-01&to=2026-05-08

Response:
{
  "total_chats": 1250,
  "total_api_calls": 3420,
  "tokens_used": 1450000,
  "by_provider": {
    "deepseek": 1100000,
    "google": 350000
  }
}
```

---

## Agent Integration (Bridge Mode)

Third-party property apps embed Carina as an intelligence layer:

```python
import requests

# Propreneur's Carina Agent calls Standalone Carina for intelligence
response = requests.post(
    "https://carina.verlox.uk/api/v1/agent/chat",
    headers={"Authorization": "Bearer ca_live_..."},
    json={
        "message": user_input,
        "tool_results": tool_outputs,  # what the agent just executed
        "context": {"tenant_id": "xelox"}
    }
)

carina_reply = response.json()["reply"]
```

The agent handles execution (creating contacts, running calculators). Carina Standalone handles intelligence (what to do, analysis of results, property knowledge).
