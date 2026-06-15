import type { Tool } from '../types/index.js';
import { auditSecrets } from '../ops/secrets-audit.js';

export const secretsAuditTool: Tool = {
  name: 'secrets-audit',
  description:
    'Run a read-only secrets hygiene audit on the local Carina environment (.env placeholders, precedence drift, unresolved refs). Does not print secret values.',
  parameters: {
    type: 'object',
    properties: {
      include_process_env: {
        type: 'boolean',
        description: 'Include process.env secret keys in the scan (default false)',
      },
    },
  },
  execute: async (params) => {
    try {
      const report = auditSecrets({
        includeProcessEnv: params.include_process_env === true,
      });
      return {
        generated_at: report.generatedAt,
        summary: report.summary,
        precedence_drift: report.precedenceDrift,
        unresolved_refs: report.unresolvedRefs,
        findings: report.findings.map((f) => ({
          id: f.id,
          severity: f.severity,
          source: f.source,
          key: f.key,
          detail: f.detail,
        })),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { error: msg };
    }
  },
};
