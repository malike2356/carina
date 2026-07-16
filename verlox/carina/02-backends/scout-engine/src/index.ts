// scout-engine/src/index.ts
// Scout Engine main entry point
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { apiRouter } from './api/index.js';
import { startScheduler } from './engine/scheduler.js';
import { startScoreJob } from './scoring/score-job.js';
import { startDigestScheduler } from './alerts/digest.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { authMiddleware, createApiRateLimiter } from './api/auth-middleware.js';
import { wardenRouter } from './api/warden.js';
import { startWardenScheduler } from './warden/engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.SCOUT_PORT || '4444');

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve dashboard static files from console.labyrinthscout.com
const dashboardPath = path.resolve(__dirname, '../../console.labyrinthscout.com/public');
app.use(express.static(dashboardPath, { index: false }));

// API routes
app.use('/api/v1', apiRouter);
app.use('/api/warden', createApiRateLimiter(), authMiddleware, wardenRouter);

// Health check at root
app.get('/', (_req, res) => {
  res.json({
    service: 'Scout Engine',
    version: '1.0.0',
    status: 'running',
    docs: '/api/v1/docs/ui',
  });
});

// Dashboard (SPA fallback)
app.get('/dashboard', (_req, res) => {
  res.sendFile(path.join(dashboardPath, 'index.html'));
});

app.get('/onboard', (_req, res) => {
  res.sendFile(path.join(dashboardPath, 'onboard.html'));
});

app.get('/warden', (_req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/warden/index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`\n Scout Engine running on http://localhost:${PORT}`);
  console.log(`   API: http://localhost:${PORT}/api/v1`);
  console.log(`   Health: http://localhost:${PORT}/api/v1/health`);
  console.log(`   Dashboard: http://localhost:${PORT}/dashboard\n`);

  // Start services
  startScheduler();
  startScoreJob();
  startDigestScheduler();
  startWardenScheduler();
});

export default app;
