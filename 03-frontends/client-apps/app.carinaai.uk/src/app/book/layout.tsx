import type { ReactNode } from 'react';

export default function BookPublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-surface text-text-primary">
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 py-8 sm:px-6">
        {children}
      </div>
    </div>
  );
}
