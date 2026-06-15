import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  userSidebar: [
    {
      type: 'category',
      label: 'Getting started',
      collapsed: false,
      items: [
        'user/intro',
        'user/capability-inventory',
        'user/getting-started',
        'user/configuration',
        'user/self-hosting',
        'user/carina-cloud',
        'user/memory-backends',
        'user/toolsets',
        'user/credentials',
        'user/open-source-pricing',
        'user/pricing',
        'user/enterprise',
        'user/contributing',
      ],
    },
    {
      type: 'category',
      label: 'Tools',
      items: [
        'user/tools/overview',
        'user/tools/web-search',
        'user/tools/file',
        'user/tools/shell',
        'user/tools/http',
        'user/tools/email',
        'user/tools/code',
      ],
    },
    {
      type: 'category',
      label: 'Skill packs',
      items: [
        'user/skill-packs/overview',
        'user/hub',
        'user/skill-packs/property-uk',
        'user/skill-packs/creating-packs',
      ],
    },
    {
      type: 'category',
      label: 'Gateways',
      items: [
        'user/gateways/cli',
        'user/gateways/telegram',
        'user/gateways/whatsapp',
        'user/gateways/web',
      ],
    },
    {
      type: 'category',
      label: 'Security',
      items: [
        'user/security/defence-in-depth',
        'user/security/labyrinth-scout',
        'user/security/incident-response',
        'user/security/incident-drill',
        'user/security/trust-wallet-rotation',
      ],
    },
    {
      type: 'category',
      label: 'Carina Ops',
      items: [
        'user/carina-ops/index',
        'user/carina-ops/getting-started',
        'user/carina-ops/byok',
        'user/carina-ops/audit-and-exports',
        'user/carina-ops/plans',
        'user/carina-ops/pricing-metering',
      ],
    },
    {
      type: 'category',
      label: 'Integrations',
      items: ['user/integrations/propreneur-dogfood'],
    },
  ],

  developerSidebar: [
    'developer/manifesto',
    'developer/platform-architecture',
    'developer/stable-api',
    'developer/rfc-process',
    'developer/intro',
    {
      type: 'category',
      label: 'Architecture',
      items: [
        'developer/architecture/overview',
        'developer/architecture/memory',
      ],
    },
    {
      type: 'category',
      label: 'CLI',
      items: [
        'developer/cli/overview',
        'developer/cli/commands',
      ],
    },
    {
      type: 'category',
      label: 'Gateway',
      items: ['developer/gateway/channels'],
    },
    {
      type: 'category',
      label: 'Tools',
      items: [
        'developer/tools/registry',
        'developer/tools/toolsets',
      ],
    },
    {
      type: 'category',
      label: 'Skills',
      items: [
        'developer/first-domain-pack',
        'developer/university-program',
        'developer/partner-program',
        'developer/skills/packs',
        'developer/publishing-a-pack',
        'developer/selling-a-pack',
      ],
    },
    {
      type: 'category',
      label: 'Security',
      items: ['developer/security/scout'],
    },
    {
      type: 'category',
      label: 'API',
      items: ['developer/api/rest'],
    },
  ],
};

export default sidebars;
