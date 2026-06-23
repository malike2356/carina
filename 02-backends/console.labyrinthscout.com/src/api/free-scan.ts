import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { normalizeDomain, clientIp } from '../engines/domain.js';
import {
  createFreeScan,
  getRecentFreeScanForDomain,
  loadFreeScanResult,
  summarizeFindings,
} from '../findings/free-scan.js';
import {
  checkFreeScanRateLimit,
  recordFreeScanRateLimit,
} from '../findings/free-scan-rate-limit.js';

export const freeScanRouter: IRouter = Router();

freeScanRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  const body = req.body as Record<string, unknown>;
  const rawDomain = typeof body.domain === 'string' ? body.domain : '';
  const domain = normalizeDomain(rawDomain);

  if (!domain) {
    res.status(400).json({ error: 'Invalid domain. Enter a public domain name (example.com).' });
    return;
  }

  const ip = clientIp(req);

  const recent = await getRecentFreeScanForDomain(domain, 24);
  if (recent) {
    res.status(200).json({
      scan_id: recent.scanRunId,
      status: 'running',
      eta_seconds: 60,
      message: 'A scan for this domain is already in progress or was completed recently.',
    });
    return;
  }

  const rate = await checkFreeScanRateLimit(ip, domain);
  if (!rate.allowed) {
    res.status(429).json({
      error: rate.reason,
      retry_after_seconds: rate.retryAfterSec ?? 3600,
    });
    return;
  }

  try {
    const { scan } = await createFreeScan(domain, ip);
    await recordFreeScanRateLimit(ip, domain);
    res.status(202).json({
      scan_id: scan.id,
      status: 'running',
      eta_seconds: 90,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:free-scan] create failed:', msg);
    res.status(500).json({ error: 'Failed to start scan' });
  }
});

freeScanRouter.get('/:scanId', async (req: Request, res: Response): Promise<void> => {
  const scanId = typeof req.params.scanId === 'string' ? req.params.scanId : '';
  if (!scanId) {
    res.status(400).json({ error: 'scanId is required' });
    return;
  }

  try {
    const loaded = await loadFreeScanResult(scanId);
    if (!loaded) {
      res.status(404).json({ error: 'Scan not found' });
      return;
    }

    const { scan, findings, domain } = loaded;
    const summary = summarizeFindings(findings);

    if (scan.status === 'queued' || scan.status === 'running') {
      res.json({
        scan_id: scan.id,
        status: scan.status,
        domain,
        eta_seconds: 60,
      });
      return;
    }

    if (scan.status === 'failed') {
      res.json({
        scan_id: scan.id,
        status: 'failed',
        domain,
        error: scan.errorMessage ?? 'Scan failed',
      });
      return;
    }

    const started = scan.startedAt ? new Date(scan.startedAt).getTime() : Date.now();
    const finished = scan.completedAt ? new Date(scan.completedAt).getTime() : Date.now();
    const durationSeconds = Math.max(1, Math.round((finished - started) / 1000));

    res.json({
      scan_id: scan.id,
      status: 'completed',
      domain,
      duration_seconds: durationSeconds,
      findings: {
        critical: summary.critical,
        high: summary.high,
        medium: summary.medium,
        low: summary.low,
        info: summary.info,
      },
      details: findings.slice(0, 50).map((f) => ({
        tool: f.tool,
        name: f.title,
        severity: f.severity,
        cvss: f.cvssScore,
        description: f.description,
      })),
      attack_surface: {
        open_ports: summary.openPorts,
        subdomains: summary.subdomains,
        tech_stack: summary.techStack,
      },
      cta: {
        message: 'Carina can investigate these findings with 72 security tools.',
        import_command: 'carina migrate agent-type-1',
        signup_url: 'https://carinaai.uk',
        investigate_command: `carina scout investigate ${findings[0]?.id ?? '<finding-id>'}`,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:free-scan] get failed:', msg);
    res.status(500).json({ error: 'Failed to load scan results' });
  }
});
