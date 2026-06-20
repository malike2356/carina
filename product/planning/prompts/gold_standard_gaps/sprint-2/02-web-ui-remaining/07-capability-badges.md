# Prompt 07: Tier-Gated Capability Badges

## Context

Features in the Carina UI that require a higher subscription tier should communicate
the tier requirement clearly, consistently, and without frustration. The pattern:
features are visible but show a badge explaining what tier unlocks them. Clicking
the badge takes the user to the billing page pre-scrolled to the required tier.

This replaces the current pattern of features silently failing or returning 403 errors.

## What to Build

### 1. Tier definition

In `apps/cloud/src/lib/tiers.ts`:
```typescript
export type Tier = 'free' | 'cloud' | 'monitor' | 'govern' | 'enterprise';

export const TIER_ORDER: Tier[] = ['free', 'cloud', 'monitor', 'govern', 'enterprise'];

export const TIER_LABELS: Record<Tier, string> = {
  free: 'Free',
  cloud: 'Cloud',
  monitor: 'Scout Monitor',
  govern: 'Scout Govern',
  enterprise: 'Enterprise',
};

export function tierAtLeast(userTier: Tier, required: Tier): boolean {
  return TIER_ORDER.indexOf(userTier) >= TIER_ORDER.indexOf(required);
}
```

### 2. CapabilityBadge component

In `apps/cloud/src/components/CapabilityBadge.tsx`:
```tsx
type Props = {
  requiredTier: Tier;
  children: React.ReactNode;
  className?: string;
};

export function CapabilityBadge({ requiredTier, children, className }: Props) {
  const { tier: userTier } = useCurrentUser();

  if (tierAtLeast(userTier, requiredTier)) {
    return <>{children}</>;
  }

  return (
    <div className={`relative ${className}`}>
      <div className="opacity-40 pointer-events-none select-none">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center">
        <TierUpgradeChip requiredTier={requiredTier} />
      </div>
    </div>
  );
}

function TierUpgradeChip({ requiredTier }: { requiredTier: Tier }) {
  return (
    <a
      href={`/billing?highlight=${requiredTier}`}
      className="bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-medium px-2 py-1 rounded-full hover:bg-green-500/20 transition-colors"
    >
      {TIER_LABELS[requiredTier]} feature
    </a>
  );
}
```

### 3. Apply to gated features

Wrap these features with `<CapabilityBadge>`:

| Feature | Required Tier |
|---------|--------------|
| Wake word / continuous listening | monitor |
| Natural voice TTS (ElevenLabs) | monitor |
| Phone calls to/from Carina | govern |
| Forensics pipeline tools | monitor |
| Red team automation tools | monitor |
| SOC2 evidence generation | govern |
| On-premise STT/TTS | enterprise |
| Custom voice persona | govern |
| Distro CLI | cloud |
| Custom skill publish | cloud |

### 4. Plan gate on billing page

In `apps/cloud/src/pages/BillingPage.tsx`, when `?highlight=monitor` is present in the URL,
scroll to the Monitor plan card and pulse-animate it briefly. This makes the upsell flow feel
seamless: user sees badge, clicks it, lands on billing page with the right plan highlighted.

## Verification Checklist

- [ ] Free tier user sees wake word section dimmed with "Scout Monitor feature" chip
- [ ] Clicking chip navigates to /billing?highlight=monitor
- [ ] Billing page scrolls to and highlights Monitor plan card
- [ ] Monitor tier user sees wake word section fully enabled (no badge)
- [ ] No badge shows for features the user's tier already covers

## Files to Create or Modify

- CREATE `apps/cloud/src/lib/tiers.ts`
- CREATE `apps/cloud/src/components/CapabilityBadge.tsx`
- MODIFY `apps/cloud/src/pages/BillingPage.tsx` - handle highlight param
- MODIFY `apps/cloud/src/pages/SettingsPage.tsx` - wrap voice settings with badges
- MODIFY `apps/cloud/src/pages/ScoutPage.tsx` - wrap govern features with badges
