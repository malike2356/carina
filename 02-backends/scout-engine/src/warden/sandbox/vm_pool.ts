// CAPEv2 / DRAKVUF VM pool manager (stub-capable)
import { loadWardenConfig } from '../config.js';

export interface VmSlot {
  id: string;
  backend: 'capev2' | 'drakvuf' | 'local-stub';
  busy: boolean;
  lastUsedAt?: string;
}

const pool: VmSlot[] = [
  { id: 'vm-cape-1', backend: 'capev2', busy: false },
  { id: 'vm-drak-1', backend: 'drakvuf', busy: false },
  { id: 'vm-stub-1', backend: 'local-stub', busy: false },
];

export function listVmPool(): VmSlot[] {
  return pool.map((s) => ({ ...s }));
}

export function acquireVm(prefer: 'capev2' | 'drakvuf' | 'local-stub' = 'local-stub'): VmSlot | null {
  const cfg = loadWardenConfig();
  const ordered = [
    ...pool.filter((s) => s.backend === prefer && !s.busy),
    ...pool.filter((s) => s.backend === 'local-stub' && !s.busy),
    ...pool.filter((s) => !s.busy),
  ];
  const slot = ordered[0];
  if (!slot) return null;
  if (prefer === 'capev2' && !cfg.arsenal.capev2?.enabled) {
    const stub = pool.find((s) => s.backend === 'local-stub' && !s.busy);
    if (!stub) return null;
    stub.busy = true;
    stub.lastUsedAt = new Date().toISOString();
    return { ...stub };
  }
  slot.busy = true;
  slot.lastUsedAt = new Date().toISOString();
  return { ...slot };
}

export function releaseVm(id: string): void {
  const slot = pool.find((s) => s.id === id);
  if (slot) slot.busy = false;
}
