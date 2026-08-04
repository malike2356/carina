#!/usr/bin/env node
/**
 * Standalone Carina Clinicom sidecar HTTP server.
 *
 * Run from core.carinaai.uk:
 *   npx tsx scripts/clinicom-sidecar.ts
 *
 * Or after pack build:
 *   node --import tsx packages/packs/clinicom/src/http.ts
 */

import { createClinicomSidecarApp } from '../packages/packs/clinicom/src/http.js';

const host = process.env.CLINICOM_CARINA_SIDECAR_HOST ?? '0.0.0.0';
const port = Number(process.env.CLINICOM_CARINA_SIDECAR_PORT ?? process.env.PORT ?? 3000);

const app = createClinicomSidecarApp();

app.listen(port, host, () => {
  // eslint-disable-next-line no-console
  console.log(`Carina Clinicom sidecar listening on http://${host}:${port}`);
  // eslint-disable-next-line no-console
  console.log('Health: GET /health');
  // eslint-disable-next-line no-console
  console.log('Tools: POST /clinicom/tools/{transcribe,translate,simplify,speak}');
});
