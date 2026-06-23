# Linux quickstart

Two paths: **npm install** (fastest) or **from source** (for contributors).

## Path A: npm install (recommended)

### 1. Install

```bash
curl -fsSL https://get.carinaai.uk | bash
# or: npm install -g carina-agent
```

### 2. Setup

```bash
carina setup
```

Follow the wizard to add your provider keys.

### 3. Start

```bash
carina dev
```

The agent starts with SQLite. No Docker, Postgres, or Redis required.

### 4. First chat

```bash
carina "Reply with OK if the gateway is healthy."
```

---

## Path B: From source

For contributors or anyone who wants to run directly from the repo:

### 1. Clone and install

```bash
git clone https://github.com/carina-ai/carina.git
cd carina/core.carinaai.uk
pnpm install
cp .env.example .env
```

### 2. Add your keys

Edit `.env` and add at least one provider API key.

### 3. Start

```bash
pnpm dev
```

The agent starts on `http://localhost:3000` with SQLite by default. No Docker needed; single-user self-hosted Carina is one command away. See [self-hosting](/docs/user/self-hosting) for production persistence and the optional Docker multi-service stack.

---

## Verify

```bash
carina doctor
# or from source:
pnpm test
```

## Production notes

- For persistence, add a Postgres `DATABASE_URL` and Redis `REDIS_URL` to `.env`
- Docker Compose optional; only needed for Cloud/Scout multi-service orchestration
- See [self-hosting](/docs/user/self-hosting) for full production setup

## Next

- [Getting started](/docs/user/getting-started)
- [Configuration](/docs/user/configuration)
- [Self-hosting](/docs/user/self-hosting)
