import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const srcRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

describe('provider copilot latency guard', () => {
  it('does not import health probes into the live agent turn path', () => {
    const files = [
      path.join(srcRoot, 'agents', 'carina.ts'),
      path.join(srcRoot, 'agents', 'orchestrator.ts'),
    ];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source.includes('probeProviderHealth')).toBe(false);
      expect(source.includes('probeConfiguredLocalProviders')).toBe(false);
      expect(source.includes('maybeProbeProvidersOnStartup')).toBe(false);
    }
  });

  it('uses sync health cache only in llm router fallback', () => {
    const source = readFileSync(path.join(srcRoot, 'brain', 'llm.ts'), 'utf8');
    expect(source.includes('resolveProviderFallbackChain')).toBe(true);
    const fallbackSource = readFileSync(path.join(srcRoot, 'brain', 'fallback-chain.ts'), 'utf8');
    expect(fallbackSource.includes('isProviderAvailable')).toBe(true);
    expect(source.includes('probeProviderHealth')).toBe(false);
  });

  it('does not enable debug proxy routing unless explicitly flagged', () => {
    const source = readFileSync(path.join(srcRoot, 'brain', 'provider-proxy-routing.ts'), 'utf8');
    expect(source.includes("CARINA_DEBUG_PROXY_ROUTING !== 'true'")).toBe(true);
  });

  it('memory injection defaults to minimal and checks env synchronously', () => {
    const source = readFileSync(path.join(srcRoot, 'memory', 'memory-injection.ts'), 'utf8');
    expect(source.includes("return 'minimal'")).toBe(true);
    const carina = readFileSync(path.join(srcRoot, 'agents', 'carina.ts'), 'utf8');
    expect(carina.includes('memoryInjectionEnabled')).toBe(true);
    expect(carina.includes('memoryInjectionIncludesSemantic')).toBe(true);
  });
});
