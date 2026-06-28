/** Same-origin auth for app.carinaai.uk and the Aiva host (admin.hireaiva.co.uk). */
export function resolveAuthClientBaseUrl(): string | undefined {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return undefined;
}
