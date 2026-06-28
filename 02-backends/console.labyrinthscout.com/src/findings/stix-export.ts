import { listFindings } from './store.js';
import { listVendorRefs } from '../lib/connector-config.js';
import type { Finding } from './types.js';

export interface StixBundle {
  type: 'bundle';
  id: string;
  spec_version: '2.1';
  objects: StixObject[];
}

export interface StixObject {
  type: string;
  id: string;
  name?: string;
  description?: string;
  pattern?: string;
  pattern_type?: string;
  valid_from?: string;
  labels?: string[];
  external_references?: Array<{ source_name: string; external_id: string; url?: string }>;
  created?: string;
  modified?: string;
}

function findingToIndicator(
  finding: Finding,
  domain?: string,
  vendorRefs: Array<{ connector_id: string; vendor_id: string; vendor_url: string | null }> = [],
): StixObject {
  const host = domain ?? String(finding.rawData.host ?? finding.rawData.url ?? finding.targetId);
  const pattern = finding.findingType === 'cve'
    ? `[vulnerability:name = '${finding.title.replace(/'/g, "\\'")}']`
    : `[domain-name:value = '${String(host).replace(/'/g, "\\'")}']`;

  const externalReferences = [
    {
      source_name: 'scout',
      external_id: finding.id,
    },
    ...vendorRefs.map((ref) => ({
      source_name: ref.connector_id,
      external_id: ref.vendor_id,
      ...(ref.vendor_url ? { url: ref.vendor_url } : {}),
    })),
  ];

  return {
    type: 'indicator',
    id: `indicator--${finding.id}`,
    name: finding.title,
    description: finding.description ?? undefined,
    pattern,
    pattern_type: 'stix',
    valid_from: finding.firstSeen,
    labels: [finding.severity, finding.tool, finding.findingType],
    created: finding.createdAt,
    modified: finding.lastSeen,
    external_references: externalReferences,
  };
}

export async function buildStixBundleWithVendorRefs(
  findings: Finding[],
  opts: { bundleId?: string; domain?: string; cveOnly?: boolean } = {},
): Promise<StixBundle> {
  const filtered = opts.cveOnly
    ? findings.filter((f) => f.findingType === 'cve' || f.severity === 'critical' || f.severity === 'high')
    : findings;

  const objects: StixObject[] = [];
  for (const finding of filtered) {
    const vendorRefs = await listVendorRefs(finding.id);
    objects.push(findingToIndicator(finding, opts.domain, vendorRefs));
  }

  return {
    type: 'bundle',
    id: opts.bundleId ?? `bundle--scout-${Date.now()}`,
    spec_version: '2.1',
    objects,
  };
}

export function buildStixBundle(
  findings: Finding[],
  opts: { bundleId?: string; domain?: string; cveOnly?: boolean } = {},
): StixBundle {
  const filtered = opts.cveOnly
    ? findings.filter((f) => f.findingType === 'cve' || f.severity === 'critical' || f.severity === 'high')
    : findings;

  return {
    type: 'bundle',
    id: opts.bundleId ?? `bundle--scout-${Date.now()}`,
    spec_version: '2.1',
    objects: filtered.map((f) => findingToIndicator(f, opts.domain)),
  };
}

export async function buildAccountStixBundle(
  accountId: string,
  opts: { targetId?: string; cveOnly?: boolean; limit?: number } = {},
): Promise<StixBundle> {
  const findings = await listFindings(accountId, {
    targetId: opts.targetId,
    status: 'open',
    limit: opts.limit ?? 200,
  });
  return buildStixBundleWithVendorRefs(findings, {
    bundleId: `bundle--scout-${accountId}${opts.targetId ? `-${opts.targetId}` : ''}`,
    cveOnly: opts.cveOnly ?? true,
  });
}
