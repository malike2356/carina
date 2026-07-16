/**
 * Rewrite custom-scheme deep links before Expo Router file matching.
 * Without this, `carina://inbox/escalations` becomes an unmatched route.
 */
export function redirectSystemPath({
  path,
  initial,
}: {
  path: string;
  initial: boolean;
}): string {
  void initial;
  try {
    const url = path.includes('://') ? path : `carina://${path.replace(/^\//, '')}`;
    const parsed = new URL(url);
    const host = parsed.hostname || '';
    const rest = parsed.pathname.replace(/^\//, '');
    const combined = rest ? (host ? `${host}/${rest}` : rest) : host;

    if (!combined) return path;

    if (combined === 'inbox' || combined.startsWith('inbox/')) {
      const segment =
        combined === 'inbox'
          ? undefined
          : combined.slice('inbox/'.length).split('/')[0];
      if (
        segment === 'approvals' ||
        segment === 'conversations' ||
        segment === 'escalations'
      ) {
        return `/(tabs)/inbox?segment=${segment}`;
      }
      return '/(tabs)/inbox';
    }

    if (combined === 'governance') return '/governance';
    if (combined === 'usage') return '/usage';
    if (combined === 'memory') return '/memory';
    if (combined === 'packs') return '/packs';
    if (combined === 'hire') return '/hire';

    if (combined.startsWith('employee/')) {
      const parts = combined.split('/');
      const id = parts[1];
      const child = parts[2];
      const employeePages = new Set([
        'chat',
        'tasks',
        'channels',
        'training',
        'automations',
        'settings',
      ]);
      if (id && child && employeePages.has(child)) {
        return `/employee/${encodeURIComponent(id)}/${child}`;
      }
      if (id) return `/employee/${encodeURIComponent(id)}`;
    }

    if (combined.startsWith('conversation/')) {
      const id = combined.split('/')[1];
      if (id) return `/conversation/${encodeURIComponent(id)}`;
    }

    if (combined.startsWith('approval/')) {
      const parts = combined.split('/');
      const kind = parts[1];
      const id = parts[2];
      if ((kind === 'email' || kind === 'social') && id) {
        return `/approval/${kind}/${encodeURIComponent(id)}`;
      }
    }

    const tabs = new Set(['home', 'chat', 'employees', 'inbox', 'tasks', 'trust', 'more']);
    if (tabs.has(combined)) {
      return `/(tabs)/${combined}${parsed.search || ''}`;
    }

    return path;
  } catch {
    return path;
  }
}
