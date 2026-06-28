import { credentialStore } from '../credentials/credential-store.js';

export const listCredentialsTool = {
  name: 'list_credentials',
  description: `List all stored credentials (values are masked). Shows what services are configured.`,
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
  async execute(_params: Record<string, unknown>) {
    const creds = await credentialStore.list();

    if (creds.length === 0) {
      return {
        credentials: [],
        count: 0,
        message: 'No credentials stored yet. Use configure_credential to add one, or check process.env for manual config.',
      };
    }

    return {
      credentials: creds.map((c) => ({
        service: c.service,
        key_name: c.key_name,
        active: c.is_active,
        stored_at: c.created_at,
      })),
      count: creds.length,
    };
  },
};
