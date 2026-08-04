#!/usr/bin/env tsx
import {
  resolveProjectRoot,
  runSupplyChainReview,
  sbomOutputPath,
  shouldBlockSupplyChain,
  writeSbom,
} from '../src/security/supply-chain/index.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const projectRoot = resolveProjectRoot();
  const failOn = args.includes('--fail-on=high') || args.includes('--fail-on-high') ? 'high' : 'critical';

  await writeSbom(projectRoot, sbomOutputPath(projectRoot));
  const report = await runSupplyChainReview({ projectRoot });

  if (args.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`SBOM packages: ${report.sbom?.packages.length ?? 0}`);
    console.log(`Dependency verdict: ${report.dependencyScan?.verdict ?? 'unknown'}`);
  }

  if (shouldBlockSupplyChain(report, failOn)) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
