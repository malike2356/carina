import { config } from '../../../../config/index.js';
import type { Tool } from '../../../../types/index.js';

export const landRegistryTool: Tool = {
  name: 'land-registry-search',
  description:
    'Search UK Land Registry title information by property address or title number (stub; requires API key).',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Address or title number' },
      searchType: {
        type: 'string',
        enum: ['address', 'title'],
        description: 'Search by address or title number',
      },
    },
    required: ['query', 'searchType'],
  },
  execute: async (params) => {
    const apiKey = config.landRegistry.apiKey;
    if (!apiKey) {
      return {
        error:
          'LAND_REGISTRY_API_KEY not set. Configure Business Gateway credentials in .env.',
        hint:
          'Use https://www.gov.uk/guidance/hm-land-registry-business-gateway for official access.',
      };
    }

    const query = String(params.query ?? '');
    const searchType = String(params.searchType ?? 'address');
    return {
      status: 'stub',
      message: `Land Registry lookup (${searchType}) for "${query}" would call Business Gateway API.`,
    };
  },
};
