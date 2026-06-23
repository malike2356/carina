'use client';

import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PricingPlan {
  name: string;
  price: string;
  yearlyPrice: string;
  period: string;
  features: string[];
  description: string;
  buttonText: string;
  href: string;
  isPopular: boolean;
}

interface PricingCardsProps {
  plans: PricingPlan[];
  title?: string;
  description?: string;
  onPlanSelect?: (plan: PricingPlan, billing: 'monthly' | 'annual') => void;
}

export function PricingCards({
  plans,
  title = 'Simple, Transparent Pricing',
  description = 'Choose the plan that works for you.',
  onPlanSelect,
}: PricingCardsProps) {
  const [isMonthly, setIsMonthly] = useState(true);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const handleToggle = () => {
    setIsMonthly((prev) => !prev);
  };

  return (
    <div className="py-8">
      <div className="mb-10 space-y-3 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">{title}</h2>
        <p className="text-text-muted">{description}</p>
      </div>

      <div className="mb-8 flex items-center justify-center gap-3">
        <span className={cn('text-sm font-medium', isMonthly ? 'text-text-primary' : 'text-text-muted')}>
          Monthly
        </span>
        <button
          ref={toggleRef}
          type="button"
          role="switch"
          aria-checked={!isMonthly}
          onClick={handleToggle}
          className={cn(
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
            isMonthly ? 'bg-border' : 'bg-accent',
          )}
        >
          <span
            className={cn(
              'pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
              isMonthly ? 'translate-x-0.5' : 'translate-x-5',
            )}
          />
        </button>
        <span className={cn('text-sm font-medium', !isMonthly ? 'text-text-primary' : 'text-text-muted')}>
          Annual{' '}
          <span className="font-semibold text-accent">(Save 20%)</span>
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {plans.map((plan, index) => (
          <motion.div
            key={plan.name}
            initial={{ y: 50, opacity: 0 }}
            animate={{ opacity: 1 }}
            whileInView={{
              y: plan.isPopular ? -16 : 0,
              opacity: 1,
              scale: index === 0 || index === 2 ? 0.96 : 1,
            }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, type: 'spring', stiffness: 120, damping: 25, delay: index * 0.1 }}
            className={cn(
              'relative flex flex-col rounded-2xl border p-6',
              plan.isPopular
                ? 'border-accent bg-elevated shadow-lg shadow-accent/10'
                : 'border-border bg-elevated',
              !plan.isPopular && index !== 1 && 'mt-4',
            )}
          >
            {plan.isPopular && (
              <div className="absolute right-0 top-0 flex items-center gap-1 rounded-bl-xl rounded-tr-2xl bg-accent px-3 py-1">
                <Star className="h-3.5 w-3.5 fill-black text-black" />
                <span className="text-xs font-semibold text-black">Popular</span>
              </div>
            )}

            <p className="text-sm font-semibold uppercase tracking-widest text-text-muted">{plan.name}</p>

            <div className="mt-5 flex items-baseline gap-1">
              <span className="text-4xl font-bold text-text-primary">
                ${isMonthly ? plan.price : plan.yearlyPrice}
              </span>
              {plan.period !== 'Next 3 months' && (
                <span className="text-sm text-text-muted">/ {plan.period}</span>
              )}
            </div>
            <p className="text-xs text-text-muted">{isMonthly ? 'billed monthly' : 'billed annually'}</p>

            <ul className="mt-6 flex flex-1 flex-col gap-2.5">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-text-secondary">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  {feature}
                </li>
              ))}
            </ul>

            <hr className="my-5 border-border" />

            <button
              type="button"
              onClick={() => onPlanSelect?.(plan, isMonthly ? 'monthly' : 'annual')}
              className={cn(
                'w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors',
                plan.isPopular
                  ? 'bg-accent text-black hover:bg-accent-hover'
                  : 'border border-border text-text-primary hover:border-accent hover:text-accent',
              )}
            >
              {plan.buttonText}
            </button>

            <p className="mt-4 text-center text-xs text-text-muted">{plan.description}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
