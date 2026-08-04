# Google Recorder ingestion (Aiva)

Polls [recorder.google.com](https://recorder.google.com/) every 15 minutes and writes transcripts into the Aiva worker knowledge base.

Full operator guide: [`docs/aiva-google-recorder.md`](../../../docs/aiva-google-recorder.md)

```bash
# enable
AIVA_GOOGLE_RECORDER_ENABLED=true
AIVA_GOOGLE_RECORDER_POLL_CRON=*/15 * * * *

# capture session
node scripts/google-recorder-login.mjs ./google-recorder-storage-state.json

# tests
pnpm exec vitest run src/ingestion/google-recorder/recorder.test.ts
```
