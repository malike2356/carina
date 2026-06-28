'use client';

import { createAuthClient } from 'better-auth/react';
import { resolveAuthClientBaseUrl } from './auth-client-origin';

export { resolveAuthClientBaseUrl } from './auth-client-origin';

export const authClient = createAuthClient({
  baseURL: resolveAuthClientBaseUrl(),
});
