import { resolveDomain } from './domain.js';
import { runNmapScan } from './nmap-engine.js';
import { runSubdomainScan } from './subdomain-engine.js';
import { runNucleiScan } from './nuclei-engine.js';
import { runTechFingerprint } from './tech-engine.js';
import type { QuickScanResult } from './types.js';

export async function runQuickScan(domain: string): Promise<QuickScanResult> {
  const started = Date.now();
  const host = (await resolveDomain(domain)) ?? domain;
  const enginesUsed: string[] = [];

  const nmap = await runNmapScan(host, domain);
  enginesUsed.push(nmap.engine);

  const subdomains = await runSubdomainScan(domain);
  enginesUsed.push(subdomains.engine);

  const nuclei = await runNucleiScan(domain);
  if (nuclei.engine !== 'skipped') enginesUsed.push(nuclei.engine);

  const tech = await runTechFingerprint(domain);
  enginesUsed.push(tech.engine);

  const findings = [
    ...nmap.findings,
    ...subdomains.findings,
    ...nuclei.findings,
    ...tech.findings,
  ];

  return {
    findings,
    meta: {
      openPorts: nmap.openPorts,
      subdomains: subdomains.subdomains,
      techStack: tech.techStack,
      durationMs: Date.now() - started,
      enginesUsed,
    },
  };
}
