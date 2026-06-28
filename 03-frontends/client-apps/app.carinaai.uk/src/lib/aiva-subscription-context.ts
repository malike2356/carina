import type { ProductSurface } from '@/lib/product-surface';

function isAivaBillingRoute(pathname: string): boolean {
  return pathname.startsWith('/aiva') || pathname.startsWith('/billing/aiva');
}

/** True when the UI should load Aiva subscription/billing status (Aiva product routes only). */
export function shouldLoadAivaSubscription(
  pathname: string | null | undefined,
  surface: ProductSurface,
): boolean {
  if (!pathname) return false;
  if (isAivaBillingRoute(pathname)) return true;
  if (surface === 'aiva' && pathname.startsWith('/onboarding')) return true;
  return false;
}
