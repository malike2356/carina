/** First non-empty trimmed env value. Treats blank SCOUT_* overrides as unset. */
export function firstEnvValue(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}
