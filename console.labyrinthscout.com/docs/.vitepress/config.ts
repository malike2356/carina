import { defineConfig } from 'vitepress';

const docsBase = process.env.VP_BASE || '/';

export default defineConfig({
  base: docsBase,
  cleanUrls: true,
  title: 'Labyrinth Scout',
  description: 'Security control plane for AI agents. Self-hosted or hosted by VERLOX.',
  head: [
    [
      'link',
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
      },
    ],
  ],
  themeConfig: {
    siteTitle: 'Scout',
    appearance: true,
    nav: [
      { text: 'Guide', link: '/getting-started', activeMatch: '/getting-started|/configuration|/dashboard' },
      { text: 'Integrations', link: '/integration/carina', activeMatch: '/integration/' },
      { text: 'API', link: '/api/events', activeMatch: '/api/' },
      { text: 'SDK', link: '/sdk/node', activeMatch: '/sdk/' },
    ],
    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'Overview', link: '/' },
          { text: 'Getting Started', link: '/getting-started' },
          { text: 'Configuration', link: '/configuration' },
          { text: 'Dashboard', link: '/dashboard' },
          { text: 'Public Trust API', link: '/api/public-trust' },
          { text: 'Trust platform', link: '/trust/platform' },
        ],
      },
      {
        text: 'Integrations',
        items: [
          { text: 'Carina', link: '/integration/carina' },
          { text: 'Custom agents', link: '/integration/custom-agent' },
          { text: 'Docker', link: '/integration/docker' },
        ],
      },
      {
        text: 'Trust',
        items: [
          { text: 'Platform decision', link: '/trust/platform' },
          { text: 'Public trust API', link: '/api/public-trust' },
        ],
      },
      {
        text: 'Security',
        items: [
          { text: 'Threat Model', link: '/security/threat-model' },
          { text: 'Prompt Guard', link: '/security/prompt-guard' },
          { text: 'Tool Policy', link: '/security/tool-policy' },
          { text: 'Egress Filter', link: '/security/egress-filter' },
          { text: 'Honeypots', link: '/security/honeypots' },
          { text: 'Anomaly Detection', link: '/security/anomaly-detection' },
        ],
      },
      {
        text: 'API',
        items: [
          { text: 'Events', link: '/api/events' },
          { text: 'Heartbeat', link: '/api/heartbeat' },
          { text: 'Status', link: '/api/status' },
          { text: 'Kill switch', link: '/api/kill-switch' },
          { text: 'Honeypots', link: '/api/honeypots' },
          { text: 'SSE stream', link: '/api/stream' },
          { text: 'Public trust', link: '/api/public-trust' },
        ],
      },
      {
        text: 'SDK',
        items: [
          { text: 'Node.js', link: '/sdk/node' },
          { text: 'Python', link: '/sdk/python' },
        ],
      },
    ],
    footer: {
      message: 'MIT Licensed. Built by VERLOX Ltd.',
      copyright: `Copyright ${new Date().getFullYear()} VERLOX Ltd`,
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/verlox/labyrinth-scout' },
    ],
    outline: {
      level: [2, 3],
      label: 'On this page',
    },
  },
});
