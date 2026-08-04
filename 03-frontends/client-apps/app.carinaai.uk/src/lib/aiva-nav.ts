import type { LucideIcon } from 'lucide-react';
import {
  BarChart2,
  Bot,
  Building2,
  Calendar,
  CalendarClock,
  CheckSquare,
  CreditCard,
  FileText,
  FolderKanban,
  HandHelping,
  Inbox,
  LayoutGrid,
  LayoutDashboard,
  Library,
  LifeBuoy,
  Link2,
  Mail,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Settings,
  Shield,
  Smartphone,
  Sparkles,
  StickyNote,
  Users,
  Wrench,
} from 'lucide-react';

export type AivaNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
  accent?: boolean;
  sectionStart?: boolean;
  /** When set, item is hidden if this workspace feature is disabled. */
  feature?: import('@/lib/workspace-features').WorkspaceFeatureKey;
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
    href: '/aiva/workers',
    label: 'AI Workers',
    icon: Bot,
    match: (pathname) =>
      pathname.startsWith('/aiva/workers') || pathname.startsWith('/aiva/canvas'),
    feature: 'ai_workers',
  },
  {
    href: '/aiva/approvals',
    label: 'Approvals',
    icon: Inbox,
    match: (pathname) =>
      pathname.startsWith('/aiva/approvals')
      || pathname.startsWith('/aiva/escalations')
      || pathname.startsWith('/conversations')
      || pathname.startsWith('/aiva/browser-assists'),
    feature: 'approvals',
  },
  {
    href: '/aiva/projects',
    label: 'Projects',
    icon: FolderKanban,
    match: (pathname) => pathname.startsWith('/aiva/projects'),
    feature: 'projects',
  },
  {
    href: '/outreach',
    label: 'Outreach',
    icon: Send,
    match: (pathname) =>
      pathname.startsWith('/outreach')
      || pathname.startsWith('/aiva/outreach')
      || pathname.startsWith('/companies-house'),
    feature: 'outreach',
  },
  {
    href: '/email',
    label: 'Email',
    icon: Mail,
    sectionStart: true,
    match: (pathname) => pathname.startsWith('/email'),
    feature: 'email',
  },
  {
    href: '/calendar',
    label: 'Calendar',
    icon: Calendar,
    match: (pathname) =>
      pathname.startsWith('/calendar')
      || pathname.startsWith('/tasks')
      || pathname.startsWith('/scheduled'),
    feature: 'calendar',
  },
  {
    href: '/vical',
    label: 'Bookings',
    icon: CalendarClock,
    match: (pathname) => pathname.startsWith('/vical'),
    feature: 'calendar',
  },
  {
    href: '/notes',
    label: 'Notes',
    icon: StickyNote,
    match: (pathname) => pathname.startsWith('/notes'),
    feature: 'calendar',
  },
  {
    href: '/documents',
    label: 'Documents',
    icon: FileText,
    match: (pathname) =>
      pathname.startsWith('/documents')
      || pathname.startsWith('/workspace-ops')
      || pathname.startsWith('/files'),
    feature: 'document_vault',
  },
  {
    href: '/contacts',
    label: 'Contacts',
    icon: Users,
    match: (pathname) =>
      pathname.startsWith('/contacts')
      || pathname.startsWith('/settings/contacts'),
    feature: 'contacts',
  },
  {
    href: '/research',
    label: 'Research',
    icon: Search,
    match: (pathname) => pathname.startsWith('/research'),
    feature: 'ai_agent_tools',
  },
  {
    href: '/analytics',
    label: 'Analytics',
    icon: BarChart2,
    sectionStart: true,
    match: (pathname) => pathname.startsWith('/analytics'),
    feature: 'activity_analytics',
  },
  {
    href: '/aiva/tools',
    label: 'Tools',
    icon: Wrench,
    match: (pathname) => pathname.startsWith('/aiva/tools'),
    feature: 'ai_agent_tools',
  },
  {
    href: '/aiva/more',
    label: 'More',
    icon: MoreHorizontal,
    match: (pathname) =>
      pathname.startsWith('/aiva/more')
      || pathname.startsWith('/aiva/lab')
      || pathname.startsWith('/aiva/roles')
      || pathname.startsWith('/aiva/org')
      || pathname.startsWith('/aiva/marketplace')
      || pathname.startsWith('/aiva/human-assist')
      || pathname.startsWith('/aiva/outreach')
      || pathname.startsWith('/aiva/youtube-channel')
      || pathname.startsWith('/aiva/property-channel')
      || pathname.startsWith('/settings/channel-shield')
      || pathname.startsWith('/settings/governance')
      || pathname.startsWith('/settings/pairing')
      || pathname.startsWith('/settings/branding')
      || pathname.startsWith('/settings/privacy')
      || pathname.startsWith('/billing')
      || pathname.startsWith('/developer/usage')
      || pathname.startsWith('/channels')
      || pathname.startsWith('/settings/channels'),
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: Settings,
    sectionStart: true,
    match: (pathname) =>
      pathname.startsWith('/settings')
      && !pathname.startsWith('/settings/channels')
      && !pathname.startsWith('/settings/channel-shield')
      && !pathname.startsWith('/settings/governance')
      && !pathname.startsWith('/settings/pairing')
      && !pathname.startsWith('/settings/branding')
      && !pathname.startsWith('/settings/privacy')
      && !pathname.startsWith('/settings/contacts'),
  },
];

export const AIVA_HOME_ACTION: AivaNavItem = {
  href: '/aiva',
  label: 'Home',
  icon: LayoutDashboard,
  accent: true,
  match: (pathname) => pathname === '/aiva' || pathname === '/aiva/',
};

/** Secondary action for onboarding / adding another worker; not the sidebar primary CTA. */
export const AIVA_HIRE_ACTION: AivaNavItem = {
  href: '/aiva/hire',
  label: 'Hire AI Worker',
  icon: Plus,
  match: (pathname) =>
    pathname.startsWith('/aiva/hire') || pathname.startsWith('/aiva/provision'),
};

/** Flat directory for /aiva/more. Every href is reachable in at most 2 sidebar hops. */
export const AIVA_MORE_DIRECTORY: AivaDirectoryGroup[] = [
  {
    title: 'Daily work',
    items: [
      {
        href: '/aiva/hire',
        label: 'Hire AI Worker',
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
        label: 'AI Workers',
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
        href: '/vical',
        label: 'Bookings (viCal)',
        description: 'Public booking links, event types, and availability.',
        icon: CalendarClock,
      },
      {
        href: '/notes',
        label: 'Notes',
        description: 'Workspace notes, tasks, and chat reminders (also on Calendar as Local only).',
        icon: StickyNote,
      },
      {
        href: '/tasks',
        label: 'Calendar schedules',
        description: 'Recurring workspace activity managed alongside your calendar.',
        icon: CheckSquare,
      },
      {
        href: '/research',
        label: 'Research',
        description: 'Deep multi-round web search and synthesis.',
        icon: Search,
      },
      {
        href: '/aiva/outreach/companies-house',
        label: 'Companies House',
        description: 'UK register search for outreach leads (also under Outreach tabs).',
        icon: Building2,
      },
      {
        href: '/email',
        label: 'Email',
        description: 'Your mailbox: read, send, and triage mail.',
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
        label: 'Approvals',
        description: 'Approve drafts before your Aivas send email, messaging, or social replies.',
        icon: Inbox,
      },
      {
        href: '/aiva/outreach',
        label: 'Outreach Program',
        description: 'Leads, campaigns, Soft Wall sequences, and YouTube content channel.',
        icon: Send,
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
        href: '/contacts',
        label: 'Contacts',
        description: 'Browse, edit, and resync Google or CSV contacts for your Aivas.',
        icon: Users,
      },
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
        href: '/aiva/help',
        label: 'Help and Ask Carina',
        description: 'Guides plus Carina, your in-app product support assistant.',
        icon: LifeBuoy,
      },
      {
        href: '/billing/aiva',
        label: 'Billing',
        description: 'Plan, invoices, and top-ups.',
        icon: CreditCard,
      },
      {
        href: '/analytics',
        label: 'Analytics',
        description: 'Business metrics, Aiva activity, meetings, schedules, content, and usage.',
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
  {
    title: 'Workspace lab',
    items: [
      {
        href: '/aiva/lab/playground',
        label: 'Lab Playground',
        description: 'Model, system prompt, temperature, thinking, and tool toggles.',
        icon: Sparkles,
      },
      {
        href: '/aiva/lab',
        label: 'Lab overview',
        description: 'Hub for playground, sessions, skills, models, and runtime config.',
        icon: LayoutDashboard,
      },
      {
        href: '/dashboard',
        label: 'Workspace dashboard',
        description: 'Overview cards, activity, and state.',
        icon: LayoutGrid,
      },
      {
        href: '/sessions',
        label: 'Session browser',
        description: 'Review recent conversation threads.',
        icon: Inbox,
      },
      {
        href: '/skills',
        label: 'Skills studio',
        description: 'Browse and author learning artifacts.',
        icon: Library,
      },
      {
        href: '/models',
        label: 'Models console',
        description: 'Inspect providers and available models.',
        icon: Bot,
      },
      {
        href: '/config',
        label: 'Runtime config',
        description: 'Check active flags and host settings.',
        icon: Settings,
      },
    ],
  },
];

export function filterAivaNavByFeatures(
  items: AivaNavItem[],
  enabledByKey: Partial<Record<import('@/lib/workspace-features').WorkspaceFeatureKey, boolean>>,
): AivaNavItem[] {
  return items.filter((item) => {
    if (!item.feature) return true;
    return enabledByKey[item.feature] !== false;
  });
}
