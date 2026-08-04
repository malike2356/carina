const DEFAULT_ADMIN_BASE_PATH = '/business-inner';

function normalizeBasePath(value: string | undefined): string {
  if (!value || value === '/') return '';
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  return withLeadingSlash.replace(/\/+$/, '');
}

export const ADMIN_BASE_PATH = normalizeBasePath(
  process.env.NEXT_PUBLIC_ADMIN_BASE_PATH
    ?? process.env.ADMIN_BASE_PATH
    ?? DEFAULT_ADMIN_BASE_PATH,
);

export const OPS_BUSINESS_SHELL_PREFIX = normalizeBasePath(
  process.env.NEXT_PUBLIC_OPS_BUSINESS_SHELL_PREFIX
    ?? process.env.OPS_BUSINESS_SHELL_PREFIX
    ?? ADMIN_BASE_PATH,
);

export function withAdminBasePath(path: string): string {
  if (!path || path === '/') return ADMIN_BASE_PATH || '/';
  if (/^(?:[a-z][a-z\d+.-]*:)?\/\//i.test(path)) return path;

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (
    ADMIN_BASE_PATH
    && (
      normalizedPath === ADMIN_BASE_PATH
      || normalizedPath.startsWith(`${ADMIN_BASE_PATH}/`)
      || normalizedPath.startsWith(`${ADMIN_BASE_PATH}?`)
      || normalizedPath.startsWith(`${ADMIN_BASE_PATH}#`)
    )
  ) {
    return normalizedPath;
  }

  return `${ADMIN_BASE_PATH}${normalizedPath}`;
}

export function adminFetch(input: string, init?: RequestInit): Promise<Response> {
  return fetch(withAdminBasePath(input), init);
}
