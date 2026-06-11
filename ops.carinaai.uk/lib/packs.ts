export function parseSelectedPacks(body: Record<string, unknown>): string[] {
  const raw = body.packs;
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string') {
    return raw.split(',').map((value) => value.trim()).filter(Boolean);
  }
  return [];
}
