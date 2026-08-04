import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { AgentOsGlassClient } from '@/components/agent-os/AgentOsGlassClient';
import { isAgentOsGlassEnabled } from '@/lib/agent-os-flags';
import { getProductSurface } from '@/lib/product-surface';

export default async function AgentOsPage() {
  const headerList = await headers();
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host') ?? '';
  const surface = getProductSurface(host);
  if (!isAgentOsGlassEnabled(surface)) {
    redirect('/launcher');
  }
  return <AgentOsGlassClient />;
}
