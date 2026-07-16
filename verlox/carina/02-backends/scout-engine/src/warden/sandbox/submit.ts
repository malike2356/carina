// Sample submission + result retrieval
import fs from 'node:fs';
import path from 'node:path';
import { createEvidenceDir, hashBuffer } from '../reporter.js';
import { loadWardenConfig } from '../config.js';
import { acquireVm, releaseVm } from './vm_pool.js';

export async function submitSample(
  samplePath: string,
  meta: { threatId?: string } = {},
): Promise<{ ok: boolean; summary: string; reportPath?: string; jobId?: string }> {
  if (!fs.existsSync(samplePath)) {
    return { ok: false, summary: `Sample not found: ${samplePath}` };
  }

  const cfg = loadWardenConfig();
  const slot = acquireVm(cfg.arsenal.capev2?.enabled ? 'capev2' : 'local-stub');
  if (!slot) {
    return { ok: false, summary: 'No sandbox VM available' };
  }

  const evidenceDir = createEvidenceDir('sandbox');
  const reportPath = path.join(evidenceDir, 'sandbox-report.json');
  const sha256 = hashBuffer(fs.readFileSync(samplePath));

  try {
    if (slot.backend === 'capev2' && cfg.arsenal.capev2?.base_url) {
      // HTTP submit when CAPE is configured; fall through to stub on failure
      try {
        const form = new FormData();
        const blob = new Blob([fs.readFileSync(samplePath)]);
        form.append('file', blob, path.basename(samplePath));
        const res = await fetch(`${cfg.arsenal.capev2.base_url}/apiv2/tasks/create/file/`, {
          method: 'POST',
          body: form,
        });
        const json = (await res.json()) as Record<string, unknown>;
        fs.writeFileSync(reportPath, JSON.stringify({ backend: 'capev2', meta, sha256, response: json }, null, 2));
        return {
          ok: res.ok,
          summary: `Submitted to CAPEv2 (${slot.id})`,
          reportPath,
          jobId: String((json as { data?: { task_ids?: number[] } }).data?.task_ids?.[0] ?? ''),
        };
      } catch {
        // fall through to local stub
      }
    }

    const stub = {
      backend: slot.backend,
      sample: samplePath,
      sha256,
      threatId: meta.threatId,
      behavioral: {
        network: [],
        files: [],
        processes: [],
        note: 'Local stub sandbox; connect CAPEv2/DRAKVUF for full detonation',
      },
      submittedAt: new Date().toISOString(),
    };
    fs.writeFileSync(reportPath, JSON.stringify(stub, null, 2));
    return {
      ok: true,
      summary: `Sandbox stub completed on ${slot.id}`,
      reportPath,
      jobId: path.basename(evidenceDir),
    };
  } finally {
    releaseVm(slot.id);
  }
}
