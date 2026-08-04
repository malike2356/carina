import { credentialStore } from '../credentials/credential-store.js';

export const removeCredentialTool = {
  name: 'remove_credential',
  description: `Deactivate a stored credential. The key is soft-deleted (marked inactive).
After removal, Carina falls back to process.env if available.`,
  parameters: {
    type: 'object',
    properties: {
      service: {
        type: 'string',
        description: 'Service name: "tavily", "claude", etc.',
      },
      key_name: {
        type: 'string',
        description: 'Credential key to remove: "TAVILY_API_KEY", etc.',
      },
    },
    required: ['service', 'key_name'],
  },
  async execute(params: Record<string, unknown>) {
    const { service, key_name } = params as { service: string; key_name: string };
    const removed = await credentialStore.remove(service, key_name);

    if (!removed) {
      return {
        success: false,
        error: `No active credential found for ${service}/${key_name}.`,
      };
    }

    return {
      success: true,
      service,
      key_name,
      message: `Credential ${key_name} deactivated. Falling back to process.env if set.`,
    };
  },
};
