import type { Tool } from '../types/index.js';
import { isPropreneurBridgeEnabled } from '../workers/aiva-feature-flags.js';
import { getWorkerSessionContext } from '../workers/worker-session-context.js';
import {
  validateAndSetPropreneurBinding,
  resolvePropreneurBinding,
} from '../workers/worker-bridge-store.js';
import { registerSessionTool } from './session-tool-store.js';
import { registerPropreneurSessionTools } from './propreneur-portfolio.js';

/**
 * Generates the URL for the simple one-click key generator page in Propreneur.
 */
function connectPageUrl(tenantSlug: string): string {
  const base = (process.env.PROPREENEUR_TENANT_BASE_DOMAIN ?? 'propreneur.uk').trim();
  return `https://${tenantSlug}.${base}/aiva/connect`;
}

export function createPropreneurSelfConfigureTool(sessionId: string): Tool[] {
  return [
    {
      name: 'propreneur-connect',
      description:
        'Connect this Aiva worker to a Propreneur property management workspace. ' +
        'Use this when the user says they want to connect Propreneur, link their property workspace, ' +
        'or when they provide a Propreneur connection key. ' +
        'If the user has not provided a key yet, guide them to generate one by opening their ' +
        'Propreneur connect page. If they have provided a key (starts with "crm_"), validate and bind it.',
      parameters: {
        type: 'object',
        properties: {
          tenant_slug: {
            type: 'string',
            description:
              'The Propreneur workspace slug (subdomain). For example if their workspace is at ' +
              'xelox.propreneur.uk, the slug is "xelox". Ask the user for this if not known.',
          },
          api_key: {
            type: 'string',
            description:
              'The connection key from Propreneur. Starts with "crm_". ' +
              'If the user has not provided one yet, omit this and the tool will return instructions.',
          },
        },
        required: ['tenant_slug'],
      },
      execute: async (params) => {
        const tenantSlug = String(params.tenant_slug ?? '').trim();
        if (!tenantSlug) {
          return {
            status: 'need_info',
            message:
              'I need your Propreneur workspace name. ' +
              'This is the first part of your Propreneur web address. ' +
              'For example, if you go to xelox.propreneur.uk, your workspace name is "xelox".',
          };
        }

        const apiKey = String(params.api_key ?? '').trim();

        if (!apiKey) {
          const url = connectPageUrl(tenantSlug);
          return {
            status: 'need_key',
            connect_url: url,
            message:
              `Open this link to generate your connection key: ${url}\n\n` +
              'It will show one big button. Click it, then copy the key and paste it here.',
            instructions: [
              `1. Click this link: ${url}`,
              '2. Log in if asked',
              '3. Click "Generate Connection Key"',
              '4. Click "Copy"',
              '5. Come back here and paste the key',
            ],
          };
        }

        if (!apiKey.startsWith('crm_') || apiKey.length < 20) {
          return {
            status: 'invalid_key',
            message:
              'That does not look like a valid connection key. ' +
              'A valid key starts with "crm_" and is about 52 characters long. ' +
              'Please try copying it again from the Propreneur connect page.',
          };
        }

        const ctx = getWorkerSessionContext(sessionId);
        if (!ctx) {
          return { status: 'error', message: 'No active session. Please try again.' };
        }

        try {
          const result = await validateAndSetPropreneurBinding(
            ctx.worker.workspaceId,
            ctx.worker.id,
            tenantSlug,
            apiKey,
          );

          ctx.worker.propreneurTenantSlug = result.tenantSlug;
          ctx.worker.propreneurBridgeKeyRef = 'bound';

          registerPropreneurSessionTools(sessionId);

          return {
            status: 'connected',
            tenant_slug: result.tenantSlug,
            property_count: result.propertyCount,
            message:
              `Connected to your Propreneur workspace "${result.tenantSlug}". ` +
              `I can see ${result.propertyCount} ${result.propertyCount === 1 ? 'property' : 'properties'}. ` +
              'I can now help you manage your properties, contacts, maintenance, expenses, and more.',
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return {
            status: 'error',
            message:
              'Could not connect. Please check that:\n' +
              '- Your workspace name is correct\n' +
              '- The key was copied fully (no missing characters)\n' +
              `- Technical detail: ${msg}`,
          };
        }
      },
    },
  ];
}

/**
 * Register the self-configure tool when a worker does NOT already have a
 * Propreneur binding. This gives unbound workers the ability to self-connect
 * via conversation.
 */
export function registerPropreneurSelfConfigureTool(sessionId: string): void {
  if (!isPropreneurBridgeEnabled()) return;
  const ctx = getWorkerSessionContext(sessionId);
  if (!ctx) return;

  if (resolvePropreneurBinding(ctx.worker)) return;

  for (const tool of createPropreneurSelfConfigureTool(sessionId)) {
    registerSessionTool(sessionId, tool);
  }
}
