# Carina AI — Property Data Integrations

**Last updated:** 8 May 2026  
**Status:** Architecture specification  

---

## Core Principle: Every API Call Trains the System

When Carina calls an external data API (PropertyData, Tavily, EPC, etc.), the retrieved data is **automatically analysed, contextualised, and stored into Carina's RAG pipeline**. This means:

- Every area report makes Carina smarter about that area.
- Every valuation becomes a reference point for future valuations.
- Every news article becomes part of her knowledge base.
- Over time, Carina needs fewer external API calls because she already knows the answer.
- The system is **self-improving** — the more users ask, the smarter Carina gets.

```
User asks a question
         │
         ▼
┌─────────────────────────────────┐
│ 1. Does Carina already know?    │
│    (Check RAG → cache)          │
│    ├─ YES → Answer immediately   │
│    └─ NO  → Fetch from API      │
└─────────────────────────────────┘
         │ (miss)
         ▼
┌─────────────────────────────────┐
│ 2. Call external API            │
│    ├─ PropertyData.co.uk         │
│    ├─ Tavily                     │
│    ├─ EPC API                    │
│    └─ Others                     │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ 3. Analyse + structure data     │
│    ├─ LLM summarises raw data    │
│    ├─ Extract key facts/metrics  │
│    └─ Tag with metadata         │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ 4. Store into RAG               │
│    ├─ Chunk analysed content     │
│    ├─ Generate embedding         │
│    ├─ Store in tenant's pgvector │
│    └─ Cache for future use      │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ 5. Answer the user              │
│    ├─ LLM + RAG context          │
│    └─ Live data + past knowledge │
└─────────────────────────────────┘
```

---

## Automatic Ingestion Pipeline

```
fetchAndIngest(request)
  ├─ Check cache → hit? Return cached.
  ├─ Fetch from external API (PropertyData, Tavily, etc.)
  ├─ Analyse: LLM summarises raw data into structured knowledge
  │    ├─ Summary text
  │    ├─ Key facts list
  │    └─ Metrics table
  ├─ Ingest into RAG: chunk → embed → store in tenant pgvector
  │    ├─ Title: "Live Data: {location} — {type}"
  │    ├─ Metadata: source, type, location, fetched_at, auto_ingested=true
  │    └─ Content: natural-language formatted for semantic search
  ├─ Cache for cache_duration
  └─ Return analysed data
```

---

## Data Types & Ingestion Rules

| Data Type | Source | Analysed Into | RAG Category | Cache | Auto-Ingest |
|---|---|---|---|---|---|
| Area metrics | PropertyData | Structured area profile | area_data | 7 days | Always |
| Valuation | PropertyData | Comparable evidence report | valuation | 24h | Always |
| Sold prices | PropertyData | Market activity summary | market_data | 30 days | Always |
| Planning apps | PropertyData | Development activity report | planning | 7 days | Always |
| Rental data | PropertyData | Rental market summary | rental_data | 7 days | Always |
| Web search | Tavily | News summary + key facts | market_news | 2h | Always |
| EPC certificate | EPC API | Property energy profile | epc_data | 90 days | Always |
| Land Registry | LR API | Price paid analysis | market_data | 30 days | Always |
| Council planning | Council portal | Planning decision summary | planning | 7 days | Always |

---

## Carina's Decision Flow: RAG-First

Every query follows this priority:

1. **RAG search** — Does the tenant's knowledge base already contain relevant data?
2. **Sufficient?** — Is the cached data fresh enough (per data type threshold)?
3. **If yes** — Answer from RAG alone. No external API call. No cost.
4. **If no** — Fetch from external API. Auto-analyse. Auto-ingest. Cache. Then answer.

This means:
- After the first query for "Birmingham B1 yields", subsequent queries get instant RAG answers.
- After 6 months, most queries never touch external APIs — Carina has already learned.
- Each tenant builds their own unique location knowledge base over time.

---

## Implementation Phases

### Phase 1: Manual Fetch (Week 1-2)
- Carina calls APIs on demand. Returns results. Does not ingest.
- Validate responses, handle errors, implement caching.

### Phase 2: Auto-Ingest (Week 3-4)
- Every API response is LLM-analysed and stored in RAG.
- Chunking, metadata, embedding pipeline.

### Phase 3: RAG-First (Week 5-6)
- Before any API call: check RAG first.
- If sufficient fresh data exists, skip API entirely.
- Configurable freshness per data type.

### Phase 4: Proactive Ingestion (Week 7-8)
- Scheduled tasks to refresh frequently queried areas.
- Pre-fetch for trending locations.
- Daily market news digest auto-ingested from Tavily.

---

## Architecture: Data Layer

```
Carina AI
    │
    ├──► PropertyData.co.uk    Area metrics, yields, sold prices, planning
    ├──► Tavily                Web search — news, regulations, trends
    ├──► EPC API               Energy certificates, ratings, improvements
    ├──► Land Registry API     Official sold prices (planned)
    ├──► Google Maps/Places    Amenities, transport, schools (planned)
    └──► Council APIs          Planning applications, licensing (planned)
```

All data flows through:
1. Integration adapter (parses provider-specific format)
2. Ingestion pipeline (analyses + stores in RAG)
3. Cache layer (reduces API calls)
4. RAG store (tenant's pgvector — becomes smarter over time)

---

## File Structure

```
app/Services/Data/
├── Integrations/
│   ├── PropertyDataIntegration.php
│   ├── TavilyIntegration.php
│   ├── EpcIntegration.php
│   ├── LandRegistryIntegration.php
│   └── GoogleMapsIntegration.php
├── DataIngestionPipeline.php      # Fetch → analyse → store in RAG
├── SmartDataService.php           # RAG-first decision flow
├── DataCacheService.php           # Cache-first with freshness thresholds
└── Contracts/
    └── DataIntegrationInterface.php

config/data-integrations.php       # API keys, base URLs, cache durations
```
