'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
    <Card className={active ? 'border-accent' : undefined}>
      <CardHeader>
        <CardTitle>{name}</CardTitle>
        <p className="text-2xl font-semibold">{price}</p>
      </CardHeader>
      <CardContent className="space-y-4">
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
