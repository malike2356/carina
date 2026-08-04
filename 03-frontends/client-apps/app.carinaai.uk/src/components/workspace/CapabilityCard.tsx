import Link from 'next/link';
import {
  Calendar,
  FileText,
  Globe,
  Link2,
  Brain,
  Settings,
  Shield,
  Table,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ICONS: Record<string, LucideIcon> = {
  'web-search': Globe,
  files: FileText,
  spreadsheets: Table,
  calendar: Calendar,
  integrations: Link2,
  memory: Brain,
  scout: Shield,
  settings: Settings,
};

type CapabilityCardProps = {
  id: string;
  title: string;
  description: string;
  href: string;
  className?: string;
};

export function CapabilityCard({ id, title, description, href, className }: CapabilityCardProps) {
  const Icon = ICONS[id] ?? Settings;

  return (
    <Link
      href={href}
      className={cn(
        'block rounded-lg border border-border bg-surface p-4 transition-colors hover:bg-elevated',
        className,
      )}
    >
      <Icon className="mb-2 h-5 w-5 text-accent" aria-hidden />
      <p className="text-sm font-medium text-text-primary">{title}</p>
      <p className="mt-1 text-xs text-text-muted">{description}</p>
    </Link>
  );
}
