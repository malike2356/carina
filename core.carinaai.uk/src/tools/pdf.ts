import { writeFileSync } from 'fs';
import { join } from 'path';
import type { Tool } from '../types/index.js';

// Lazy-load puppeteer (heavy dep, only when tool is called)
let puppeteerModule: typeof import('puppeteer') | null = null;
async function getPuppeteer() {
  if (!puppeteerModule) {
    puppeteerModule = await import('puppeteer');
  }
  return puppeteerModule;
}

export const generatePdfTool: Tool = {
  name: 'generate-pdf',
  description:
    'Generate a PDF file from markdown text or HTML. Outputs a professional-looking PDF saved to ~/.carina/output/. Returns the file path so you can deliver it to the user.',
  parameters: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Document title (used as filename and in the PDF header)',
      },
      content: {
        type: 'string',
        description: 'Markdown or HTML content to convert to PDF',
      },
      format: {
        type: 'string',
        enum: ['markdown', 'html'],
        description: 'Input format (default: markdown)',
        default: 'markdown',
      },
    },
    required: ['title', 'content'],
  },
  execute: async (params) => {
    const title = String(params.title).replace(/[^a-zA-Z0-9 _-]/g, '_').slice(0, 60);
    const rawContent = String(params.content);
    const format = (String(params.format ?? 'markdown')).toLowerCase();

    const puppeteer = await getPuppeteer();
    const outputDir = join(process.env.HOME ?? '/tmp', '.carina', 'output');
    const { mkdirSync } = await import('fs');
    mkdirSync(outputDir, { recursive: true });

    const filePath = join(outputDir, `${title}.pdf`);

    // Build HTML from markdown or raw HTML
    const bodyHtml = format === 'html'
      ? rawContent
      : markdownToHtml(rawContent);

    const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 12px;
      line-height: 1.6;
      color: #1a1a1a;
      max-width: 700px;
      margin: 60px auto;
      padding: 0 20px;
    }
    h1 { font-size: 22px; border-bottom: 2px solid #2563eb; padding-bottom: 8px; margin-top: 0; }
    h2 { font-size: 17px; color: #2563eb; margin-top: 28px; }
    h3 { font-size: 14px; margin-top: 20px; }
    p { margin: 8px 0; }
    ul, ol { margin: 6px 0; padding-left: 24px; }
    li { margin: 2px 0; }
    code { background: #f1f5f9; padding: 2px 6px; border-radius: 3px; font-size: 11px; }
    pre { background: #f1f5f9; padding: 14px; border-radius: 6px; overflow-x: auto; font-size: 11px; }
    blockquote { border-left: 3px solid #2563eb; margin: 12px 0; padding: 4px 16px; color: #555; }
    table { border-collapse: collapse; width: 100%; margin: 12px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f8fafc; }
    strong { color: #111; }
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: process.env.CHROMIUM_PATH ?? undefined,
    });

    try {
      const page = await browser.newPage();
      await page.setContent(fullHtml, { waitUntil: 'load', timeout: 15000 });
      await page.pdf({
        path: filePath,
        format: 'A4',
        margin: { top: '20mm', bottom: '20mm', left: '18mm', right: '18mm' },
        printBackground: true,
      });
    } finally {
      await browser.close();
    }

    return {
      filePath,
      fileSize: `${(await import('fs')).statSync(filePath).size} bytes`,
      message: `PDF generated: ${filePath}`,
    };
  },
};

/** Simple markdown → HTML converter (no external deps needed for basic cases) */
function markdownToHtml(md: string): string {
  let html = md
    // Headers
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold / italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Images
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%">')
    // Horizontal rules
    .replace(/^---$/gm, '<hr>')
    // Blockquotes
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

  // Unordered lists
  html = html.replace(/((?:^- .+\n?)+)/gm, (match) => {
    const items = match.trim().split('\n').map((line) => `<li>${line.replace(/^- /, '')}</li>`);
    return `<ul>${items.join('')}</ul>`;
  });

  // Ordered lists
  html = html.replace(/((?:^\d+\. .+\n?)+)/gm, (match) => {
    const items = match.trim().split('\n').map((line) => `<li>${line.replace(/^\d+\. /, '')}</li>`);
    return `<ol>${items.join('')}</ol>`;
  });

  // Paragraphs: wrap remaining non-tag text
  html = html
    .split('\n\n')
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('<')) return trimmed;
      return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n');

  return html;
}
