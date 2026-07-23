import { redirect } from 'next/navigation';

export default async function LegacyDashboardAgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/aiva/workers/${encodeURIComponent(id)}`);
}
