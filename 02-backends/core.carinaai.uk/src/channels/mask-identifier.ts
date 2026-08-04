export function maskIdentifier(channel: string, contactId: string): string {
  const id = contactId.trim();
  if (!id) return 'Unknown';

  if (channel === 'email' && id.includes('@')) {
    const [local, domain] = id.split('@');
    const prefix = local.slice(0, Math.min(3, local.length));
    return `${prefix}***@${domain}`;
  }

  if (channel === 'whatsapp' || channel === 'sms') {
    const digits = id.replace(/\D/g, '');
    const tail = digits.slice(-4) || id.slice(-4);
    return `****-****-${tail}`;
  }

  if (channel === 'web') {
    return `Visitor-${id.slice(-6)}`;
  }

  if (channel === 'instagram') {
    return `@user-${id.slice(-4)}`;
  }

  if (id.length <= 4) return '****';
  return `${id.slice(0, 2)}***${id.slice(-2)}`;
}
