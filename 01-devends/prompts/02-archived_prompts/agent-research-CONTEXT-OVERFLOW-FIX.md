# Context Overflow Fix; Carina

**Date:** 16 June 2026
**Symptoms:** Double replies, hallucinated tool calls, topic drift, history regurgitation on DeepSeek.
**Root cause:** 14 context layers injected every turn exceeding DeepSeek's effective instruction-following window (~12K tokens).

---

## Step 1; Config changes (no code, no restart beyond service reload)

### 1a. Reduce history injection
```
# In /home/malike/apps/core.carinaai.uk/.env
CARINA_MAX_MEMORY_CONTEXT=10
```
Currently hardcoded to 20 in `src/config/index.ts:132`. Either override via env or patch the default.

### 1b. Disable cross-agent context (if OpenClaw sync not actively needed)
```
CARINA_CROSS_AGENT=false
```

### 1c. Switch model to Claude
```
DEFAULT_PROVIDER=anthropic
```
Also ensure `ANTHROPIC_API_KEY` is set. Claude handles 20K+ token instruction-following without degradation.

### 1d. Restart
```bash
sudo systemctl restart carina-core
# or: kill and restart manually
```

---

## Step 2; Code change (make context tunable)

### 2a. Env override for maxMemoryContext
In `src/config/index.ts`:
```typescript
maxMemoryContext: parseInt(process.env.CARINA_MAX_MEMORY_CONTEXT ?? '20', 10),
```

### 2b. Token budget guard (future hardening)
Before assembling context in `buildContext()`, estimate total tokens. If > 70% of model's context window, trim largest sections first (history → similar memories → RAG → skills). Leave persistent memory and system prompt intact.

---

## Step 3; Operational hygiene

- `/clear` operator session weekly, or after long conversations
- Start new sessions when switching topics/projects
- If confusion returns, `/clear` immediately before investigating

---

## Why this works

| Change | Effect |
|--------|--------|
| maxMemoryContext 20→10 | Cuts ~5K tokens of history |
| Cross-agent disabled | Removes OpenClaw sync noise |
| DeepSeek→Claude | 2.5× effective context window |
| Combined | Agent stays within model's reliable operating range |

---

## Verification

After applying Step 1:
1. Send Carina 3 unrelated requests in a row
2. Verify no topic bleed between them
3. Verify no double replies
4. Verify no hallucinated tool calls (like fake audio detection)
