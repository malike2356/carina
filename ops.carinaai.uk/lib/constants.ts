export const TOOL_NAMES = [
  'web-search',
  'file-read',
  'file-write',
  'shell-exec',
  'http',
  'email-send',
  'email-list',
  'code-exec',
  'property-data',
  'land-registry',
] as const;

export const PROJECT_TYPES = ['BTL', 'HMO', 'BRR', 'Flip', 'Other'] as const;
export const PROJECT_STATUSES = ['active', 'paused', 'complete'] as const;

export const VERLOX_QUICK_ACTIONS = [
  {
    label: 'Analyse BTL deal',
    message:
      'Analyse this BTL deal for me. Cover purchase price, refurb costs, rental income, gross and net yield, cash-on-cash return, and whether the numbers stack for a buy-to-let hold.',
  },
  {
    label: 'Check HMO compliance',
    message:
      'Run an HMO compliance checklist for a UK property. Cover licensing, room sizes, fire safety, amenities, and local authority requirements.',
  },
  {
    label: 'Yield calculator',
    message:
      'Help me calculate property yield. I will provide purchase price, monthly rent, and costs. Show gross yield, net yield, and ROI.',
  },
  {
    label: 'Research area',
    message:
      'Score this UK area for property investment. Cover demand, rental yields, price growth, transport, employment, and risks.',
  },
  {
    label: 'Draft investor update',
    message:
      'Draft a professional investor update email for my property portfolio. Ask me for performance highlights and any actions needed.',
  },
] as const;
