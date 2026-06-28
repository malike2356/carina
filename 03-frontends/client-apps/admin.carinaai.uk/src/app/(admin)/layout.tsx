import { redirect } from 'next/navigation';
import { AdminSidebar } from '@/components/AdminSidebar';
import { AdminSignOutButton } from '@/components/AdminSignOutButton';
import { AdminProviders } from '@/components/AdminProviders';
import { getAdminSession, isValidAdminSession } from '@/lib/admin-session';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!isValidAdminSession(session)) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-base">
      <header className="fixed top-0 right-0 left-0 z-50 flex h-10 items-center justify-between border-b border-amber-500/30 bg-amber-500/15 px-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tracking-widest text-text-primary">VERLOX</span>
          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-amber-400">
            Admin
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted">{session.email}</span>
          <AdminSignOutButton />
        </div>
      </header>

      <AdminSidebar userEmail={session.email ?? ''} />

      <main className="ml-52 mt-10 min-h-[calc(100vh-2.5rem)] flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-8 py-6">
          <AdminProviders>{children}</AdminProviders>
        </div>
      </main>
    </div>
  );
}
