'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function PlanCard({
  name,
  price,
  description,
  active,
  onUpgrade,
}: {
  name: string;
  price: string;
  description: string;
  active?: boolean;
  onUpgrade?: () => void;
}) {
  return (
    <Card className={cn('flex h-full flex-col', active && 'border-accent ring-1 ring-accent/40')}>
      <CardHeader className="pb-4">
        <CardTitle>{name}</CardTitle>
        <p className="text-2xl font-semibold tracking-tight">{price}</p>
      </CardHeader>
      <CardContent className="mt-auto space-y-4">
        <p className="text-sm text-text-secondary">{description}</p>
        {active ? (
          <p className="text-sm font-medium text-text-primary">Current plan</p>
        ) : (
          <Button onClick={onUpgrade} className="w-full">Upgrade</Button>
        )}
      </CardContent>
    </Card>
  );
}
