# Carina AI - Infrastructure Requirements

**From MVP to millions of users**

---

## Phase 1: MVP / Beta (First 500 users)

One VPS runs everything. Simple. Cheap. Fast to deploy.

### Single VPS Stack

```
┌──────────────────────────────────────────────────┐
│              CONTABO CLOUD VPS M                  │
│  Location: UK (Nuremberg or optional UK DC)       │
│  8 vCPU · 16 GB RAM · 400 GB SSD                 │
│  £24.99/month                                     │
│                                                   │
│  ┌─────────┐  ┌─────────┐  ┌──────────┐         │
│  │  Nginx  │  │ Laravel │  │  Python  │         │
│  │  (SSL + │  │ (Web +  │  │ (FastAPI │         │
│  │ reverse │  │  API)   │  │ + Celery)│         │
│  │  proxy) │  │         │  │          │         │
│  └─────────┘  └─────────┘  └──────────┘         │
│                                                   │
│  ┌──────────┐  ┌──────┐  ┌───────────┐          │
│  │PostgreSQL│  │ Redis│  │Meilisearch│          │
│  │  + vec   │  │(cache│  │ (search)  │          │
│  │          │  │+queue│  │           │          │
│  └──────────┘  └──────┘  └───────────┘          │
│                                                   │
│  All behind a single Docker Compose stack         │
└──────────────────────────────────────────────────┘
```

**What this handles:**
- 30,000 queries/day
- 500 active users
- 200 concurrent users
- All databases, workers, and queue processing on one machine
- Covered by 5 paying Pro users (£100/mo revenue vs £25/mo cost)

**Docker Compose services:**

```yaml
services:
  nginx:
    image: nginx:alpine
    ports: [80, 443]
    volumes: [./nginx.conf:/etc/nginx/conf.d]

  laravel:
    build: ./laravel
    environment:
      DB_HOST: postgres
      REDIS_HOST: redis
    depends_on: [postgres, redis]

  python-api:
    build: ./python
    command: uvicorn app:app --workers 4
    depends_on: [postgres, redis]

  celery-worker:
    build: ./python
    command: celery -A tasks worker --concurrency=4

  postgres:
    image: pgvector/pgvector:0.8.0-pg16
    volumes: [pgdata:/var/lib/postgresql/data]
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}

  redis:
    image: redis:7-alpine

  meilisearch:
    image: getmeili/meilisearch:v1.11
    environment:
      MEILI_MASTER_KEY: ${MEILI_KEY}

volumes: [pgdata]
```

**Monthly cost: £24.99/mo** (Contabo Cloud VPS M)

---

## Phase 2: Growth (5,000 - 25,000 users)

Separate the database from the app. Add a second app server. Add a GPU instance for ML training.

### Multi-Server Stack

```
┌──────────────────────────────────────────────────┐
│  LOAD BALANCER                                   │
│  Nginx / HaProxy (single entry point)            │
│  £5/month (or free tier on Cloudflare)            │
└────┬─────────────────────────────────────────────┘
     │
     ├──────────────────┬──────────────────┐
     ▼                  ▼                  ▼
┌──────────┐     ┌──────────┐     ┌──────────┐
│ App Svr 1│     │ App Svr 2│     │ App Svr 3│
│ Laravel  │     │ Laravel  │     │ Laravel  │
│ Python   │     │ Python   │     │ Python   │
│ 8 vCPU   │     │ 8 vCPU   │     │ 8 vCPU   │
│ 16GB RAM │     │ 16GB RAM │     │ 16GB RAM │
│ £24.99/m │     │ £24.99/m │     │ £24.99/m │
└──────────┘     └──────────┘     └──────────┘
     │                │                │
     └────────────────┼────────────────┘
                      │
          ┌───────────┴───────────┐
          │                       │
          ▼                       ▼
   ┌──────────────┐      ┌──────────────┐
   │  PostgreSQL   │      │   Redis       │
   │  Dedicated    │      │   Dedicated   │
   │  4 vCPU       │      │   4 vCPU      │
   │  16GB RAM     │      │   16GB RAM    │
   │  £29.99/mo    │      │   £24.99/mo   │
   └──────────────┘      └──────────────┘
          │
          ▼
   ┌──────────────┐
   │  GPU Node     │
   │  (optional)   │
   │  1x RTX 4090  │
   │  £69.99/mo    │
   │  For fine-    │
   │  tuning only  │
   └──────────────┘
```

**What this handles:**
- 200,000 queries/day
- 25,000 users
- 2,000 concurrent users
- Database and cache on dedicated servers (no resource contention)
- GPU available for nightly fine-tuning

**Monthly cost: ~£150-200/mo**

---

## Phase 3: Scale (25,000 - 250,000 users)

Auto-scaling groups. Read replicas. CDN. Fully separated services.

```
┌──────────────────────────────────────────────────────────┐
│  CLOUDFLARE (CDN, DDoS protection, SSL termination)       │
│  Pro plan: £20/mo                                         │
└────────────────────┬─────────────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────────────┐
│  LOAD BALANCER (DigitalOcean / Hetzner / AWS ALB)          │
└────────────────────┬─────────────────────────────────────┘
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
    ┌──────────┐┌──────────┐┌──────────┐
    │ App      ││ App      ││ App      │  Auto-scaling group
    │ Group 1  ││ Group 2  ││ Group N  │  2-10 instances
    └──────────┘└──────────┘└──────────┘  based on CPU/queue
          │          │          │
          └──────────┼──────────┘
                     │
    ┌────────────────┼────────────────┐
    │                │                │
    ▼                ▼                ▼
┌────────┐     ┌────────┐      ┌────────┐
│Primary │◄───►│Replica │      │ Redis  │
│Postgres│     │Postgres│      │Cluster │
│(write) │     │(reads) │      │ (3-5)  │
├────────┤     ├────────┤      ├────────┤
│4 vCPU  │     │4 vCPU  │      │4 vCPU  │
│16GB RAM│     │16GB RAM│      │16GB RAM│
│£30/mo  │     │£30/mo  │      │£25/mo  │
└────────┘     └────────┘      └────────┘
                     │
                     ▼
              ┌──────────────┐
              │  GPU Cluster │
              │  2-4x RTX    │
              │  £70-280/mo  │
              │  (per node)  │
              └──────────────┘
```

**What this handles:**
- 1M+ queries/day
- 250K+ users
- 10K+ concurrent users
- Auto-scaling handles traffic spikes (budget day, news events)
- Read replicas keep query times low
- GPU cluster for continuous learning at scale

**Monthly cost: ~£200-500/mo** (depending on traffic)

---

## Infrastructure Cost Summary

| Phase | Users | Servers | Monthly Cost | Revenue at Same Phase |
|---|---|---|---|---|
| **Phase 1: MVP** | 0-500 | 1 VPS (all-in-one) | ~£25/mo | £100-£5,000/mo |
| **Phase 2: Growth** | 500-25K | 3-5 dedicated servers | ~£150-300/mo | £5K-£50K/mo |
| **Phase 3: Scale** | 25K-250K | Auto-scaling + replicas + GPU | ~£200-1,000/mo | £50K-£500K/mo |
| **Phase 4: Enterprise** | 250K+ | Multi-region, global CDN, clusters | ~£2,000-10K/mo | £500K+/mo |

---

## Hosting Options Comparison

| Provider | VPS Spec | Price | UK DC? | Notes |
|---|---|---|---|---|
| **Contabo** | 8 vCPU, 16GB, 400GB SSD | **£24.99/mo** | Yes | Best value for MVP. Used by Propreneur already. |
| **Hetzner** | 8 vCPU, 32GB, 320GB NVMe | **£37.99/mo** | Yes (Nuremberg) | Better performance. Good for Phase 2. |
| **DigitalOcean** | 8 vCPU, 16GB, 320GB SSD | **£96/mo** | Yes (London) | Managed DB, load balancers. Easier scaling. |
| **AWS** | t3a.xlarge (4 vCPU, 16GB) | **~£110/mo** | Yes (London) | Most flexible. Highest cost. |
| **OVHcloud** | 8 vCPU, 32GB, 400GB NVMe | **£42/mo** | Yes | Good mid-range option. |

**Recommendation:** Start on **Contabo** (already proven with Propreneur, cheap, UK DC). Move to **Hetzner** or **DigitalOcean** when scaling beyond single VPS.

---

## Database Storage Projection

| Data Type | Growth Rate | After 6 Months | After 1 Year |
|---|---|---|---|
| User accounts | +1,000/mo | 6,000 users | 12,000 users |
| Conversations | +50/user/mo | 300K messages | 600K messages |
| RAG chunks | +100/user/mo | 600K chunks | 1.2M chunks |
| Usage logs | +500/user/mo | 3M rows | 6M rows |
| Uploaded docs | +5/user/mo | 30K docs | 60K docs |
| **Total DB size** | | **~5-10 GB** | **~15-30 GB** |

PostgreSQL handles this easily. Archive old usage logs to cold storage after 90 days.

---

## Network & Bandwidth

| Activity | Data Per Request | Monthly (30K queries/day) |
|---|---|---|
| Chat (text only) | ~5 KB response | ~4.5 GB |
| Streaming response | ~10 KB (tokens + metadata) | ~9 GB |
| File uploads | 1-50 MB per upload | ~5-50 GB (user-dependent) |
| API responses | ~2 KB average | ~1.8 GB |
| **Total egress** | | **~15-20 GB/mo** |

All included in standard VPS plans (Contabo: 32 TB traffic included).

---

## Monitoring & Observability

| Tool | Purpose | Cost |
|---|---|---|
| **Laravel Horizon** | Queue monitoring, job failures, throughput | Free (built-in) |
| **Filament admin** | Usage dashboard, user management, billing | Free (built-in) |
| **Uptime Kuma** | Self-hosted uptime monitoring. Pings every 60s. | Free (Docker) |
| **Loki + Promtail** | Log aggregation. Structured log search. | Free (Docker, but ~2-5GB storage) |
| **Grafana** | Visual dashboard for CPU, RAM, DB, API latency | Free (Docker) |
| **Sentry** | Error tracking. PHP + Python exception capture. | Free tier (5K events/mo) |
| **BetterStack** | External uptime monitoring, status page | Free tier (1 monitor) |

**All monitoring tools fit on the same VPS.** No additional infrastructure cost.

---

## Backup Strategy

| What | How Often | Retention | Storage |
|---|---|---|---|
| PostgreSQL (all tenant DBs) | Daily at 04:00 | 7 daily + 4 weekly | S3-compatible (Backblaze B2: £0.006/GB/mo) |
| Redis dump | Every 6 hours | 7 days | Local SSD |
| Uploaded files | Real-time (sync to S3) | Forever | Backblaze B2: ~£0.50/mo for 10GB |
| Docker volumes | Weekly | 4 weeks | Local SSD |

**Monthly backup storage cost:** ~£1-3/mo (Backblaze B2, 50GB retention).

---

## Infrastructure-as-Code

```yaml
# docker-compose.yml (single file, MVP through scale)
version: '3.8'

services:
  app:
    build: ./laravel
    image: carina/app:latest
    env_file: .env
    volumes:
      - ./storage/app:/var/www/storage/app
    depends_on: [db, redis, meilisearch]
    deploy:
      replicas: 1     # Increase for horizontal scaling
      resources:
        limits:
          cpus: '4'
          memory: 8G

  python:
    build: ./python
    image: carina/python:latest
    env_file: .env
    depends_on: [db, redis]
    deploy:
      replicas: 1
      resources:
        limits:
          cpus: '4'
          memory: 4G

  celery:
    build: ./python
    command: celery -A tasks worker --concurrency=4
    env_file: .env
    depends_on: [db, redis]
    deploy:
      replicas: 1

  db:
    image: pgvector/pgvector:0.8.0-pg16
    volumes: [pgdata:/var/lib/postgresql/data]
    env_file: .env
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 8G

  redis:
    image: redis:7-alpine
    volumes: [redisdata:/data]
    deploy:
      resources:
        limits:
          memory: 2G

  meilisearch:
    image: getmeili/meilisearch:v1.11
    env_file: .env
    volumes: [meilidata:/meili_data]
    deploy:
      resources:
        limits:
          memory: 2G

  nginx:
    image: nginx:alpine
    ports: ['80:80', '443:443']
    volumes:
      - ./docker/nginx.conf:/etc/nginx/conf.d/default.conf
    depends_on: [app, python]

volumes:
  pgdata:
    driver: local
  redisdata:
    driver: local
  meilidata:
    driver: local
```

---

## Infrastructure Decision Tree

```
Starting from scratch:
  │
  ├── Budget under £50/mo?
  │   └── Single Contabo VPS. Docker Compose. All-in-one. Go live.
  │
  ├── Budget under £200/mo?
  │   ├── Contabo VPS for app + services
  │   ├── Separate PostgreSQL (can stay on same VPS initially)
  │   └── Optional: GPU node for fine-tuning
  │
  ├── 500+ paying users?
  │   ├── Dedicated database server
  │   ├── 2-3 app servers behind load balancer
  │   ├── Redis on its own node
  │   └── Cloudflare CDN
  │
  └── 25K+ paying users?
      ├── Auto-scaling app groups
      ├── PostgreSQL primary + 2 read replicas
      ├── Redis cluster (3-5 nodes)
      ├── GPU cluster for continuous learning
      └── Multi-region for disaster recovery
```

---

## What You Actually Need to Start

You already have everything for Phase 1:

| Resource | Current Status |
|---|---|
| VPS (Contabo, 8 vCPU, 16GB, 400GB) | Running Propreneur. Carina can share it initially. |
| PostgreSQL 16 + pgvector | Running on the same VPS. Create a new DB for Carina. |
| Redis | Running. Shared. |
| Meilisearch | Running. Carina can share or get its own instance. |
| Domain | Carina can use `carina.verlox.uk` subdomain. |
| SSL | Let's Encrypt via Certbot (free). |

**To go live with Carina Standalone MVP, you need:**

1. A subdomain (`carina.verlox.uk` or `carina.propreneur.co.uk`) - free
2. A new PostgreSQL database on the existing VPS - free
3. Docker Compose for the Carina stack - free
4. Three API keys (DeepSeek, OpenAI, Anthropic) - already have DeepSeek
5. Total additional monthly cost: **£0** (shares Propreneur's infrastructure)

When Carina outgrows the shared VPS (likely at 1,000+ paying users), spin up a dedicated VPS for £25/mo.
