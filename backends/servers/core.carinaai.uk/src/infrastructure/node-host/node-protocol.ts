export enum NodeCapability {
  CANVAS = 'canvas',
  CANVAS_RENDER = 'canvas.render',
  CAMERA_CAPTURE = 'camera.capture',
  CAMERA_STREAM = 'camera.stream',
  SCREEN_RECORD = 'screen.record',
  LOCATION_GET = 'location.get',
  LOCATION_WATCH = 'location.watch',
  VOICE_WAKE = 'voice.wake',
  TALK_MODE = 'talk.mode',
  NOTIFICATIONS = 'notifications',
  FILE_SYSTEM = 'filesystem',
}

export type NodePlatform = 'ios' | 'android' | 'macos' | 'linux' | 'windows' | 'headless';

export interface NodeHello {
  type: 'hello';
  deviceId: string;
  deviceName: string;
  platform: NodePlatform | string;
  capabilities: NodeCapability[];
  auth: {
    token: string;
    nonce?: string;
    signature?: string;
  };
  version: string;
}

export interface NodeHelloOk {
  type: 'hello_ok';
  nodeId: string;
  capabilities?: NodeCapability[];
}

export interface NodeChallenge {
  type: 'challenge';
  nonce: string;
  deviceId: string;
  expiresAt: number;
}

export interface NodeProtocolCommand {
  type: 'command';
  id: string;
  capability: NodeCapability | string;
  method: string;
  params: Record<string, unknown>;
  timeout?: number;
}

export interface NodeProtocolResponse {
  type: 'response';
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: string;
}

export type NodeInfo = {
  deviceId: string;
  deviceName: string;
  platform: string;
  capabilities: NodeCapability[];
  connectedAt: number;
  uptime: number;
  protocolVersion: 'legacy' | 'v2';
};

export function parseNodeCapability(value: string): NodeCapability | null {
  const values = Object.values(NodeCapability) as string[];
  return values.includes(value) ? (value as NodeCapability) : null;
}

export function normalizeCapabilities(raw: unknown): NodeCapability[] {
  if (!Array.isArray(raw)) return [];
  const out: NodeCapability[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const cap = parseNodeCapability(item);
    if (cap && !out.includes(cap)) out.push(cap);
  }
  return out;
}
