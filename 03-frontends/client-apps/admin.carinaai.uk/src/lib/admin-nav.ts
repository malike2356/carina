import {
  Building2,
  Headphones,
  PackageCheck,
  Server,
  Shield,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface AdminNavItem {
  href: string;
  label: string;
  Icon: LucideIcon;
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: '/customers', label: 'Customers', Icon: Users },
  { href: '/partners', label: 'Partners', Icon: Building2 },
  { href: '/marketplace', label: 'Marketplace', Icon: PackageCheck },
  { href: '/fleet', label: 'Fleet', Icon: Server },
  { href: '/va-queue', label: 'VA Queue', Icon: Headphones },
  { href: '/revenue', label: 'Revenue', Icon: TrendingUp },
  { href: '/audit-log', label: 'Audit Log', Icon: Shield },
];
