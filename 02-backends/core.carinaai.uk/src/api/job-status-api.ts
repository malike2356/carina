/**
 * Status endpoints for the minimal background job queue (see
 * jobs/job-queue.ts). Exposes a plain JSON poll endpoint and an SSE stream
 * that pushes updates until the job reaches a terminal state, following the
 * same poll-and-write SSE pattern as api/observability-routes.ts
 * (/api/ops/logs/stream).
 *
 * This router does not itself decide who may see a given job; job ids are
 * unguessable UUIDs, but callers that enqueue tenant-scoped work (for
 * example, Aiva long-running tasks) should mount their own thin wrapper
 * route that first runs their existing auth/tenant middleware
 * (requireCloudProxy, enforceWorkspaceAccess, requireWebAuth, etc.) and
 * only then reads job status, rather than exposing this router directly
 * on a public path.
 */
import { Router, type Request, type Response } from 'express';
import type { Router as ExpressRouter } from 'express';
import { getJobStatus } from '../jobs/job-queue.js';
import { rateLimitMiddleware } from '../security/redis-rate-limit.js';

export const jobStatusApiRouter: ExpressRouter = Router();

jobStatusApiRouter.get('/:id', rateLimitMiddleware('api'), async (req: Request, res: Response) => {
  const job = await getJobStatus(String(req.params.id));
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }
  res.json({ job });
});

jobStatusApiRouter.get('/:id/stream', rateLimitMiddleware('api'), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const initial = await getJobStatus(id);
  if (!initial) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  let lastUpdatedAt = 0;
  const pollMs = 1000;

  const writeJob = (job: NonNullable<typeof initial>): void => {
    res.write(`data: ${JSON.stringify(job)}\n\n`);
    lastUpdatedAt = job.updatedAt;
  };

  writeJob(initial);
  if (initial.status === 'completed' || initial.status === 'failed') {
    res.write('event: done\ndata: {}\n\n');
    res.end();
    return;
  }

  const timer = setInterval(async () => {
    try {
      const job = await getJobStatus(id);
      if (!job) {
        clearInterval(timer);
        res.write('event: done\ndata: {"error":"job expired"}\n\n');
        res.end();
        return;
      }
      if (job.updatedAt !== lastUpdatedAt) {
        writeJob(job);
      } else {
        res.write(': heartbeat\n\n');
      }
      if (job.status === 'completed' || job.status === 'failed') {
        clearInterval(timer);
        res.write('event: done\ndata: {}\n\n');
        res.end();
      }
    } catch {
      res.write('data: {"error":"stream poll failed"}\n\n');
    }
  }, pollMs);

  req.on('close', () => clearInterval(timer));
});
