import { notFound } from 'next/navigation';
import { ChannelIntegrationDetail } from '@/components/integrations/ChannelIntegrationDetail';
import { getIntegration } from '@/lib/integration-catalog';

export default async function ChannelDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const integration = getIntegration(slug);
  if (!integration) notFound();

  return <ChannelIntegrationDetail integration={integration} />;
}
