'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function PlanCard({
  name,
  priceAmount,
  pricePeriod,
  description,
  active,
  onUpgrade,
  compact = false,
}: {
  name: string;
  priceAmount: string;
  pricePeriod?: string;
  description: string;
  active?: boolean;
  onUpgrade?: () => void;
  compact?: boolean;
}) {
  return (
    <Card className={cn('flex h-full flex-col', active && 'border-accent ring-1 ring-accent/40')}>
      <CardHeader className={cn(compact ? 'gap-1 p-4 pb-2' : 'pb-4')}>
        <CardTitle className={compact ? 'text-base' : undefined}>{name}</CardTitle>
        <div className={cn('font-semibold leading-tight', compact ? 'text-lg' : 'text-2xl')}>
          <span className="whitespace-nowrap">{priceAmount}</span>
          {pricePeriod ? (
            <span
              className={cn(
                'text-text-muted',
                compact ? 'ml-1.5 text-sm font-normal' : 'ml-2 text-base font-normal',
              )}
            >
              {pricePeriod}
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className={cn('mt-auto space-y-3', compact && 'px-4 pb-4 pt-0')}>
        <p className={cn('text-text-secondary', compact ? 'text-xs leading-relaxed' : 'text-sm')}>
          {description}
        </p>
        {active ? (
          <p className={cn('font-medium text-text-primary', compact ? 'text-xs' : 'text-sm')}>
            Current plan
          </p>
        ) : (
          <Button onClick={onUpgrade} className="w-full" size={compact ? 'sm' : 'default'}>
            Upgrade
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
