import type { Tool } from '../types/index.js';
import { config } from '../config/index.js';

function themeApiBase(): string {
  const port = config.web.port ?? config.server.port;
  return `http://127.0.0.1:${port}`;
}

export const themeTool: Tool = {
  name: 'theme',
  description:
    'Set, list, or reset the workspace color theme. Use when the operator asks to change the look of the workspace. Actions: set, list, reset.',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['set', 'list', 'reset'] },
      name: { type: 'string', description: 'Theme name' },
      bg: { type: 'string', description: 'Background color hex, e.g. #0a0a14' },
      accent: { type: 'string', description: 'Accent color hex, e.g. #7c6aff' },
      surface: { type: 'string', description: 'Surface color hex' },
      text: { type: 'string', description: 'Text color hex' },
    },
    required: ['action'],
  },
  execute: async (params) => {
    const p = params as Record<string, string>;
    const base = themeApiBase();
    if (p.action === 'list') {
      const r = await fetch(`${base}/api/theme`);
      const d = await r.json() as { themes: Array<{ name: string }> };
      if (!d.themes.length) {
        return 'No custom themes. Use action="set" with name, bg, and accent to create one.';
      }
      return d.themes.map((t) => t.name).join(', ');
    }
    if (p.action === 'set') {
      if (!p.name || !p.bg || !p.accent) return 'name, bg, and accent are required.';
      await fetch(`${base}/api/theme`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: p.name,
          bg: p.bg,
          accent: p.accent,
          surface: p.surface,
          text: p.text,
        }),
      });
      return `Theme "${p.name}" saved. Accent: ${p.accent}, Background: ${p.bg}. The workspace applies it when the user selects it in the theme picker.`;
    }
    if (p.action === 'reset') {
      if (!p.name) return 'Provide name to delete.';
      await fetch(`${base}/api/theme/${encodeURIComponent(p.name)}`, { method: 'DELETE' });
      return `Theme "${p.name}" removed.`;
    }
    return `Unknown action: ${p.action}`;
  },
};
