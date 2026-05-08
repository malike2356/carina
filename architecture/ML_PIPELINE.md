# Carina AI — ML Pipeline

**Engine:** Python 3.12 + FastAPI + Celery  
**Models:** PyTorch, scikit-learn, numpy, pandas  
**Training:** Per-tenant fine-tuning (opt-in)  

---

## Services

| Service | Framework | Port | Purpose |
|---|---|---|---|
| `api` | FastAPI | 8001 | HTTP interface for Laravel to call |
| `celery-worker` | Celery + Redis | — | Background model inference + training |
| `celery-beat` | Celery | — | Scheduled tasks (daily digest, weekly report) |

## Communication

```
Laravel ───HTTP POST───► FastAPI /api/predict
Laravel ───HTTP POST───► FastAPI /api/analyze
Laravel ───Dispatch job─► Celery (via Redis) ───► Worker processes
                            Worker writes results to Postgres
                            Laravel reads from Postgres
```

## Models

### P1: Property Valuation Model

**Input:** Address, property type, bedrooms, bathrooms, sqft, condition, recent sales in area, council tax band, EPC rating.

**Output:** Predicted market value + confidence interval.

**Algorithm:** Gradient Boosting (XGBoost/LightGBM) or ensemble. Train on Land Registry price-paid data + Rightmove listing data.

**Accuracy target:** ±5% median error.

### P1: Area Scoring Model

**Input:** Postcode/radius.

**Output:** Investment score (1-100) across dimensions: yield potential, capital growth, rental demand, development activity, risk.

**Algorithm:** Weighted multi-factor scoring. Factors: yield, price trend, transaction volume, planning applications, employment data, crime stats, school ratings.

### P1: Deal Risk Assessment

**Input:** Full deal figures (purchase, refurb, rent, finance costs, timeline).

**Output:** Risk rating (low/medium/high) + risk factors identified.

**Algorithm:** Rule-based + ML hybrid. Rules for known red flags. ML for pattern matching against historical deal outcomes.

## Batch Processing (Celery)

| Task | Schedule | Description |
|---|---|---|
| `daily-market-digest` | Daily 06:00 | Scrape market data, update area scores, generate trend report |
| `weekly-portfolio-report` | Weekly Mon 08:00 | Analyse opt-in portfolios, email report |
| `monthly-model-retrain` | Monthly 1st | Retrain models on new opt-in data + fresh market data |
| `process-rss-feeds` | Hourly | Check subscribed RSS feeds, ingest new content into RAG |

## Fine-Tuning (Continuous Learning)

Only for opt-in users. Pipeline:

1. User opts in → `training_opt_in = true` on tenant record.
2. Anonymised conversations + uploaded knowledge are collected.
3. Weekly: new data is deduplicated, formatted, and queued for training.
4. A **LoRA adapter** is trained per tenant (not the base model). Small, fast, isolated.
5. Adapter is served alongside the base model for that tenant's queries.
6. Adapter can be deleted on user request (full GDPR compliance).

**Storage:** Adapters are <100 MB each. Fine-tuned on a CPU (cheap) or GPU (fast — optional).

## Data Privacy

- All ML training data is tenant-isolated.
- Opt-in is granular: conversation data only, document data only, or both.
- Opt-out deletes all training data and fine-tuned adapters within 7 days.
- No tenant data is used to train public/general models.
