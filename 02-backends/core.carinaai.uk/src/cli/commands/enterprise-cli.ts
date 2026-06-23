import chalk from 'chalk';
import { describeEnterpriseOffering, ENTERPRISE_SUPPORT_SLAS } from '../../enterprise/kernel-support.js';

function flagValue(args: string[], name: string): string | undefined {
  return args.find((arg) => arg.startsWith(`${name}=`))?.split('=')[1]
    ?? (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
}

export async function runEnterpriseCommand(args: string[]): Promise<void> {
  const action = args[0] ?? 'status';
  const json = args.includes('--json');

  if (action === 'security') {
    const sub = args[1] ?? 'status';
    const {
      buildEnterpriseSecurityStatus,
      buildOidcDiscoveryDocument,
      buildResidencyStatus,
      buildSamlMetadataXml,
      describeEnterpriseSsoStatus,
      describeZeroTrustStatus,
      evaluateGeoFence,
      generateSoc2EvidencePackage,
      getDrStatus,
      immutableEnterpriseAudit,
      renderCiliumNetworkPolicy,
      runDrDrill,
      testEnterpriseSsoConnection,
      verifySoc2EvidencePackage,
    } = await import('../../enterprise/security/index.js');

    if (sub === 'status') {
      const status = await buildEnterpriseSecurityStatus();
      if (json) {
        console.log(JSON.stringify(status, null, 2));
      } else {
        console.log(chalk.bold('\nEnterprise security status\n'));
        console.log(`  SSO providers configured: ${status.sso.readiness.providersConfigured}`);
        console.log(`  Audit chain valid: ${status.audit.valid} (${status.audit.events} events)`);
        console.log(`  Residency region: ${status.residency.region} (${status.residency.mode})`);
        console.log(`  DR tier: ${status.dr.config.tier}; RPO ${status.dr.config.rpoMinutes}m; RTO ${status.dr.config.rtoMinutes}m`);
        console.log(`  Zero trust mTLS: ${status.zeroTrust.mtlsEnabled ? 'enabled' : 'disabled'}`);
      }
      return;
    }

    if (sub === 'sso') {
      const ssoAction = args[2] ?? 'status';
      if (ssoAction === 'metadata') {
        console.log(buildSamlMetadataXml());
        return;
      }
      if (ssoAction === 'oidc-discovery') {
        console.log(JSON.stringify(buildOidcDiscoveryDocument(), null, 2));
        return;
      }
      if (ssoAction === 'test') {
        const provider = (args[3] ?? 'oidc') as 'saml' | 'oidc' | 'ldap';
        const result = testEnterpriseSsoConnection(provider);
        if (json) console.log(JSON.stringify(result, null, 2));
        else console.log(result.ok ? chalk.green(result.message) : chalk.yellow(result.message));
        return;
      }
      const status = describeEnterpriseSsoStatus();
      console.log(json ? JSON.stringify(status, null, 2) : JSON.stringify(status, null, 2));
      return;
    }

    if (sub === 'audit') {
      const auditAction = args[2] ?? 'verify';
      if (auditAction === 'verify') {
        const result = await immutableEnterpriseAudit.verifyChain();
        if (json) console.log(JSON.stringify(result, null, 2));
        else console.log(result.valid ? chalk.green(`Audit chain valid (${result.events} events)`) : chalk.red(`Audit chain broken at ${result.brokenAt}`));
        return;
      }
      if (auditAction === 'export') {
        console.log(await immutableEnterpriseAudit.exportJsonl());
        return;
      }
      const eventId = args[2];
      if (!eventId) {
        console.error('Usage: carina enterprise security audit verify|export|<eventId>');
        process.exit(1);
      }
      console.log(JSON.stringify(await immutableEnterpriseAudit.verifyEvent(eventId), null, 2));
      return;
    }

    if (sub === 'residency') {
      const status = buildResidencyStatus();
      const sample = evaluateGeoFence({
        path: '/api/v1/data/chat',
        countryCode: flagValue(args, '--country') ?? 'US',
      });
      if (json) {
        console.log(JSON.stringify({ status, sample }, null, 2));
      } else {
        console.log(JSON.stringify(status, null, 2));
        console.log(`Geo-fence sample: ${sample.allowed ? 'allowed' : sample.error}`);
      }
      return;
    }

    if (sub === 'dr') {
      const drAction = args[2] ?? 'status';
      if (drAction === 'drill') {
        const result = await runDrDrill();
        console.log(json ? JSON.stringify(result, null, 2) : chalk.green(`DR drill ${result.passed ? 'passed' : 'failed'} in ${result.rtoSeconds}s`));
        return;
      }
      console.log(json ? JSON.stringify(await getDrStatus(), null, 2) : JSON.stringify(await getDrStatus(), null, 2));
      return;
    }

    if (sub === 'zero-trust') {
      const ztAction = args[2] ?? 'status';
      if (ztAction === 'policy') {
        console.log(renderCiliumNetworkPolicy());
        return;
      }
      console.log(json ? JSON.stringify(describeZeroTrustStatus(), null, 2) : JSON.stringify(describeZeroTrustStatus(), null, 2));
      return;
    }

    if (sub === 'soc2') {
      const soc2Action = args[2] ?? 'generate';
      if (soc2Action === 'verify') {
        const packagePath = flagValue(args, '--package');
        if (!packagePath) {
          console.error('Usage: carina enterprise security soc2 verify --package <path>');
          process.exit(1);
        }
        console.log(JSON.stringify(await verifySoc2EvidencePackage(packagePath), null, 2));
        return;
      }
      const from = flagValue(args, '--from') ?? '2026-01-01';
      const to = flagValue(args, '--to') ?? new Date().toISOString().slice(0, 10);
      const manifest = await generateSoc2EvidencePackage({ from, to });
      if (json) console.log(JSON.stringify(manifest, null, 2));
      else console.log(chalk.green(`SOC2 evidence package: ${manifest.packagePath}`));
      return;
    }

    console.error('Usage: carina enterprise security <status|sso|audit|residency|dr|zero-trust|soc2> ...');
    process.exit(1);
  }

  if (action === 'status' || action === 'offer') {
    const offering = describeEnterpriseOffering();
    if (json) {
      console.log(JSON.stringify({ offering, tiers: ENTERPRISE_SUPPORT_SLAS }, null, 2));
      return;
    }
    console.log(chalk.bold('\nCarina Enterprise (MIT kernel + commercial layers)\n'));
    console.log(`  Model: ${offering.model}`);
    console.log(`  Kernel license: ${offering.kernelLicense}`);
    console.log(`  Active tier: ${offering.activeTier}`);
    console.log(`  SLA: ${offering.sla.uptimeSla ?? 'none'} uptime; ${offering.sla.responseHours ?? 'n/a'}h response`);
    console.log(`  Channels: ${offering.sla.channels.join(', ')}`);
    console.log(chalk.bold('\nPaid layers\n'));
    for (const layer of offering.paidLayers) console.log(`  - ${layer}`);
    console.log(chalk.bold('\nIncludes (active tier)\n'));
    for (const item of offering.sla.includes) console.log(`  - ${item}`);
    console.log('');
    return;
  }

  if (action === 'tiers') {
    if (json) {
      console.log(JSON.stringify(ENTERPRISE_SUPPORT_SLAS, null, 2));
      return;
    }
    console.log(chalk.bold('\nSupport tiers\n'));
    for (const tier of Object.values(ENTERPRISE_SUPPORT_SLAS)) {
      console.log(`  ${tier.name} (${tier.tier})`);
      console.log(chalk.gray(`    uptime ${tier.uptimeSla ?? 'n/a'}; response ${tier.responseHours ?? 'n/a'}h`));
    }
    console.log('');
    return;
  }

  console.error('Usage: carina enterprise <status|tiers|offer|security> [--json]');
  process.exit(1);
}
