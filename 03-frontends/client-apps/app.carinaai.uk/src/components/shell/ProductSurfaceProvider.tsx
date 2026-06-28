'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { ProductSurface } from '@/lib/product-surface';

const ProductSurfaceContext = createContext<ProductSurface>('cloud');

export function ProductSurfaceProvider({
  children,
  surface,
}: {
  children: ReactNode;
  surface: ProductSurface;
}) {
  return (
    <ProductSurfaceContext.Provider value={surface}>{children}</ProductSurfaceContext.Provider>
  );
}

export function useProductSurfaceContext(): ProductSurface {
  return useContext(ProductSurfaceContext);
}
