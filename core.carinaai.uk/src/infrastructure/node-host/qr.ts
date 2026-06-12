import type { NodePairQrPayload } from './types.js';

export function buildNodePairQrPayload(input: {
  gatewayUrl: string;
  pendingId: string;
  code: string;
  name: string;
}): NodePairQrPayload {
  return {
    v: 1,
    gatewayUrl: input.gatewayUrl.replace(/\/$/, ''),
    pendingId: input.pendingId,
    code: input.code,
    name: input.name,
  };
}

export function encodeQrPayload(payload: NodePairQrPayload): string {
  return JSON.stringify(payload);
}

/** Compact terminal-friendly QR alternative: pasteable claim URL + code */
export function formatPairingQrTerminal(payload: NodePairQrPayload): string {
  const claimUrl = `${payload.gatewayUrl}/api/nodes/pair/claim-info?pending=${payload.pendingId}`;
  return [
    'Scan or open on a trusted device:',
    claimUrl,
    `Code: ${payload.code}`,
    `Payload: ${encodeQrPayload(payload)}`,
  ].join('\n');
}
