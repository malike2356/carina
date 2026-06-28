import { ProfileBuilder } from '@/components/profiles/ProfileBuilder';

interface Props {
  searchParams: Promise<{ template?: string }>;
}

export default async function NewProfilePage({ searchParams }: Props) {
  const { template } = await searchParams;
  return <ProfileBuilder mode="create" initialTemplateId={template} />;
}
