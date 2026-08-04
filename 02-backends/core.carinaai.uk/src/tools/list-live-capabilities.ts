import { buildCapabilityManifest } from '../capabilities/manifest-builder.js';
import { buildCapabilityPromptBlock } from '../capabilities/prompt-injection.js';
import { getActivePackNames } from '../skills/index.js';
import { TOOL_CAPABILITIES } from '../credentials/tool-capabilities.js';
import { resolveCredential } from '../credentials/resolver.js';

/**
 * Live inventory of what this agent can do right now.
 * Complements tool_status (credential matrix) with session-aware capability summary.
 */
export const listLiveCapabilitiesTool = {
  name: 'list_live_capabilities',
  description: `Return a live snapshot of what this agent can do in the current session:
active tools (count + categories), connected channels, active skill packs, knowledge/RAG status,
and a short plain-language summary. Use when asked "what can you do?", "what do you know about
this system?", or when YOUR CAPABILITIES may be stale.`,
  parameters: {
    type: 'object',
    properties: {
      workspaceId: {
        type: 'string',
        description: 'Optional workspace id for channel and RAG stats.',
      },
      includePromptBlock: {
        type: 'boolean',
        description: 'If true, include the same text block injected into the system prompt.',
      },
    },
    required: [],
  },
  async execute(params: Record<string, unknown>) {
    const workspaceId =
      typeof params.workspaceId === 'string' && params.workspaceId.trim()
        ? params.workspaceId.trim()
        : process.env.CARINA_WORKSPACE_ID?.trim() || null;
    const includePromptBlock = params.includePromptBlock === true;
    const sessionId =
      process.env.CARINA_SESSION_ID?.trim() ||
      `live-capabilities-${Date.now()}`;

    const manifest = await buildCapabilityManifest({
      sessionId,
      workspaceId,
      forceRefresh: true,
    });

    const credentialSample = await Promise.all(
      TOOL_CAPABILITIES.slice(0, 40).map(async (entry) => {
        const missing: string[] = [];
        for (const cred of entry.required_credentials) {
          const value = await resolveCredential(cred);
          if (!value) missing.push(cred);
        }
        return {
          tool: entry.tool_name,
          category: entry.category,
          ready: missing.length === 0,
          missing,
        };
      }),
    );

    const readyCreds = credentialSample.filter((c) => c.ready).length;
    const packs = getActivePackNames();

    return {
      summary: {
        product: 'Carina / Aiva agent core',
        activeTools: manifest.summary.totalToolsActive,
        catalogTools: manifest.summary.totalToolsAvailable,
        skillsActive: manifest.summary.totalSkillsActive,
        channelsConnected: manifest.summary.totalChannelsConnected,
        ragDocuments: manifest.summary.totalRagDocuments,
        ragDomains: manifest.summary.ragDomains,
        activeSkillPacks: packs,
        alwaysRetrievableRagPacks: ['carina-rag', 'user-resources', 'custom', 'product-docs'],
        credentialSampleReady: readyCreds,
        credentialSampleTotal: credentialSample.length,
        generatedAt: manifest.generatedAt,
      },
      toolsByCategory: manifest.tools.categories,
      activeToolNames: manifest.tools.active.slice(0, 80).map((t) => t.name),
      channels: {
        connected: manifest.channels.connected.map((c) => c.name),
        available: manifest.channels.available.map((c) => c.name),
      },
      skills: manifest.skills.active.map((s) => s.name),
      knowledge: manifest.knowledge,
      credentials: {
        configured: manifest.credentials.configured,
        missing: manifest.credentials.missing,
      },
      platform: {
        tier: manifest.platform.tierLabel,
        slotsUsed: manifest.platform.slotsUsed,
        slotLimit: manifest.platform.slotLimit,
      },
      guidance: [
        'Report activeTools for this session, not catalogTools, unless the operator asks for full inventory.',
        'Platform pack carina-rag holds product/self-knowledge docs; workspace uploads use user-resources or custom.',
        'Only claim SaaS actions for products listed as connected for this worker.',
      ],
      ...(includePromptBlock
        ? { promptBlock: buildCapabilityPromptBlock(manifest) }
        : {}),
    };
  },
};
