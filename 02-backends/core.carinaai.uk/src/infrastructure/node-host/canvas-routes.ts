import type { Express, Request, Response } from 'express';
import { marked } from 'marked';
import { getCanvasHost } from './canvas-host.js';
import { nodeHostRoutesEnabled } from './routes.js';

function wrapHtml(body: string, title?: string): string {
  const safeTitle = title ?? 'Carina Canvas';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 1.5rem; line-height: 1.5; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
  </style>
</head>
<body>
${body}
</body>
</html>`;
}

export function mountCanvasRoutes(app: Express): void {
  if (!nodeHostRoutesEnabled()) return;

  app.get('/__carina__/canvas/:artifactId', (req: Request, res: Response) => {
    const artifact = getCanvasHost().getArtifact(String(req.params.artifactId));
    if (!artifact) {
      res.status(404).send('Artifact not found');
      return;
    }

    switch (artifact.type) {
      case 'html':
        res.type('html').send(artifact.content);
        break;
      case 'svg':
        res.type('image/svg+xml').send(artifact.content);
        break;
      case 'markdown': {
        const html = marked.parse(artifact.content, { async: false }) as string;
        res.type('html').send(wrapHtml(html, artifact.title));
        break;
      }
      case 'json-table':
        try {
          res.json({ type: 'table', data: JSON.parse(artifact.content) });
        } catch {
          res.status(400).json({ error: 'Invalid json-table content' });
        }
        break;
      case 'image':
        if (artifact.content.startsWith('data:')) {
          res.redirect(artifact.content);
        } else {
          res.type('text/plain').send(artifact.content);
        }
        break;
      default:
        res.type('text/plain').send(artifact.content);
    }
  });
}
