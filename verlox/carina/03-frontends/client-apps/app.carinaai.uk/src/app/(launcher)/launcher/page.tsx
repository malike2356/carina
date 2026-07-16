import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { loadLauncherData } from '@/lib/launcher-data';
import { LauncherPageContent } from '@/components/launcher/LauncherPageContent';

export const dynamic = 'force-dynamic';

export default async function LauncherPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const data = await loadLauncherData(
    session.user.id,
    session.user.name ?? session.user.email ?? 'there',
    session.user.email ?? '',
  );

  return <LauncherPageContent {...data} />;
}
