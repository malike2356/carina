import type { Tool } from '#core/types/index.js';
import {
  isLandRegistryConfigured,
  runLandRegistrySearch,
} from './land-registry-client.js';

export const LAND_REGISTRY_TOOL_ENABLED = true;

export const landRegistryTool: Tool = {
  name: 'land-registry-search',
  description:
    'Look up UK Land Registry title data by title number, postcode (freehold titles), or full address. Uses PropertyData.co.uk (requires LAND_REGISTRY_API_KEY or PROPERTY_DATA_API_KEY).',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Title number, UK postcode, or full address with postcode' },
      searchType: {
        type: 'string',
        enum: ['address', 'title', 'postcode'],
        description: 'Search by title number, postcode freehold list, or address',
      },
    },
    required: ['query', 'searchType'],
  },
  execute: async (params) => {
    if (!isLandRegistryConfigured()) {
      return {
        error:
          'LAND_REGISTRY_API_KEY or PROPERTY_DATA_API_KEY not set. Add a PropertyData.co.uk API key to enable Land Registry lookups.',
        docs: 'https://propertydata.co.uk/api/documentation/title',
      };
    }

    const query = String(params.query ?? '').trim();
    const rawType = String(params.searchType ?? 'address').toLowerCase();
    const searchType = rawType === 'title' || rawType === 'postcode' ? rawType : 'address';

    try {
      return await runLandRegistrySearch(query, searchType);
    } catch (err) {
      return {
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
        query,
        searchType,
      };
    }
  },
};
