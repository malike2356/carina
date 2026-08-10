# Shared public/private error handling

| File | Role |
| --- | --- |
| `public-error-handler.ts` | Safe user messages + `{ error: { message, reference } }` |
| `private-error-logger.ts` | Full private log, search, redact, 500 spike detect |
| `error-boundaries.ts` | Route/job/webhook/payment wrappers + global uncaught |

Carina vendors under `src/errors/`. Keprix: `keprix/errors/`.
