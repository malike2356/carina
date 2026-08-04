'use client';

import { useProductSurfaceContext } from '@/components/shell/ProductSurfaceProvider';

export function useProductSurface() {
  return useProductSurfaceContext();
}

export function useIsAivaProduct(): boolean {
  return useProductSurface() === 'aiva';
}
