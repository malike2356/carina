// VM snapshot revert to clean state
import { listVmPool, releaseVm } from './vm_pool.js';

export function cleanupSandboxPool(): { released: string[]; message: string } {
  const released: string[] = [];
  for (const slot of listVmPool()) {
    if (slot.busy) {
      releaseVm(slot.id);
      released.push(slot.id);
    }
  }
  return {
    released,
    message:
      released.length > 0
        ? `Released ${released.length} VM slot(s); revert snapshots when CAPE/DRAKVUF connected`
        : 'Sandbox pool already clean',
  };
}
