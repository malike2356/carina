import { NextResponse } from 'next/server';
import { getRequestHostname } from '@/lib/server-brand';
import { resolveHostBrandContext } from '@/lib/host-resolver';

export const dynamic = 'force-dynamic';

export async function GET() {
  const hostname = await getRequestHostname();
  const context = await resolveHostBrandContext(hostname);
  return NextResponse.json({
    data: {
      hostname: context.hostname,
      isCanonical: context.isCanonical,
      isCustomDomain: context.isCustomDomain,
      isAivaProduct: context.isAivaProduct,
      productSurface: context.productSurface,
      canonicalHost: context.canonicalHost,
      workspaceId: context.workspaceId,
      brand: context.resolvedBrand,
    },
  });
}
