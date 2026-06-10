import { defineConfig } from 'vitepress';

const docsBase = process.env.VP_BASE || '/';

export default defineConfig({
  base: docsBase,
  cleanUrls: true,
  title: 'Carina',
  description: 'Autonomous AI agent with skill packs. Free. MIT licensed.',
  themeConfig: {
    logo: '/logo.svg',
    nav: [
      { text: 'Guide', link: '/getting-started' },
      { text: 'Carina Cloud', link: '/carina-cloud' },
      { text: 'Tools', link: '/tools/overview' },
      { text: 'Skill Packs', link: '/skill-packs/overview' },
      { text: 'Gateways', link: '/gateways/cli' },
      { text: 'Security', link: '/security/defence-in-depth' },
      { text: 'Pricing', link: '/open-source-pricing' },
    ],
    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'What is Carina?', link: '/index' },
          { text: 'Install', link: '/getting-started' },
          { text: 'Configuration', link: '/configuration' },
          { text: 'Self-hosting', link: '/self-hosting' },
          { text: 'Carina Cloud (SaaS)', link: '/carina-cloud' },
        ],
      },
      {
        text: 'Tools',
        items: [
          { text: 'Overview', link: '/tools/overview' },
          { text: 'Web Search', link: '/tools/web-search' },
          { text: 'File', link: '/tools/file' },
          { text: 'Shell', link: '/tools/shell' },
          { text: 'HTTP', link: '/tools/http' },
          { text: 'Email', link: '/tools/email' },
          { text: 'Code Execution', link: '/tools/code' },
        ],
      },
      {
        text: 'Skill Packs',
        items: [
          { text: 'Overview', link: '/skill-packs/overview' },
          { text: 'property-uk', link: '/skill-packs/property-uk' },
          { text: 'Creating Packs', link: '/skill-packs/creating-packs' },
        ],
      },
      {
        text: 'Gateways',
        items: [
          { text: 'CLI', link: '/gateways/cli' },
          { text: 'Telegram', link: '/gateways/telegram' },
          { text: 'WhatsApp', link: '/gateways/whatsapp' },
          { text: 'Web UI', link: '/gateways/web' },
        ],
      },
      {
        text: 'Security',
        items: [
          { text: 'Defence in depth', link: '/security/defence-in-depth' },
          { text: 'Labyrinth Scout', link: '/security/labyrinth-scout' },
        ],
      },
      {
        text: 'Pricing',
        items: [
          { text: 'Source release vs Scout', link: '/open-source-pricing' },
        ],
      },
    ],
    footer: {
      message: 'MIT Licensed. Built by VERLOX Ltd.',
      copyright: 'Copyright 2026 VERLOX Ltd',
    },
  },
});
