import { credentialStore } from '../credentials/credential-store.js';
import { isEncryptionAvailable } from '../credentials/encryption.js';

export const configureCredentialTool = {
  name: 'configure_credential',
  description: `Store an API key or credential. Carina uses this to self-configure when a user provides a key.
Use this when the user says "here's my X API key" or "add this credential."
The value is encrypted at rest. After storing, the associated tool becomes available immediately.`,
  parameters: {
    type: 'object',
    properties: {
      service: {
        type: 'string',
        description: 'Service name: "tavily", "claude", "stripe", "openai", "notion", etc.',
      },
      key_name: {
        type: 'string',
        description: 'Environment variable name: "TAVILY_API_KEY", "ANTHROPIC_API_KEY", etc.',
      },
      value: {
        type: 'string',
        description: 'The API key or credential value to store.',
      },
    },
    required: ['service', 'key_name', 'value'],
  },
  async execute(params: Record<string, unknown>) {
    const { service, key_name, value } = params as { service: string; key_name: string; value: string };

    if (!isEncryptionAvailable()) {
      return {
        success: false,
        error: 'Credential encryption is not available. Set CREDENTIAL_ENCRYPTION_KEY in .env first.',
        hint: 'Generate one: openssl rand -hex 32',
      };
    }

    const stored = await credentialStore.set(service, key_name, value);
    if (!stored) {
      return { success: false, error: 'Failed to store credential. Check encryption key and database.' };
    }

    return {
      success: true,
      service,
      key_name,
      message: `Credential ${key_name} for ${service} stored and encrypted. It is now available for use.`,
    };
  },
};
