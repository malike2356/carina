'use client';

import { createAuthClient } from 'better-auth/react';
import { resolveAuthClientBaseUrl } from './auth-client-origin';

export { resolveAuthClientBaseUrl } from './auth-client-origin';

export const authClient = createAuthClient({
  baseURL: resolveAuthClientBaseUrl(),
});

export async function signOutAndRedirect(destination = '/login'): Promise<void> {
  await authClient.signOut({
    fetchOptions: {
      onSuccess: () => {
        window.location.assign(destination);
      },
    },
  });
}
