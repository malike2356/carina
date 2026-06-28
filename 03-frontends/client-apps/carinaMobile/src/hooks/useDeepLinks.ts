import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect } from 'react';

const TAB_PATHS = {
  chat: '/(tabs)/chat',
  tasks: '/(tabs)/tasks',
  trust: '/(tabs)/trust',
  more: '/(tabs)/more',
} as const;

type TabPathKey = keyof typeof TAB_PATHS;

function isTabPathKey(path: string): path is TabPathKey {
  return path in TAB_PATHS;
}

function routeFromUrl(url: string): void {
  const parsed = Linking.parse(url);
  const host = parsed.hostname ?? '';
  const path = parsed.path?.replace(/^\//, '') ?? host;

  if (path === 'instance') {
    router.push('/instance');
    return;
  }

  if (path === 'usage') {
    router.push('/usage');
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
