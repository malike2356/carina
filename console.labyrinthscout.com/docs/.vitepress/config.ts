import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Labyrinth Scout',
  description: 'Security control plane for AI agents. Self-hosted or hosted by VERLOX.',
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/getting-started' },
      { text: 'Integrations', link: '/integration/carina' },
      { text: 'API', link: '/api/events' },
      { text: 'SDK', link: '/sdk/node' },
      { text: 'Pricing', link: '/pricing' },
    ],
    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'Overview', link: '/' },
          { text: 'Getting Started', link: '/getting-started' },
          { text: 'Configuration', link: '/configuration' },
          { text: 'Dashboard', link: '/dashboard' },
          { text: 'Pricing', link: '/pricing' },
        ],
      },
      {
        text: 'Integrations',
        items: [
          { text: 'Carina', link: '/integration/carina' },
          { text: 'OpenClaw', link: '/integration/openclaw' },
          { text: 'Hermes', link: '/integration/hermes' },
          { text: 'Custom agents', link: '/integration/custom-agent' },
          { text: 'Docker', link: '/integration/docker' },
        ],
      },
      {
        text: 'Security',
        items: [
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
    socialLinks: [
      { icon: 'github', link: 'https://github.com/verlox/carina' },
    ],
    footer: {
      message: 'MIT Licensed. Built by VERLOX Ltd.',
      copyright: 'Copyright 2026 VERLOX Ltd',
    },
  },
});
