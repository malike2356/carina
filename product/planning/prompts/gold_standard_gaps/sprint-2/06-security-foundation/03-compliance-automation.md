# Prompt 03: Compliance Automation (SOC2 Evidence)

## Context

Scout Govern tier includes SOC2 evidence gathering. Currently Scout logs events to PostgreSQL.
Compliance automation maps those events to SOC2 control requirements and packages the evidence
into a cryptographically-anchored bundle that auditors can verify.

## What to Build

### 1. SOC2 control mapping

Create `src/security/compliance/soc2-controls.ts`:
```typescript
export type ControlId = 'CC1.1' | 'CC2.1' | 'CC6.1' | 'CC6.2' | 'CC6.7' | 'CC7.1' | 'CC7.2' | 'CC8.1' | 'CC9.1';

export const SOC2_CONTROLS: Record<ControlId, {
  name: string;
  description: string;
  evidenceSources: string[]; // Scout event types that satisfy this control
}> = {
  'CC6.1': {
    name: 'Logical and Physical Access Controls',
    description: 'The entity implements logical access security software and controls',
    evidenceSources: ['auth.login', 'auth.logout', 'auth.failed', 'tool-approval'],
  },
  'CC7.1': {
    name: 'System Monitoring',
    description: 'Detection and monitoring of security events',
    evidenceSources: ['scout.alert', 'scout.score-change', 'kill-switch'],
  },
  'CC7.2': {
    name: 'Incident Response',
    description: 'Response to security incidents',
    evidenceSources: ['forensics-tool-run', 'secret-rotated', 'scout.incident-resolved'],
  },
  // ... other controls
};
```

### 2. Evidence package generator

Create `src/security/compliance/evidence-packager.ts`:
```typescript
export async function generateEvidencePackage(opts: {
  startDate: Date;
  endDate: Date;
  controls: ControlId[];
  outputPath: string;
}): Promise<EvidencePackage> {
  const evidence: EvidenceItem[] = [];

  for (const controlId of opts.controls) {
    const control = SOC2_CONTROLS[controlId];
    const events = await db.query(
      `SELECT * FROM scout_events
       WHERE event_type = ANY($1)
       AND timestamp BETWEEN $2 AND $3
       ORDER BY timestamp`,
      [control.evidenceSources, opts.startDate, opts.endDate]
    );

    evidence.push({
      controlId,
      controlName: control.name,
      eventCount: events.rows.length,
      events: events.rows,
    });
  }

  // Compute SHA-256 hash of the entire evidence set
  const hash = sha256(JSON.stringify(evidence));

  const pkg: EvidencePackage = {
    generatedAt: new Date(),
    period: { start: opts.startDate, end: opts.endDate },
    controls: opts.controls,
    evidence,
    hash,
    // Ethereum anchor added in next step
  };

  await writeJson(`${opts.outputPath}/soc2-evidence.json`, pkg);
  return pkg;
}
```

### 3. Cryptographic anchoring

After generating the evidence JSON, anchor the hash to a public blockchain:
```typescript
export async function anchorToEthereum(hash: string): Promise<string> {
  // Use ethers.js to write the hash to a public Ethereum contract
  const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL);
  const wallet = new ethers.Wallet(process.env.ETHEREUM_PRIVATE_KEY!, provider);

  // Simple anchor: send 0 ETH to a null address with the hash as data
  const tx = await wallet.sendTransaction({
    to: ethers.ZeroAddress,
    value: 0n,
    data: ethers.hexlify(Buffer.from(hash, 'hex')),
  });

  return tx.hash; // Ethereum transaction hash proves hash existed at this block
}
```

Add `ethers` to dependencies: `pnpm add ethers`

### 4. Auditor share link

Generate a time-limited share link that auditors can use to verify the package:
```typescript
export async function createAuditorShare(packageId: string, expiresInDays = 30): Promise<string> {
  const token = generateSecureToken(32);
  await db.query(
    'INSERT INTO auditor_shares (package_id, token, expires_at) VALUES ($1, $2, $3)',
    [packageId, token, new Date(Date.now() + expiresInDays * 86400000)]
  );
  return `https://core.carinaai.uk/audit/verify/${token}`;
}
```

### 5. CLI commands

```bash
carina compliance generate --start 2026-01-01 --end 2026-06-30 --controls CC6.1,CC7.1,CC7.2
carina compliance verify <share-token>
carina compliance report --output soc2-q2-2026.pdf
```

## Verification Checklist

- [ ] `carina compliance generate` produces `soc2-evidence.json` with event counts per control
- [ ] Package hash matches SHA-256 of the evidence JSON
- [ ] Ethereum transaction hash is recorded in the package (testnet acceptable)
- [ ] Auditor share link opens a verification page showing the package hash and transaction
- [ ] `carina compliance verify <token>` confirms hash integrity

## Files to Create or Modify

- CREATE `src/security/compliance/soc2-controls.ts`
- CREATE `src/security/compliance/evidence-packager.ts`
- CREATE `src/api/compliance.ts` - auditor share link routes
- MODIFY `src/tools/registry.ts` - register compliance tools
- MODIFY `src/cli/scout.ts` - add compliance subcommands
- MODIFY `package.json` - add ethers dependency
