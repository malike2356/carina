import * as Linking from 'expo-linking';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';

const TAB_PATHS = {
  chat: '/(tabs)/chat',
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
  const path = parsed.path?.replace(/^\//, '') ?? host;

  if (isStackPathKey(path)) {
    router.push(STACK_PATHS[path]);
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

  if (isTabPathKey(path)) {
    const tab = TAB_PATHS[path];
    const sessionId = parsed.queryParams?.sessionId;
    if (typeof sessionId === 'string' && path === 'chat') {
      router.push({ pathname: '/(tabs)/chat', params: { sessionId } });
      return;
    }
    if (typeof sessionId === 'string' && path === 'tasks') {
      router.push({ pathname: '/(tabs)/chat', params: { sessionId } });
      return;
    }
    router.push(tab);
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
