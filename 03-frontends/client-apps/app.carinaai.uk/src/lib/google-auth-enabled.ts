export function isGoogleAuthEnabled(): boolean {
  const id =
    process.env.GOOGLE_CLIENT_ID?.trim()
    || process.env.GOOGLE_OAUTH_CLIENT_ID?.trim()
    || '';
  const secret =
    process.env.GOOGLE_CLIENT_SECRET?.trim()
    || process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim()
    || '';
  return Boolean(id && secret);
}
