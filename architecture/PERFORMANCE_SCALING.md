# Carina AI — Performance & Scaling Architecture

**How Carina stays fast at 10, 10K, or 1M queries/day**

---

## Where the Latency Comes From

```
User sends query
    │
    ▼
┌──────────────────┐
│ 1. RAG Search    │  pgvector: 5-50ms
└──────────────────┘
    │
    ▼
┌──────────────────┐
│ 2. External API  │  PropertyData: 200-800ms
│    (if needed)   │  Tavily: 500-2000ms
└──────────────────┘  EPC: 100-300ms
    │
    ▼
┌──────────────────┐
│ 3. AI Provider   │  DeepSeek: 1-3s (first token)
│    (LLM call)    │  OpenAI: 1-2s
└──────────────────┘  Anthropic: 2-5s
    │
    ▼
┌──────────────────┐
│ 4. Token Stream  │  DeepSeek: ~50 tok/s
│    (to user)     │  OpenAI: ~80 tok/s
└──────────────────┘  Anthropic: ~40 tok/s
    │
    ▼
   Response

Total: 2-8 seconds per query (without optimisation)
```

---

## Strategy 1: Multi-Layer Caching (Zero API Latency)

Most latency comes from external API calls. Eliminate them with caching:

### Cache Layers

| Layer | Stores | Hit Rate | Latency Saved |
|---|---|---|---|
| **L1: In-Memory (Redis)** | Hot area data, frequent queries | 40% of queries | 200-800ms |
| **L2: RAG (pgvector)** | All previously fetched + analysed data | 50% of the rest | 200-800ms + LLM analysis time |
| **L3: CDN (Cloudflare/Varnish)** | Static responses, area reports | 5% | Full round-trip |

### How It Works in Practice

```
Query: "What's the yield in Birmingham B1?"
    │
    ├─ L1: Redis hit? → Return cached ─── 2ms total
    │
    ├─ L2: RAG hit and fresh? → Return RAG ─── 50ms total
    │
    └─ L3: Miss → Fetch external API → Analyse → Store in L1+L2 → Return
         └── 2-8 seconds (only happens once per area per cache period)
```

**After month 1:** 95% of common queries hit L1 or L2. Average response time: **30-100ms**.

---

## Strategy 2: Predictive Pre-Fetching (Answer Before They Ask)

Carina doesn't wait for the user to ask. She predicts what data will be needed and fetches it in advance.

```
┌─────────────────────────────────────────────┐
│  Celery Scheduler (runs daily at 02:00)      │
│                                              │
│  For each frequently queried area:           │
│    ├─ PropertyData: refresh metrics          │
│    ├─ Tavily: fetch latest news              │
│    ├─ Analyse + store in RAG                 │
│    └─ Warm Redis cache                       │
│                                              │
│  For trending locations:                     │
│    └─ Pre-fetch data before users ask        │
└─────────────────────────────────────────────┘
```

| Trigger | Action | Benefit |
|---|---|---|
| User queries B1 → schedules B2, B3, B4 pre-fetch | Neighbouring areas fetched overnight | Next query to nearby area: instant |
| Daily at 02:00 | Refresh all data over 7 days old | Morning queries always fresh |
| Breaking property news detected by Tavily | Fetch + analyse + store | Carina knows about new regulations before users ask |

---

## Strategy 3: Streaming & Progressive Response

Users perceive speed when they see the first token fast. Don't wait for the full response.

```
Time ──────────────────────────────────────────────────────►

Without streaming:
│ Wait for all data + full LLM output ─────────────── 5s ──► Response revealed

With streaming + progressive:
│ "Analysing B1 data..." ──► "Checking yields..." ──► "Yield is 5.8%" ──► full report
│ 200ms                 400ms                    700ms                2s
```

**Implementation:**
1. Start streaming a placeholder immediately: *"Analysing Birmingham B1..."*
2. Show intermediate context as it loads: *"Fetching area data..."* → *"Checking recent sales..."*
3. Stream LLM tokens as they arrive via SSE (Server-Sent Events)
4. User sees progress within **200ms**, full response in **2-4s**

---

## Strategy 4: Async Heavy Lifting

Don't block the user on slow work. Split requests into "fast path" and "slow path".

```
Fast Path (always synchronous):
  ├─ Chat: simple Q&A, known topics
  ├─ RAG-only queries (data already cached)
  └─ Deal calculator (pure computation, <10ms)

Slow Path (async + notify):
  ├─ Full area report (multiple API calls + LLM analysis)
  ├─ Portfolio analysis (scan many properties)
  ├─ Custom ML model inference
  └─ Document ingestion (OCR, chunking, embedding)

User receives:
  "Analysing your portfolio. This will take ~30 seconds.
   I'll send the report to your inbox when it's ready."
```

---

## Strategy 5: Horizontal Scaling (Threads, Workers, Pods)

| Component | Scaling Strategy | Bottleneck | Solution |
|---|---|---|---|
| **Laravel (Web + API)** | Multiple PHP-FPM workers or Swoole/Ocotber | CPU, memory | 10-50 workers per VPS. Add VPS as needed. |
| **Python FastAPI (ML)** | Async event loop + multiple workers | CPU (inference), GPU (training) | 4-8 workers. GPU instance for training. |
| **PostgreSQL + pgvector** | Connection pooling (PgBouncer), read replicas | Disk I/O, RAM | PgBouncer for connections. Replicas for reads. |
| **Redis** | Single instance (fast enough) | RAM | Vertically scale RAM. Cluster for extreme load. |

### Estimated Capacity Per VPS (Contabo Cloud VPS M: 8 vCPU, 16GB RAM)

| Workload | Queries/Day | Concurrent Users | Response Time |
|---|---|---|---|
| Light (no external APIs, RAG-cached) | 100,000 | 500 | 50-200ms |
| Medium (some API calls, streaming) | 30,000 | 200 | 1-3s |
| Heavy (full analysis, ML inference) | 5,000 | 50 | 3-8s |

### Scaling Beyond One VPS

```
Load Balancer (Nginx/HaProxy)
    │
    ├── Laravel App 1 ──┐
    ├── Laravel App 2 ──┤── Shared PostgreSQL + Redis
    ├── Laravel App 3 ──┘
    │
    ├── Python ML 1 (FastAPI)
    └── Python ML 2 (Celery workers)
```

Each additional app server adds 30,000-100,000 queries/day capacity.

---

## Strategy 6: GPU Acceleration (Python ML Engine)

GPU matters for the ML engine, not the Laravel layer.

| Task | CPU Time | GPU Time | GPU Needed? |
|---|---|---|---|
| LLM chat (DeepSeek/OpenAI) | N/A (API call) | N/A | No — provider handles it |
| RAG embedding (Google Gemini) | N/A (API call) | N/A | No — provider handles it |
| **Property valuation (XGBoost)** | 200ms | — | No — XGBoost is CPU-optimised |
| **Area scoring (ensemble)** | 300ms | — | No — lightweight |
| **Portfolio analysis** | 500ms | — | No — data aggregation |
| **Fine-tuning (LoRA adapter)** | 2 hours | 15 minutes | **Yes, if doing fine-tuning** |
| **Custom neural network** | 5s per inference | 50ms per inference | **Yes, if building custom NNs** |
| **Batch document processing** | 1s per doc | — | No — I/O bound, not compute |

**Recommendation:** Start CPU-only. Add a GPU instance (£50-100/mo) when fine-tuning or custom models become the bottleneck.

---

## Strategy 7: Smart Provider Routing for Speed

Not all providers are equal on speed. Route strategically:

| Query Type | Provider | Why |
|---|---|---|
| Simple Q&A ("What is BRR?") | DeepSeek | Fast first token (~500ms) |
| Streaming chat | DeepSeek / OpenAI | Fast token generation (50-80 tok/s) |
| Complex analysis ("Analyse this portfolio") | Anthropic | Slower but more thorough. Worth the wait. |
| RAG-only (no LLM needed) | None | Instant from cache. No provider call. |
| Urgent ("Is this compliant?") | DeepSeek (routed with priority) | Bypass queue, lowest latency |

---

## Strategy 8: Queue + Debounce for High Traffic

When thousands of users query simultaneously, don't process everything at once.

```
Incoming requests
    │
    ▼
┌─────────────────────┐
│  Request Classifier  │
│  ├─ Hot (cached): process immediately
│  ├─ Warm (needs API): queue + debounce
│  └─ Cold (new area): queue, notify async
└─────────────────────┘
```

**Debounce identical queries:**
- Multiple users ask about B1 within 10 seconds
- First query triggers the API call
- Subsequent queries wait for the first to finish, then share the result
- Saves 10 redundant API calls

---

## Performance Budget (Targets)

| Metric | Target (Normal) | Target (Peak) |
|---|---|---|
| Time to first token (cached) | <100ms | <200ms |
| Time to first token (fresh query) | <2s | <4s |
| P95 response time | <3s | <6s |
| Concurrent users per VPS | 200 | 500 |
| Queries/day per VPS | 30,000 | 100,000 |
| Uptime | 99.9% | 99.5% |
| API provider fallover | <1s | <3s |

---

## File Structure

```
app/Services/
├── Performance/
│   ├── CacheWarmer.php             # Predictive pre-fetching
│   ├── RequestClassifier.php       # Hot/warm/cold routing
│   ├── QueryDebouncer.php          # Debounce identical queries
│   └── ProgressiveResponder.php    # Streaming + intermediate context

config/performance.php              # Cache TTLs, pre-fetch schedules, scaling thresholds
```
