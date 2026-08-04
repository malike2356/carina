import type { ProductSurface } from '@/lib/product-surface';

export function isAgentOsGlassEnabled(surface: ProductSurface): boolean {
  const configured = process.env.NEXT_PUBLIC_AGENT_OS_GLASS?.trim().toLowerCase();
  if (configured === 'true') return true;
  if (configured === 'false') return false;
  return surface === 'aiva';
}
