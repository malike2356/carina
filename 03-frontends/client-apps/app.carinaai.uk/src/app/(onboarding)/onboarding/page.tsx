import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getWorkspaceForUser } from '@/lib/workspace';
import { OnboardingClientSimple } from './OnboardingClientSimple';

export default async function OnboardingPage() {
  const session = await getSession();
  if (session?.user) {
    const workspace = await getWorkspaceForUser(session.user.id);
    if (workspace?.onboardingCompletedAt) {
      redirect('/api/workspace/onboarding-resume');
    }
  }

  return <OnboardingClientSimple />;
}
