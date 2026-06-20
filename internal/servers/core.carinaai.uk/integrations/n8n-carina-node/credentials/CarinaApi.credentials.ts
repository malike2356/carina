import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class CarinaApi implements ICredentialType {
  name = 'carinaApi';
  displayName = 'Carina API';
  documentationUrl = 'https://docs.carinaai.uk/developer/api';
  properties: INodeProperties[] = [
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: 'https://app.carinaai.uk',
      placeholder: 'https://app.carinaai.uk',
      description:
        'URL where Carina is running. Production default is https://app.carinaai.uk. Use http://localhost:3333 only for local dev.',
    },
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      description: 'CARINA_OPS_TOKEN or CARINA_WEB_PASSWORD from your Carina .env file.',
    },
    {
      displayName: 'Timeout (seconds)',
      name: 'timeout',
      type: 'number',
      default: 120,
      description: 'Max seconds to wait for Carina to finish. Increase for long-running tasks.',
    },
  ];
}
