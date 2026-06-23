import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect } from 'react';

const TAB_PATHS: Record<string, string> = {
  chat: '/(tabs)/chat',
  tasks: '/(tabs)/tasks',
  trust: '/(tabs)/trust',
  more: '/(tabs)/more',
};

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

  const tab = TAB_PATHS[path];
  if (tab) {
    const sessionId = parsed.queryParams?.sessionId;
    if (typeof sessionId === 'string' && path === 'chat') {
      router.push({ pathname: tab, params: { sessionId } });
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
