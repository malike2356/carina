import { getPairedNode } from './node-host/store.js';
import { getPairedDeviceById } from './device-pairing.js';

export async function lookupDevicePublicKey(deviceId: string): Promise<string | null> {
  const node = getPairedNode(deviceId);
  if (node?.publicKey) return node.publicKey;
  const device = getPairedDeviceById(deviceId);
  if (device?.publicKey) return device.publicKey;
  return null;
}
