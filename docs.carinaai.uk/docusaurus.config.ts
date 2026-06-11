import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

/** Set CARINA_DOCS_MARKETING=1 when building for carinaai.uk/docs embed */
const marketingEmbed = process.env.CARINA_DOCS_MARKETING === '1';
const docPath = (slug: string) => (marketingEmbed ? `/${slug}` : `/docs/${slug}`);

const config: Config = {
  title: 'Carina Docs',
  tagline: 'Autonomous AI agent platform. User guides and developer reference.',
  favicon: 'img/favicon.ico',

  url: marketingEmbed ? 'https://carinaai.uk' : 'https://docs.carinaai.uk',
  baseUrl: marketingEmbed ? '/docs/' : '/',

  organizationName: 'verlox',
  projectName: 'carina-docs',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: marketingEmbed ? '/' : 'docs',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/carina-social-card.jpg',
    navbar: {
      title: 'Carina',
      logo: {
        alt: 'Carina',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'userSidebar',
          position: 'left',
          label: 'User Guide',
        },
        {
          type: 'docSidebar',
          sidebarId: 'developerSidebar',
          position: 'left',
          label: 'Developer Guide',
        },
        {
          href: 'https://carinaai.uk',
          label: 'carinaai.uk',
          position: 'right',
        },
        {
          href: 'https://app.carinaai.uk',
          label: 'Carina Cloud',
          position: 'right',
        },
        {
          href: 'https://github.com/verlox/carina',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'User',
          items: [
            {label: 'Getting started', to: docPath('user/getting-started')},
            {label: 'Skill packs', to: docPath('user/skill-packs/overview')},
            {label: 'Carina Cloud', to: docPath('user/carina-cloud')},
            {label: 'Configuration', to: docPath('user/configuration')},
          ],
        },
        {
          title: 'Developer',
          items: [
            {label: 'Overview', to: docPath('developer/intro')},
            {label: 'Architecture', to: docPath('developer/architecture/overview')},
            {label: 'CLI commands', to: docPath('developer/cli/commands')},
          ],
        },
        {
          title: 'VERLOX',
          items: [
            {label: 'Carina marketing', href: 'https://carinaai.uk'},
            {label: 'Labyrinth Scout', href: 'https://labyrinthscout.com'},
            {label: 'MIT License', href: 'https://github.com/verlox/carina/blob/main/LICENSE'},
          ],
        },
      ],
      copyright: `Copyright ${new Date().getFullYear()} VERLOX Ltd. MIT Licensed.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json', 'yaml'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
