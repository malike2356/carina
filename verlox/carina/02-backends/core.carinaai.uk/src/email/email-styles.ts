/** Canonical GTM tagline; must appear in every lifecycle email footer (via Layout). */
export const EMAIL_TAGLINE =
  'Hire an Aiva. Powered by Carina. Governed by Scout. Optional human assist on request.';

export const emailColors = {
  ink: '#0a0a0a',
  body: '#374151',
  muted: '#6b7280',
  border: '#e5e7eb',
  bg: '#f9fafb',
  white: '#ffffff',
  teal: '#1a5f7a',
  amber: '#f5a623',
  danger: '#b91c1c',
};

export const headingStyle = {
  fontSize: '22px',
  fontWeight: '600' as const,
  color: emailColors.ink,
  margin: '0 0 12px',
  lineHeight: '1.3',
};

export const bodyStyle = {
  fontSize: '15px',
  color: emailColors.body,
  lineHeight: '1.6',
  margin: '0 0 16px',
};

export const mutedStyle = {
  fontSize: '14px',
  color: emailColors.muted,
  lineHeight: '1.55',
  margin: '0 0 16px',
};

export function primaryButtonStyle(): Record<string, string | number> {
  return {
    display: 'inline-block',
    backgroundColor: emailColors.teal,
    color: emailColors.white,
    padding: '12px 20px',
    borderRadius: '6px',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: '600',
  };
}

export function dangerButtonStyle(): Record<string, string | number> {
  return {
    ...primaryButtonStyle(),
    backgroundColor: emailColors.danger,
  };
}
