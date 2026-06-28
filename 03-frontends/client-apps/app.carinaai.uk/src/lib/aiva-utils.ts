import { formatRelativeTime } from '@/lib/relative-time';

export const AIVA_INPUT_CLASS =
  'w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-border-focus';

export function timeAgo(date: Date | string | null | undefined): string {
  return formatRelativeTime(date ?? null);
}

export function formatTimestamp(date: Date | string): string {
  return new Date(date).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function maskIdentifier(id: string, channel: string): string {
  if (!id) return '-';
  const ch = channel.toLowerCase();
  if (ch === 'email' && id.includes('@')) {
    const [local, domain] = id.split('@');
    const visible = local.slice(0, 2);
    return `${visible}***@${domain}`;
  }
  if (ch === 'whatsapp' || ch === 'sms' || /^\+?\d{7,}$/.test(id.replace(/\s/g, ''))) {
    const digits = id.replace(/\D/g, '');
    if (digits.length >= 6) {
      const start = digits.slice(0, 3);
      const end = digits.slice(-3);
      return `+${digits.startsWith('44') ? '44 ' : ''}${start.slice(0, 2)}** *** ${end}`;
    }
  }
  return id;
}

export async function readAivaError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}
