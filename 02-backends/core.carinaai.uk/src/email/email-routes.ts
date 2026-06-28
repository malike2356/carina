import type { Express, Request, Response } from 'express';
import { setMarketingOptOutByToken } from './workspace-contact.js';

const UNSUBSCRIBE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribed</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #f9fafb; color: #111; padding: 48px 24px; }
    .card { max-width: 420px; margin: 0 auto; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 32px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Unsubscribed</h1>
    <p>You have been unsubscribed from non-essential emails. Payment and security emails will still be sent when needed.</p>
  </div>
</body>
</html>`;

export function mountEmailRoutes(app: Express): void {
  app.get('/api/auth/unsubscribe', async (req: Request, res: Response) => {
    const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';
    if (!token) {
      res.status(400).send('Missing token');
      return;
    }
    const ok = await setMarketingOptOutByToken(token);
    if (!ok) {
      res.status(404).send('Invalid or expired unsubscribe link');
      return;
    }
    res.type('html').send(UNSUBSCRIBE_HTML);
  });
}
