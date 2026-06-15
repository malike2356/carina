import { defineConfig } from 'vitepress';

const docsBase = process.env.VP_BASE || '/';

export default defineConfig({
  base: docsBase,
  cleanUrls: true,
  title: 'Labyrinth Scout Docs',
  description: 'Documentation for Labyrinth Scout: prompt guard, kill switch, governance, API, and SDKs.',
  head: [
    ['meta', { name: 'theme-color', content: '#0a0e1a' }],
    [
      'link',
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
      },
    ],
  ],
  themeConfig: {
    logo: '/scout-mark.svg',
    siteTitle: 'Scout Docs',
    appearance: 'dark',
    nav: [
      { text: 'Guide', link: '/getting-started', activeMatch: '/getting-started|/configuration|/dashboard' },
      { text: 'Integrations', link: '/integration/carina', activeMatch: '/integration/' },
      { text: 'Security', link: '/security/threat-model', activeMatch: '/security/' },
      { text: 'Trust', link: '/trust/platform', activeMatch: '/trust/' },
      { text: 'API', link: '/api/events', activeMatch: '/api/' },
      { text: 'SDK', link: '/sdk/node', activeMatch: '/sdk/' },
      { text: 'labyrinthscout.com', link: 'https://labyrinthscout.com', target: '_blank', rel: 'noopener noreferrer' },
    ],
    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'Overview', link: '/' },
          { text: 'Getting started', link: '/getting-started' },
          { text: 'Configuration', link: '/configuration' },
          { text: 'Dashboard', link: '/dashboard' },
          { text: 'Troubleshooting', link: '/troubleshooting' },
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
          { text: 'Least privilege defaults', link: '/trust/least-privilege-defaults' },
          { text: 'Type 3 runbook', link: '/trust/type3-runbook' },
          { text: 'Public trust API', link: '/api/public-trust' },
        ],
      },
      {
        text: 'Security',
        items: [
          { text: 'Threat model', link: '/security/threat-model' },
          { text: 'Prompt guard', link: '/security/prompt-guard' },
          { text: 'Tool policy', link: '/security/tool-policy' },
          { text: 'Egress filter', link: '/security/egress-filter' },
          { text: 'Honeypots', link: '/security/honeypots' },
          { text: 'Anomaly detection', link: '/security/anomaly-detection' },
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
    docFooter: {
      prev: 'Previous',
      next: 'Next',
    },
  },
});
