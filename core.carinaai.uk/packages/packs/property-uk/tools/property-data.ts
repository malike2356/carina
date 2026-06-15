import { config } from '#core/config/index.js';
import type { Tool } from '#core/types/index.js';

export const propertyDataTool: Tool = {
  name: 'property-data-lookup',
  description:
    'Look up property data for a UK postcode: average prices, rental yields, sold prices.',
  parameters: {
    type: 'object',
    properties: {
      postcode: { type: 'string', description: 'UK postcode' },
      dataType: {
        type: 'string',
        enum: ['prices', 'yields', 'sold'],
        description: 'Type of data to fetch',
      },
    },
    required: ['postcode', 'dataType'],
  },
  execute: async (params) => {
    const apiKey = config.propertyData.apiKey;
    if (!apiKey) {
      return {
        error:
          'PROPERTY_DATA_API_KEY not set. Add it to .env to enable property data lookups.',
      };
    }

    const postcode = String(params.postcode ?? '').trim();
    const dataType = String(params.dataType ?? 'prices');
    const url = `https://api.propertydata.co.uk/${dataType}?postcode=${encodeURIComponent(postcode)}&api_key=${apiKey}`;

    const response = await fetch(url);
    if (!response.ok) {
      return {
        error: `PropertyData API error: ${response.status} ${response.statusText}`,
      };
    }

    return response.json();
  },
};
