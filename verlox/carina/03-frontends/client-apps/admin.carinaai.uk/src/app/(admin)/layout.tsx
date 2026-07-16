import { redirect } from 'next/navigation';
import { AdminProviders } from '@/components/AdminProviders';
import { OpsBusinessChrome } from '@/components/OpsBusinessChrome';
import { getAdminSession, isValidAdminSession } from '@/lib/admin-session';
import { OPS_BUSINESS_SHELL_PREFIX } from '@/lib/admin-base-path';
import { isOpsEmbedded, resolveAdminSession } from '@/lib/ops-proxy-auth';

const OPS_LOGIN_URL = (process.env.OPS_CONSOLE_URL ?? 'https://ops.carinaai.uk').replace(/\/$/, '');

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const embedded = await isOpsEmbedded();
  const session = embedded ? await resolveAdminSession() : await getAdminSession();
  if (!session || (!embedded && !isValidAdminSession(session))) {
    redirect(`${OPS_LOGIN_URL}/login?callbackUrl=${OPS_BUSINESS_SHELL_PREFIX}/customers`);
  }

  if (embedded) {
    return (
      <div className="min-h-screen bg-base px-6 py-6 text-text-primary">
        <OpsBusinessChrome />
        <AdminProviders>{children}</AdminProviders>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base px-6 py-6 text-text-primary">
      <AdminProviders>{children}</AdminProviders>
    </div>
  );
}
