import { listFindings } from '../findings/store.js';
import { buildStixBundle } from '../findings/stix-export.js';
import type { ScanContext } from './scan-context.js';
import type { EngineFinding } from './types.js';

export async function runStixExport(ctx: ScanContext & { accountId?: string; targetId?: string }): Promise<{
  findings: EngineFinding[];
  engine: string;
}> {
  if (!ctx.accountId || !ctx.targetId) {
    return { findings: [], engine: 'stix:skipped' };
  }

  const rows = await listFindings(ctx.accountId, {
    targetId: ctx.targetId,
    status: 'open',
    limit: 100,
  });
  const bundle = buildStixBundle(rows, {
    bundleId: `bundle--scout-${ctx.targetId}`,
    cveOnly: true,
  });

  return {
    findings: [{
      tool: 'stix',
      findingType: 'report',
      severity: 'info',
      title: `STIX bundle for ${ctx.domain} (${bundle.objects.length} indicators)`,
      description: 'Auto-generated STIX 2.1 bundle from open CVE/high findings.',
      rawData: { bundle, indicatorCount: bundle.objects.length },
    }],
    engine: 'stix',
  };
}

export async function runCyberchefScan(_ctx: ScanContext): Promise<{
  findings: EngineFinding[];
  engine: string;
}> {
  return {
    findings: [{
      tool: 'cyberchef',
      findingType: 'utility',
      severity: 'info',
      title: 'CyberChef available for manual analysis',
      description: 'CyberChef is an operator utility; use the web UI or Carina CLI for payload decoding.',
      rawData: { url: 'https://gchq.github.io/CyberChef/' },
    }],
    engine: 'cyberchef',
  };
}
