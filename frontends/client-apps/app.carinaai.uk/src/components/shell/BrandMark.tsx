'use client';

import Image from 'next/image';
import { useBrand } from '@/components/shell/BrandProvider';

interface BrandMarkProps {
  className?: string;
  imageClassName?: string;
  showName?: boolean;
  nameClassName?: string;
  size?: number;
}

export function BrandMark({
  className = '',
  imageClassName = 'object-contain',
  showName = true,
  nameClassName = 'text-sm font-semibold text-text-primary',
  size = 28,
}: BrandMarkProps) {
  const brand = useBrand();
  const fallbackLetter = brand.shortName.slice(0, 1).toUpperCase() || 'C';

  return (
    <span className={`inline-flex items-center gap-2 ${className}`.trim()}>
      {brand.logoUrl ? (
        <Image
          src={brand.logoUrl}
          alt={brand.productName}
          width={size}
          height={size}
          className={imageClassName}
          unoptimized
        />
      ) : (
        <span
          className="inline-flex items-center justify-center rounded-lg bg-accent-dim text-accent font-semibold"
          style={{ width: size, height: size, fontSize: Math.max(11, size * 0.42) }}
          aria-hidden="true"
        >
          {fallbackLetter}
        </span>
      )}
      {showName ? <span className={nameClassName}>{brand.productName}</span> : null}
    </span>
  );
}
