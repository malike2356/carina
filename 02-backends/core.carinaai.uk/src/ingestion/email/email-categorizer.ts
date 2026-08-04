export type EmailCategory = 'client_query' | 'invoice' | 'spam' | 'urgent' | 'other';

export function categorizeEmail(input: {
  from: string;
  subject: string;
  body: string;
  roleTag?: string | null;
}): EmailCategory {
  const text = `${input.subject}\n${input.body}`.toLowerCase();
  const from = input.from.toLowerCase();

  if (
    /\b(unsubscribe|lottery|viagra|crypto airdrop|you have won)\b/.test(text) ||
    from.includes('noreply@mailer') && /\b(promo|sale)\b/.test(text)
  ) {
    return 'spam';
  }

  if (
    /\b(urgent|asap|immediate action|deadline today|emergency)\b/.test(text) ||
    /\b(action required|overdue)\b/.test(text)
  ) {
    return 'urgent';
  }

  if (
    /\b(invoice|receipt|payment due|vat|remittance|statement)\b/.test(text) ||
    from.includes('accounts') ||
    from.includes('billing')
  ) {
    return 'invoice';
  }

  if (
    input.roleTag === 'client' ||
    /\b(enquiry|inquiry|question|please advise|could you)\b/.test(text) ||
    (!from.includes('noreply') && !from.includes('no-reply'))
  ) {
    return 'client_query';
  }

  return 'other';
}

export function categoryLabel(category: EmailCategory): string {
  switch (category) {
    case 'client_query':
      return 'Client query';
    case 'invoice':
      return 'Invoice';
    case 'spam':
      return 'Spam';
    case 'urgent':
      return 'Urgent';
    default:
      return 'Other';
  }
}
