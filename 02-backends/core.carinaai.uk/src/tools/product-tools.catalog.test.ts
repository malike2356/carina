import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const catalogPath = path.join(process.cwd(), 'config', 'aiva', 'product-tools.catalog.json');

describe('product tools catalog', () => {
  it('exposes the trello write actions needed by outreach board sync', () => {
    const raw = fs.readFileSync(catalogPath, 'utf8');
    const catalog = JSON.parse(raw) as { tools: Array<{ slug: string; actions?: Array<{ id: string }> }> };
    const trello = catalog.tools.find((tool) => tool.slug === 'trello');
    expect(trello?.actions?.map((action) => action.id)).toEqual(
      expect.arrayContaining(['create-card', 'move-card', 'update-desc', 'add-comment', 'archive-card']),
    );
  });
});
