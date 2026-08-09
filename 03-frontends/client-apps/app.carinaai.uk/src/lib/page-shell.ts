/** Full-width workspace page shell (Google AI Studio style: fill after sidebar). */
export const PAGE_SHELL_MAX = 'max-w-none';
export const PAGE_SHELL = 'w-full min-w-0 max-w-none';
/** Padded content region inside a workspace page. */
export const WORKSPACE_PAGE = 'w-full min-w-0 max-w-none px-4 py-6 sm:px-6 lg:px-8';
/** Centered content pages (home, lists, boards). Not immersive chat. */
export const CONTENT_PAGE = 'mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8';
export const CONTENT_PAGE_WIDE = 'mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8';

/** Sidebar routes that fill the main column (same treatment as CRM + outreach). */
export const WORKSPACE_FULL_BLEED_PREFIXES = [
  '/email',
  '/calendar',
  '/vical',
  '/notes',
  '/documents',
  '/contacts',
  '/research',
  '/analytics',
  '/aiva/tools',
  '/aiva/more',
  '/settings',
  '/aiva/outreach',
] as const;

export function isWorkspaceFullBleedPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return WORKSPACE_FULL_BLEED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
