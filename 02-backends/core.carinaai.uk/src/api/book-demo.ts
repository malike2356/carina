import { Router, type Request, type Response, type NextFunction, type IRouter } from 'express';
import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { Resend } from 'resend';
import { config } from '../config/index.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_LEN = {
  name: 120,
  email: 200,
  business: 200,
  task: 2000,
  preferredTime: 200,
};

function clean(value: unknown, max: number): string {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, max);
}

async function persistSubmission(record: Record<string, string>): Promise<void> {
  const dir = path.resolve(process.cwd(), 'data', 'marketing');
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, 'book-demo-submissions.jsonl');
  await appendFile(file, `${JSON.stringify(record)}\n`, 'utf8');
}

const ALLOWED_ORIGINS = new Set([
  'https://carinaai.uk',
  'https://www.carinaai.uk',
  'https://hireaiva.co.uk',
  'https://www.hireaiva.co.uk',
]);

export const bookDemoRouter: IRouter = Router();

bookDemoRouter.use((req: Request, res: Response, next: NextFunction) => {
  const origin = String(req.headers.origin ?? '');
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

bookDemoRouter.post('/', async (req: Request, res: Response) => {
  // Honeypot; pretend success for bots.
  if (clean(req.body?.website, 200) !== '') {
    res.json({ ok: true });
    return;
  }

  const name = clean(req.body?.name, MAX_LEN.name);
  const email = clean(req.body?.email, MAX_LEN.email).toLowerCase();
  const business = clean(req.body?.business, MAX_LEN.business);
  const task = clean(req.body?.task ?? req.body?.repetitiveTask, MAX_LEN.task);
  const preferredTime = clean(
    req.body?.preferredTime ?? req.body?.preferred_time,
    MAX_LEN.preferredTime,
  );

  if (!name) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }
  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ error: 'A valid email address is required' });
    return;
  }
  if (!business) {
    res.status(400).json({ error: 'Business is required' });
    return;
  }
  if (!task) {
    res.status(400).json({ error: 'Repetitive task is required' });
    return;
  }
  if (!preferredTime) {
    res.status(400).json({ error: 'Preferred time is required' });
    return;
  }

  const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '');
  const source = clean(req.body?.source, 80) || 'carinaai.uk';
  const record = {
    at: new Date().toISOString(),
    source,
    name,
    email,
    business,
    task,
    preferredTime,
    ip,
  };

  try {
    await persistSubmission(record);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Could not save request: ${msg}` });
    return;
  }

  if (!config.resend.apiKey) {
    // Saved on disk; email notify unavailable until RESEND_API_KEY is set.
    res.json({ ok: true, emailed: false });
    return;
  }

  const to = process.env.BOOK_DEMO_TO_EMAIL?.trim() || 'contact@verlox.uk';
  const resend = new Resend(config.resend.apiKey);
  const text = [
    'New live demonstration request',
    '',
    `Source: ${source}`,
    `Name: ${name}`,
    `Email: ${email}`,
    `Business: ${business}`,
    `Preferred time: ${preferredTime}`,
    '',
    'Repetitive task:',
    task,
    '',
    `IP: ${ip}`,
  ].join('\n');

  try {
    await resend.emails.send({
      from: config.resend.from,
      to,
      replyTo: email,
      subject: `Book a live demonstration (${source}): ${business}`,
      text,
    });
    res.json({ ok: true, emailed: true });
  } catch (err) {
    // Request is already persisted; do not fail the visitor.
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[book-demo] email failed after persist:', msg);
    res.json({ ok: true, emailed: false });
  }
});
