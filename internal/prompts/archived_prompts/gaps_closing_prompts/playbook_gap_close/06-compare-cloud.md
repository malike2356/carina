# Prompt 06 - Model Compare Page (Cloud)

## Objective

Expose workspace-style model comparison in `app.carinaai.uk`: one prompt, multiple providers side by side, optional blind mode.

---

## Context

**Core:** `compare-api.ts`, `/compare` route, O3 in internal gap-close prompts.

**Cloud:** No compare route. BYOK keys mean user can compare their own providers.

**Working directory:** `app.carinaai.uk`

---

## Step 1 - API

`POST /api/compare`

```ts
Body: {
  prompt: string;
  providers: string[]; // max 4, must have keys configured
  blind?: boolean;
  maxTokens?: number;
}
```

Implementation:
1. Resolve each provider from workspace BYOK keys.
2. Run requests in parallel (`Promise.allSettled`).
3. Return `{ results: [{ providerId, label?, text, latencyMs, error? }], blind }`.
4. If blind, shuffle results and return `labels: ['A','B','C']`; store mapping server-side in session cookie or return `revealToken` for reveal endpoint.

`POST /api/compare/reveal` with token returns provider mapping.

---

## Step 2 - UI `/compare`

Layout:
- Prompt textarea
- Provider multi-select (only providers with keys)
- Toggles: Blind mode, Max tokens slider
- Run Compare button
- Results grid: 2 columns on desktop, stacked on mobile
- Per column: label (A/B/C or provider name), latency, copy button, markdown render
- Blind mode: "Reveal providers" button after all complete

Add sidebar link under Tools: Compare.

---

## Step 3 - Save comparison (optional v1)

Store last 10 comparisons in `compare_runs` table for history list (id, prompt hash, createdAt). Skip full persistence if time-constrained; at minimum session-local history.

---

## Acceptance criteria

- [ ] Compare with 2+ configured providers returns parallel results.
- [ ] Blind mode hides names until reveal.
- [ ] Provider without key shows inline error in that column.
- [ ] Build passes; API test with mocked fetch.
