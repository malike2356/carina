import type { Tool } from '../types/index.js';
import { nodeHostRoutesEnabled } from '../infrastructure/node-host/routes.js';
import { getNodeHostServer } from '../infrastructure/node-host/node-host-server.js';
import { NodeCapability } from '../infrastructure/node-host/node-protocol.js';
import { getCanvasHost } from '../infrastructure/node-host/canvas-host.js';

function nodeDisabled() {
  return {
    error: 'Node host is not enabled. Set CARINA_NODE_HOST_ENABLED=true on the gateway.',
    code: 'NODE_HOST_DISABLED',
  };
}

function pickDeviceId(params: Record<string, unknown>): string {
  return String(params.deviceId ?? '').trim();
}

async function sendNodeCommand(
  deviceId: string,
  capability: NodeCapability,
  method: string,
  commandParams: Record<string, unknown>,
  timeoutMs = 30_000,
) {
  return getNodeHostServer().sendCommand(deviceId, capability, method, commandParams, timeoutMs);
}

export const nodeCanvasRenderTool: Tool = {
  name: 'node_canvas_render',
  description: 'Render UI on a connected node device Canvas',
  parameters: {
    type: 'object',
    properties: {
      deviceId: { type: 'string', description: 'Target node device ID' },
      content: { type: 'object', description: 'A2UI JSON content to render' },
    },
    required: ['deviceId', 'content'],
  },
  execute: async (params) => {
    if (!nodeHostRoutesEnabled()) return nodeDisabled();
    const deviceId = pickDeviceId(params);
    const response = await sendNodeCommand(
      deviceId,
      NodeCapability.CANVAS_RENDER,
      'render',
      { content: params.content },
      15_000,
    );
    return response.ok ? { rendered: true, payload: response.payload } : { error: response.error };
  },
};

export const canvasPushTool: Tool = {
  name: 'canvas_push',
  description: 'Push an artifact to a user device Canvas for richer display',
  parameters: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['html', 'svg', 'markdown', 'react', 'image', 'json-table'],
      },
      content: { type: 'string' },
      title: { type: 'string' },
      deviceId: { type: 'string', description: 'Target device (omit for all connected)' },
      sessionId: { type: 'string' },
    },
    required: ['type', 'content'],
  },
  execute: async (params) => {
    if (!nodeHostRoutesEnabled()) return nodeDisabled();
    const artifact = getCanvasHost().createArtifact({
      type: String(params.type) as 'html',
      content: String(params.content),
      title: params.title ? String(params.title) : undefined,
      sessionId: String(params.sessionId ?? 'agent'),
    });
    const deviceId = pickDeviceId(params);
    if (deviceId) {
      const result = await getCanvasHost().pushToNode(deviceId, artifact);
      return {
        artifactId: result.artifactId,
        rendered: result.rendered,
        url: `/__carina__/canvas/${artifact.id}`,
      };
    }
    const rendered = await getCanvasHost().pushToAll(artifact);
    return {
      artifactId: artifact.id,
      renderedCount: rendered.length,
      url: `/__carina__/canvas/${artifact.id}`,
    };
  },
};

export const nodeCameraCaptureTool: Tool = {
  name: 'node_camera_capture',
  description: 'Capture a photo from a connected node camera',
  parameters: {
    type: 'object',
    properties: {
      deviceId: { type: 'string' },
      source: { type: 'string', enum: ['front', 'back'], default: 'back' },
    },
    required: ['deviceId'],
  },
  execute: async (params) => {
    if (!nodeHostRoutesEnabled()) return nodeDisabled();
    const response = await sendNodeCommand(
      pickDeviceId(params),
      NodeCapability.CAMERA_CAPTURE,
      'capture',
      { source: params.source ?? 'back' },
      15_000,
    );
    if (!response.ok) return { error: response.error ?? 'Camera capture failed' };
    return response.payload;
  },
};

export const cameraCaptureTool: Tool = {
  name: 'camera_capture',
  description: 'Take a photo using a connected device camera',
  parameters: {
    type: 'object',
    properties: {
      deviceId: { type: 'string' },
      source: { type: 'string', enum: ['front', 'back', 'external'], default: 'back' },
      format: { type: 'string', enum: ['jpeg', 'png'], default: 'jpeg' },
      quality: { type: 'number', minimum: 0.1, maximum: 1.0, default: 0.8 },
    },
    required: ['deviceId'],
  },
  execute: async (params) => {
    if (!nodeHostRoutesEnabled()) return nodeDisabled();
    const response = await sendNodeCommand(
      pickDeviceId(params),
      NodeCapability.CAMERA_CAPTURE,
      'capture',
      {
        source: params.source ?? 'back',
        format: params.format ?? 'jpeg',
        quality: params.quality ?? 0.8,
      },
      15_000,
    );
    if (!response.ok) {
      return { error: `Camera capture failed: ${response.error ?? 'unknown error'}` };
    }
    const payload = response.payload as { dataUrl?: string; width?: number; height?: number };
    return {
      dataUrl: payload?.dataUrl,
      width: payload?.width,
      height: payload?.height,
      summary: payload?.width && payload?.height
        ? `Photo captured (${payload.width}x${payload.height})`
        : 'Photo captured',
    };
  },
};

export const nodeLocationGetTool: Tool = {
  name: 'node_location_get',
  description: 'Get current location from a connected node',
  parameters: {
    type: 'object',
    properties: { deviceId: { type: 'string' } },
    required: ['deviceId'],
  },
  execute: async (params) => {
    if (!nodeHostRoutesEnabled()) return nodeDisabled();
    const response = await sendNodeCommand(
      pickDeviceId(params),
      NodeCapability.LOCATION_GET,
      'getPosition',
      {},
      15_000,
    );
    return response.ok ? response.payload : { error: response.error };
  },
};

export const locationGetTool: Tool = {
  name: 'location_get',
  description: 'Get current GPS location from a connected device',
  parameters: {
    type: 'object',
    properties: {
      deviceId: { type: 'string' },
      highAccuracy: { type: 'boolean', default: true },
      timeout: { type: 'number', default: 10_000 },
    },
    required: ['deviceId'],
  },
  execute: async (params) => {
    if (!nodeHostRoutesEnabled()) return nodeDisabled();
    const response = await sendNodeCommand(
      pickDeviceId(params),
      NodeCapability.LOCATION_GET,
      'getPosition',
      {
        highAccuracy: params.highAccuracy ?? true,
        timeout: params.timeout ?? 10_000,
      },
      Number(params.timeout ?? 10_000) + 2000,
    );
    return response.ok ? response.payload : { error: response.error };
  },
};

export const locationWatchTool: Tool = {
  name: 'location_watch',
  description: 'Start watching GPS location changes on a connected device',
  parameters: {
    type: 'object',
    properties: {
      deviceId: { type: 'string' },
      interval: { type: 'number', default: 5000 },
      distanceFilter: { type: 'number', default: 10 },
      duration: { type: 'number', default: 60_000 },
    },
    required: ['deviceId'],
  },
  execute: async (params) => {
    if (!nodeHostRoutesEnabled()) return nodeDisabled();
    const response = await sendNodeCommand(
      pickDeviceId(params),
      NodeCapability.LOCATION_WATCH,
      'startWatch',
      {
        interval: params.interval ?? 5000,
        distanceFilter: params.distanceFilter ?? 10,
        duration: params.duration ?? 60_000,
      },
      Number(params.duration ?? 60_000) + 5000,
    );
    return response.ok ? response.payload : { error: response.error };
  },
};

export const locationWatchStopTool: Tool = {
  name: 'location_watch_stop',
  description: 'Stop a GPS location watch on a connected device',
  parameters: {
    type: 'object',
    properties: {
      deviceId: { type: 'string' },
      watchId: { type: 'string' },
    },
    required: ['deviceId', 'watchId'],
  },
  execute: async (params) => {
    if (!nodeHostRoutesEnabled()) return nodeDisabled();
    const response = await sendNodeCommand(
      pickDeviceId(params),
      NodeCapability.LOCATION_WATCH,
      'stopWatch',
      { watchId: params.watchId },
      10_000,
    );
    return response.ok ? response.payload : { error: response.error };
  },
};

export const nodeScreenRecordTool: Tool = {
  name: 'node_screen_record',
  description: 'Start or stop screen recording on a connected node',
  parameters: {
    type: 'object',
    properties: {
      deviceId: { type: 'string' },
      action: { type: 'string', enum: ['start', 'stop'] },
      duration: { type: 'number', description: 'Max recording seconds (start only)' },
    },
    required: ['deviceId', 'action'],
  },
  execute: async (params) => {
    if (!nodeHostRoutesEnabled()) return nodeDisabled();
    const action = String(params.action);
    const response = await sendNodeCommand(
      pickDeviceId(params),
      NodeCapability.SCREEN_RECORD,
      action === 'start' ? 'startRecording' : 'stopRecording',
      { duration: params.duration },
      action === 'start' ? Number(params.duration ?? 60) * 1000 + 5000 : 30_000,
    );
    return response.ok ? response.payload : { error: response.error };
  },
};

export const screenRecordTool: Tool = {
  name: 'screen_record',
  description: 'Record the screen of a connected device',
  parameters: {
    type: 'object',
    properties: {
      deviceId: { type: 'string' },
      action: { type: 'string', enum: ['start', 'stop', 'status'] },
      duration: { type: 'number', description: 'Max seconds (start only, default 60)' },
      includeAudio: { type: 'boolean', default: false },
    },
    required: ['deviceId', 'action'],
  },
  execute: async (params) => {
    if (!nodeHostRoutesEnabled()) return nodeDisabled();
    const action = String(params.action);
    const method = action === 'start'
      ? 'startRecording'
      : action === 'stop'
        ? 'stopRecording'
        : 'status';
    const response = await sendNodeCommand(
      pickDeviceId(params),
      NodeCapability.SCREEN_RECORD,
      method,
      {
        duration: params.duration ?? 60,
        includeAudio: params.includeAudio ?? false,
      },
      action === 'start' ? Number(params.duration ?? 60) * 1000 + 5000 : 15_000,
    );
    return response.ok ? response.payload : { error: response.error };
  },
};

export const NODE_TOOLS: Tool[] = [
  nodeCanvasRenderTool,
  canvasPushTool,
  nodeCameraCaptureTool,
  cameraCaptureTool,
  nodeLocationGetTool,
  locationGetTool,
  locationWatchTool,
  locationWatchStopTool,
  nodeScreenRecordTool,
  screenRecordTool,
];
