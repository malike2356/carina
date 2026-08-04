import { resolveCredential } from '../credentials/resolver.js';

interface TestPattern {
  url: string;
  method: string;
  headers: (value: string) => Record<string, string>;
  validStatus: number[];
}

const TEST_PATTERNS: Record<string, TestPattern> = {
  TAVILY_API_KEY: {
    url: 'https://api.tavily.com/search',
    method: 'POST',
    headers: (value) => ({ Authorization: `Bearer ${value}`, 'Content-Type': 'application/json' }),
    validStatus: [200, 400], // 400 = bad request (key accepted), 401 = invalid key
  },
  ANTHROPIC_API_KEY: {
    url: 'https://api.anthropic.com/v1/models',
    method: 'GET',
    headers: (value) => ({ 'x-api-key': value, 'anthropic-version': '2023-06-01' }),
    validStatus: [200],
  },
  OPENAI_API_KEY: {
    url: 'https://api.openai.com/v1/models',
    method: 'GET',
    headers: (value) => ({ Authorization: `Bearer ${value}` }),
    validStatus: [200],
  },
  STRIPE_SECRET_KEY: {
    url: 'https://api.stripe.com/v1/balance',
    method: 'GET',
    headers: (value) => ({ Authorization: `Bearer ${value}` }),
    validStatus: [200],
  },
  DEEPSEEK_API_KEY: {
    url: 'https://api.deepseek.com/models',
    method: 'GET',
    headers: (value) => ({ Authorization: `Bearer ${value}` }),
    validStatus: [200],
  },
};

export const testCredentialTool = {
  name: 'test_credential',
  description: `Test if a stored credential works by making a lightweight API call to the service.
Use this after configure_credential to verify the key is valid.`,
  parameters: {
    type: 'object',
    properties: {
      key_name: {
        type: 'string',
        description: 'The credential key to test: "TAVILY_API_KEY", "ANTHROPIC_API_KEY", etc.',
      },
    },
    required: ['key_name'],
  },
  async execute(params: Record<string, unknown>) {
    const { key_name } = params as { key_name: string };
    const value = await resolveCredential(key_name);

    if (!value) {
      return {
        success: false,
        key_name,
        error: `Credential ${key_name} is not configured. Use configure_credential to add it, or set it in .env.`,
      };
    }

    const pattern = TEST_PATTERNS[key_name];
    if (!pattern) {
      return {
        success: null,
        key_name,
        message: `No test endpoint defined for ${key_name}. The credential exists but cannot be auto-tested.`,
      };
    }

    try {
      const response = await fetch(pattern.url, {
        method: pattern.method,
        headers: pattern.headers(value),
        signal: AbortSignal.timeout(10000),
      });

      const isValid = pattern.validStatus.includes(response.status);

      return {
        success: isValid,
        key_name,
        status_code: response.status,
        message: isValid
          ? `Credential is valid. Service responded with status ${response.status}.`
          : `Credential was rejected (HTTP ${response.status}). The key may be invalid or expired.`,
        endpoint: pattern.url,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        key_name,
        error: `Connection test failed: ${message}`,
        hint: 'Check network connectivity and the service endpoint.',
      };
    }
  },
};
