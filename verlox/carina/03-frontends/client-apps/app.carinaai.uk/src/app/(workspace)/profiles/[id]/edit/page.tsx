import { redirect } from 'next/navigation';
import { ProfileBuilder } from '@/components/profiles/ProfileBuilder';
import { getWorkspaceProfile } from '@/lib/workspace-profiles';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditProfilePage({ params }: Props) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect('/login');

  const workspace = await requireWorkspace(session.user.id);
  const profile = await getWorkspaceProfile(workspace.id, id);
  if (!profile) redirect('/profiles');
  if (profile.isBuiltin) redirect('/profiles');

  return (
    <ProfileBuilder
      mode="edit"
      profileId={profile.id}
      initialValues={{
        name: profile.name,
        slug: profile.slug,
        description: profile.description ?? '',
        systemPrompt: profile.systemPrompt ?? '',
        provider: profile.provider ?? '',
        model: profile.model ?? '',
      }}
    />
  );
}
