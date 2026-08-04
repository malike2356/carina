import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

/** Set CARINA_DOCS_MARKETING=1 when building for carinaai.uk/docs embed */
const marketingEmbed = process.env.CARINA_DOCS_MARKETING === '1';
const docsBrandTitle = process.env.CARINA_DOCS_BRAND_TITLE?.trim() || 'Carina Docs';
const docPath = (slug: string) => (marketingEmbed ? `/${slug}` : `/docs/${slug}`);

const config: Config = {
  title: docsBrandTitle,
  tagline: 'One Memory. One Agent. Everywhere. User guides and developer reference.',
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

  stylesheets: [
    {
      href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
      type: 'text/css',
    },
  ],

  customFields: {
    marketingEmbed,
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
        src: 'img/carina-logo.png',
      },
      hideOnScroll: false,
      items: [
        {
          type: 'doc',
          docId: 'user/capability-inventory',
          position: 'left',
          label: 'Capabilities',
        },
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
            {label: 'Capability inventory', to: docPath('capabilities')},
            {label: 'Getting started', to: docPath('user/getting-started')},
            {label: 'Skill packs', to: docPath('user/skill-packs/overview')},
            {label: 'Carina Cloud', to: docPath('user/carina-cloud')},
            {label: 'White-label guide', to: docPath('user/white-label/getting-started')},
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
          title: 'Support',
          items: [
            {label: 'Troubleshooting', to: docPath('user/troubleshooting')},
            {label: 'GitHub Issues', href: 'https://github.com/malike2356/carina-mutant/issues'},
            {label: 'Email support', href: 'mailto:support@carinaai.uk'},
          ],
        },
        {
          title: 'VERLOX',
          items: [
            {label: 'Keprix', href: 'https://github.com/malike2356/keprix'},
            {label: 'Carina marketing', href: 'https://carinaai.uk'},
            {label: 'Aiva', href: 'https://hireaiva.co.uk'},
            {label: 'Labyrinth Scout', href: 'https://labyrinthscout.com'},
            {label: 'Propreneur', href: 'https://propreneur.uk'},
            {label: 'TuinApp', href: 'https://tuinapp.uk'},
            {label: 'PropCalc', href: 'https://propcalc.uk'},
            {label: 'MIT License', href: 'https://github.com/verlox/carina/blob/main/LICENSE'},
          ],
        },
      ],
      copyright: `Copyright ${new Date().getFullYear()} VERLOX Ltd. MIT Licensed.`,
    },
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: false,
      respectPrefersColorScheme: false,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json', 'yaml'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
