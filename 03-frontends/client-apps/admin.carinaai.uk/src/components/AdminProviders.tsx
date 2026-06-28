'use client';

import { ToastProvider } from '@/components/ui/Toast';

export function AdminProviders({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
