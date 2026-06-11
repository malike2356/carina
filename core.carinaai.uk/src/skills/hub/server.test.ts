import type { AddressInfo } from 'net';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const { mockPacks, mockSkills } = vi.hoisted(() => {
  const packs = [
    {
      name: 'property-uk',
      version: '1.0.0',
      description: 'UK property pack',
      author: 'VERLOX',
      category: 'property',
      skill_count: 12,
      download_count: 5,
      featured: true,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    },
  ];
  const skills = [
    {
      id: '1',
      pack_name: 'property-uk',
      name: 'stamp-duty',
      description: 'Calculate SDLT',
      triggers: ['stamp duty'],
      tools_used: [],
      created_at: '2026-01-01T00:00:00.000Z',
    },
  ];
  return { mockPacks: packs, mockSkills: skills };
});

vi.mock('./registry.js', () => ({
  getRegistrySummary: vi.fn().mockResolvedValue({
    packCount: 1,
    skillCount: 1,
    categories: ['property'],
    totalDownloads: 5,
  }),
  listHubPacks: vi.fn().mockResolvedValue(mockPacks),
  getHubPack: vi.fn().mockImplementation(async (name: string) =>
    mockPacks.find((p) => p.name === name) ?? null,
  ),
  listHubSkills: vi.fn().mockResolvedValue(mockSkills),
  getHubSkill: vi.fn().mockImplementation(async (pack: string, skill: string) =>
    mockSkills.find((s) => s.pack_name === pack && s.name === skill) ?? null,
  ),
  getPackArchivePath: vi.fn().mockResolvedValue(null),
  recordPackDownload: vi.fn().mockResolvedValue(undefined),
}));

import { createSkillsHubApp } from './server.js';

async function withServer(fn: (baseUrl: string) => Promise<void>): Promise<void> {
  const app = createSkillsHubApp();
  const server = app.listen(0);
  try {
    const address = server.address() as AddressInfo;
    await fn(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe('createSkillsHubApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns registry summary', async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/registry`);
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toMatchObject({
        packCount: 1,
        skillCount: 1,
        categories: ['property'],
      });
    });
  });

  it('lists packs and skills', async () => {
    await withServer(async (baseUrl) => {
      const packsRes = await fetch(`${baseUrl}/api/packs`);
      expect(packsRes.status).toBe(200);
      const packsBody = await packsRes.json();
      expect(packsBody.packs).toHaveLength(1);

      const skillsRes = await fetch(`${baseUrl}/api/skills`);
      expect(skillsRes.status).toBe(200);
      const skillsBody = await skillsRes.json();
      expect(skillsBody.skills[0].name).toBe('stamp-duty');
    });
  });

  it('returns pack detail with skills', async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/packs/property-uk`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe('property-uk');
      expect(body.skills).toHaveLength(1);
    });
  });

  it('returns 404 for unknown pack', async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/packs/missing`);
      expect(res.status).toBe(404);
    });
  });

  it('serves browse UI', async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/`);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Skills Hub');
    });
  });

  it('keeps legacy /packs path', async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/packs`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.packs[0].name).toBe('property-uk');
    });
  });
});
