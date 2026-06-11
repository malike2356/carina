import type { Tool } from '../types/index.js';

async function haCall(
  path: string,
  method: 'GET' | 'POST' = 'GET',
  body?: Record<string, unknown>,
): Promise<unknown> {
  const base = process.env.HOMEASSISTANT_URL ?? '';
  const token = process.env.HOMEASSISTANT_TOKEN ?? '';
  if (!base || !token) return { error: 'Set HOMEASSISTANT_URL and HOMEASSISTANT_TOKEN' };

  const url = `${base.replace(/\/$/, '')}/api${path}`;
  const response = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  try {
    return { status: response.status, data: JSON.parse(text) };
  } catch {
    return { status: response.status, data: text };
  }
}

export const haListEntitiesTool: Tool = {
  name: 'ha-list-entities',
  description: 'List all Home Assistant entity states.',
  parameters: { type: 'object', properties: {} },
  execute: async () => haCall('/states'),
};

export const haGetStateTool: Tool = {
  name: 'ha-get-state',
  description: 'Get the state of a single Home Assistant entity.',
  parameters: {
    type: 'object',
    properties: { entity_id: { type: 'string' } },
    required: ['entity_id'],
  },
  execute: async (params) => {
    const entityId = String(params.entity_id ?? '').trim();
    if (!entityId) return { error: 'entity_id is required' };
    return haCall(`/states/${encodeURIComponent(entityId)}`);
  },
};

export const haListServicesTool: Tool = {
  name: 'ha-list-services',
  description: 'List available Home Assistant services.',
  parameters: { type: 'object', properties: {} },
  execute: async () => haCall('/services'),
};

export const haCallServiceTool: Tool = {
  name: 'ha-call-service',
  dangerous: true,
  description: 'Call a Home Assistant service (e.g. light.turn_on).',
  parameters: {
    type: 'object',
    properties: {
      domain: { type: 'string' },
      service: { type: 'string' },
      entity_id: { type: 'string' },
      service_data: { type: 'object' },
    },
    required: ['domain', 'service'],
  },
  requiresConfirmation: true,
  execute: async (params) => {
    const domain = String(params.domain ?? '').trim();
    const service = String(params.service ?? '').trim();
    if (!domain || !service) return { error: 'domain and service are required' };
    const data = (params.service_data ?? {}) as Record<string, unknown>;
    if (params.entity_id) data.entity_id = String(params.entity_id);
    return haCall(`/services/${domain}/${service}`, 'POST', data);
  },
};
