'use client';

import { Globe, Hash, Mail, MessageCircle, MessageSquare, Phone, Send, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const CHANNEL_ICONS: Record<string, LucideIcon> = {
  whatsapp: MessageCircle,
  email: Mail,
  slack: Hash,
  telegram: Send,
  web: Globe,
  sms: Phone,
  voice: Phone,
  discord: MessageSquare,
  teams: Users,
};

export function ChannelIcon({
  channel,
  className,
}: {
  channel: string;
  className?: string;
}) {
  const Icon = CHANNEL_ICONS[channel.toLowerCase()] ?? Globe;
  return <Icon className={className} aria-hidden />;
}

export function ChannelIcons({ channels }: { channels: string[] }) {
  if (channels.length === 0) return null;
  return (
    <div className="flex items-center gap-1">
      {channels.map((ch) => (
        <ChannelIcon key={ch} channel={ch} className="h-3.5 w-3.5 text-text-muted" />
      ))}
    </div>
  );
}
