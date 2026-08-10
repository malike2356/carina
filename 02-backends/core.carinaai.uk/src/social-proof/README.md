# Shared social proof

Collect (Twitter/LinkedIn/GitHub/Discord/YouTube + manual) → human curation → `/proof` page.

| File | Role |
| --- | --- |
| `collector.ts` | Platform adapters + fixtures |
| `curation.ts` / `curation-dashboard.tsx` | Approve/reject/tag/assign |
| `proof-page.ts` / `proof-page.tsx` | Public proof rendering + schema.org |
| `schedule.ts` | Weekly collection helper |
