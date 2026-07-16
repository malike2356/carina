import type { LucideIcon } from 'lucide-react';
import {
  BarChart2,
  Bot,
  Building2,
  Calendar,
  CheckSquare,
  CreditCard,
  FileText,
  FolderKanban,
  HandHelping,
  Inbox,
  LayoutGrid,
  Library,
  Link2,
  Mail,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Shield,
  Smartphone,
  Wrench,
} from 'lucide-react';

export type AivaNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
  accent?: boolean;
};

export type AivaDirectoryLink = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

export type AivaDirectoryGroup = {
  title: string;
  /** Discovery depth from sidebar: 1 = in primary nav, 2 = one hop via More/Settings. Never exceed 3. */
  items: AivaDirectoryLink[];
};

/**
 * Quiet primary shell. Rich capabilities live in hubs (/aiva/more, /aiva/roles),
 * not as deleted features or a flat dump of every item in the sidebar.
 */
export const AIVA_PRIMARY_NAV: AivaNavItem[] = [
  {
    href: '/aiva',
    label: 'Hire',
    icon: Plus,
    accent: true,
    match: (pathname) => pathname === '/aiva',
  },
  {
    href: '/aiva/workers',
    label: 'Workers',
    icon: Bot,
    match: (pathname) =>
      pathname.startsWith('/aiva/workers') || pathname.startsWith('/aiva/canvas'),
  },
  {
    href: '/documents',
    label: 'Documents',
    icon: FileText,
    match: (pathname) =>
      pathname.startsWith('/documents')
      || pathname.startsWith('/workspace-ops')
      || pathname.startsWith('/files'),
  },
  {
    href: '/calendar',
    label: 'Calendar',
    icon: Calendar,
    match: (pathname) => pathname.startsWith('/calendar'),
  },
  {
    href: '/tasks',
    label: 'Tasks',
    icon: CheckSquare,
    match: (pathname) =>
      pathname.startsWith('/tasks') || pathname.startsWith('/scheduled'),
  },
  {
    href: '/research',
    label: 'Research',
    icon: Search,
    match: (pathname) => pathname.startsWith('/research'),
  },
  {
    href: '/email',
    label: 'Email',
    icon: Mail,
    match: (pathname) => pathname.startsWith('/email'),
  },
  {
    href: '/aiva/projects',
    label: 'Projects',
    icon: FolderKanban,
    match: (pathname) => pathname.startsWith('/aiva/projects'),
  },
  {
    href: '/aiva/tools',
    label: 'Tools',
    icon: Wrench,
    match: (pathname) =>
      pathname.startsWith('/aiva/tools')
      || pathname.startsWith('/settings/channels')
      || (pathname.startsWith('/channels') && !pathname.startsWith('/settings')),
  },
  {
    href: '/aiva/approvals',
    label: 'Inbox',
    icon: Inbox,
    match: (pathname) =>
      pathname.startsWith('/aiva/approvals')
      || pathname.startsWith('/aiva/escalations')
      || pathname.startsWith('/conversations')
      || pathname.startsWith('/aiva/browser-assists'),
  },
  {
    href: '/aiva/more',
    label: 'More',
    icon: MoreHorizontal,
    match: (pathname) =>
      pathname.startsWith('/aiva/more')
      || pathname.startsWith('/aiva/roles')
      || pathname.startsWith('/aiva/org')
      || pathname.startsWith('/aiva/marketplace')
      || pathname.startsWith('/aiva/human-assist')
      || pathname.startsWith('/settings/channel-shield')
      || pathname.startsWith('/settings/governance')
      || pathname.startsWith('/settings/pairing')
      || pathname.startsWith('/settings/branding')
      || pathname.startsWith('/settings/privacy')
      || pathname.startsWith('/billing')
      || pathname.startsWith('/developer/usage')
      || pathname.startsWith('/channels'),
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: Settings,
    match: (pathname) =>
      pathname.startsWith('/settings')
      && !pathname.startsWith('/settings/channels')
      && !pathname.startsWith('/settings/channel-shield')
      && !pathname.startsWith('/settings/governance')
      && !pathname.startsWith('/settings/pairing')
      && !pathname.startsWith('/settings/branding')
      && !pathname.startsWith('/settings/privacy'),
  },
];

/** Flat directory for /aiva/more. Every href is reachable in at most 2 sidebar hops. */
export const AIVA_MORE_DIRECTORY: AivaDirectoryGroup[] = [
  {
    title: 'Daily work',
    items: [
      {
        href: '/aiva',
        label: 'Hire',
        description: 'Quick hire with popular roles.',
        icon: Plus,
      },
      {
        href: '/aiva/roles',
        label: 'Role library',
        description: 'Full persona catalog, grouped by work type.',
        icon: Library,
      },
      {
        href: '/aiva/workers',
        label: 'Workers',
        description: 'Manage your AI team and view the org canvas.',
        icon: Bot,
      },
      {
        href: '/documents',
        label: 'Documents',
        description: 'Editor, Drive sync, and uploaded files in one place.',
        icon: FileText,
      },
      {
        href: '/calendar',
        label: 'Calendar',
        description: 'Month, week, and agenda views with Google Calendar sync.',
        icon: Calendar,
      },
      {
        href: '/tasks',
        label: 'Tasks',
        description: 'Automated tasks with schedule and event triggers.',
        icon: CheckSquare,
      },
      {
        href: '/research',
        label: 'Research',
        description: 'Deep multi-round web search and synthesis.',
        icon: Search,
      },
      {
        href: '/email',
        label: 'Email',
        description: 'Inbound email triage, urgency filtering, and AI draft replies.',
        icon: Mail,
      },
      {
        href: '/aiva/projects',
        label: 'Projects',
        description: 'Group work into projects.',
        icon: FolderKanban,
      },
      {
        href: '/aiva/approvals',
        label: 'Inbox',
        description: 'Approvals and escalations waiting on you.',
        icon: Inbox,
      },
    ],
  },
  {
    title: 'Connect and protect',
    items: [
      {
        href: '/aiva/tools',
        label: 'Tools',
        description: 'Google Drive, Calendar, and other product tools.',
        icon: Wrench,
      },
      {
        href: '/channels',
        label: 'Channels',
        description: 'WhatsApp, Email, Slack, Telegram, and more.',
        icon: Link2,
      },
      {
        href: '/settings/channel-shield',
        label: 'Channel Shield',
        description: 'Inbound protection and quarantine.',
        icon: Shield,
      },
      {
        href: '/settings/pairing',
        label: 'Device pairing',
        description: 'Link a phone or tablet with a QR code.',
        icon: Smartphone,
      },
    ],
  },
  {
    title: 'Workspace',
    items: [
      {
        href: '/aiva/marketplace',
        label: 'Marketplace provision',
        description: 'One-click provision paths for storefront templates.',
        icon: LayoutGrid,
      },
      {
        href: '/aiva/org',
        label: 'Organization',
        description: 'Active org, members, and invites.',
        icon: Building2,
      },
      {
        href: '/aiva/human-assist',
        label: 'Human assist',
        description: 'Request optional human help when Aiva needs it.',
        icon: HandHelping,
      },
      {
        href: '/billing/aiva',
        label: 'Billing',
        description: 'Plan, invoices, and top-ups.',
        icon: CreditCard,
      },
      {
        href: '/developer/usage',
        label: 'Usage',
        description: 'AI token usage, event volume, and estimated costs.',
        icon: BarChart2,
      },
      {
        href: '/settings?section=account',
        label: 'Account settings',
        description: 'Profile, password, and language.',
        icon: Settings,
      },
      {
        href: '/settings/branding',
        label: 'Widget branding',
        description: 'Logo and colors for the Business widget.',
        icon: LayoutGrid,
      },
      {
        href: '/settings/privacy',
        label: 'Privacy',
        description: 'Export, cookies, and account deletion.',
        icon: Shield,
      },
      {
        href: '/settings/governance',
        label: 'Scout rules',
        description: 'Governance thresholds for your Aivas.',
        icon: Shield,
      },
    ],
  },
];
