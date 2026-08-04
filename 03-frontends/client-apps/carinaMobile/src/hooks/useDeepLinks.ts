import * as Linking from 'expo-linking';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';

const TAB_PATHS = {
  home: '/(tabs)/home',
  chat: '/(tabs)/chat',
  employees: '/(tabs)/employees',
  inbox: '/(tabs)/inbox',
  tasks: '/(tabs)/tasks',
  trust: '/(tabs)/trust',
  more: '/(tabs)/more',
} as const;

type TabPathKey = keyof typeof TAB_PATHS;

const STACK_PATHS = {
  instance: '/instance',
  usage: '/usage',
  memory: '/memory',
  packs: '/packs',
  hire: '/hire',
  governance: '/governance',
} as const;

type StackPathKey = keyof typeof STACK_PATHS;

function isTabPathKey(path: string): path is TabPathKey {
  return path in TAB_PATHS;
}

function isStackPathKey(path: string): path is StackPathKey {
  return path in STACK_PATHS;
}

function routeFromUrl(url: string): void {
  const parsed = Linking.parse(url);
  const host = parsed.hostname ?? '';
  const rest = (parsed.path ?? '').replace(/^\//, '');
  // `carina://inbox/escalations` parses as hostname=inbox, path=escalations
  const path = rest ? (host && !rest.startsWith(`${host}/`) ? `${host}/${rest}` : rest) : host;

  if (isStackPathKey(path)) {
    router.push(STACK_PATHS[path] as Href);
    return;
  }

  if (path === 'pair' || path.startsWith('pair/')) {
    const tokenFromQuery = parsed.queryParams?.token;
    if (typeof tokenFromQuery === 'string') {
      router.push({ pathname: '/pair-scan', params: { token: tokenFromQuery } });
      return;
    }
    router.push('/pair-scan');
    return;
  }

  if (path === 'login' || path.startsWith('login/')) {
    const tokenFromQuery = parsed.queryParams?.token;
    if (typeof tokenFromQuery === 'string') {
      router.push(
        `/login-scan?token=${encodeURIComponent(tokenFromQuery)}` as Href,
      );
      return;
    }
    router.push('/login-scan' as Href);
    return;
  }

  if (path === 'login' || path.startsWith('login/')) {
    const tokenFromQuery = parsed.queryParams?.token;
    if (typeof tokenFromQuery === 'string') {
      router.push(
        `/(auth)/login-scan?token=${encodeURIComponent(tokenFromQuery)}` as Href,
      );
      return;
    }
    router.push('/(auth)/login-scan' as Href);
    return;
  }

  if (path === 'paired-devices') {
    router.push('/paired-devices');
    return;
  }

  if (path.startsWith('conversation/')) {
    const id = path.slice('conversation/'.length).split('/')[0];
    if (id) {
      router.push(`/conversation/${encodeURIComponent(id)}` as Href);
      return;
    }
  }

  if (path.startsWith('employee/')) {
    const rest = path.slice('employee/'.length);
    const [id, child] = rest.split('/');
    if (id && (child === 'channels' || child === 'automations' || child === 'training')) {
      router.push(`/employee/${encodeURIComponent(id)}/${child}` as Href);
      return;
    }
    if (id) {
      router.push(`/employee/${encodeURIComponent(id)}?tab=chat` as Href);
      return;
    }
  }

  if (path.startsWith('approval/')) {
    const rest = path.slice('approval/'.length);
    const [kind, id] = rest.split('/');
    if ((kind === 'email' || kind === 'social') && id) {
      router.push(`/approval/${kind}/${encodeURIComponent(id)}` as Href);
      return;
    }
  }

  if (isTabPathKey(path) || path.startsWith('inbox')) {
    if (path === 'inbox' || path.startsWith('inbox/')) {
      const segment =
        path === 'inbox'
          ? typeof parsed.queryParams?.segment === 'string'
            ? parsed.queryParams.segment
            : undefined
          : path.slice('inbox/'.length).split('/')[0];
      if (
        segment === 'approvals' ||
        segment === 'conversations' ||
        segment === 'escalations'
      ) {
        router.push(`/(tabs)/inbox/${segment}` as Href);
        return;
      }
      router.push('/(tabs)/inbox' as Href);
      return;
    }
    const tab = TAB_PATHS[path as TabPathKey];
    const sessionId = parsed.queryParams?.sessionId;
    if (typeof sessionId === 'string' && path === 'chat') {
      router.push({ pathname: '/(tabs)/chat', params: { sessionId } });
      return;
    }
    if (typeof sessionId === 'string' && path === 'tasks') {
      router.push({ pathname: '/(tabs)/chat', params: { sessionId } });
      return;
    }
    router.push(tab as Href);
  }
}

export function useDeepLinks(): void {
  useEffect(() => {
    void Linking.getInitialURL().then((url) => {
      if (url) routeFromUrl(url);
    });

    const sub = Linking.addEventListener('url', (event) => {
      routeFromUrl(event.url);
    });

    return () => sub.remove();
  }, []);
}
