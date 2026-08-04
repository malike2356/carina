import { AivaPlanCookieSync } from '@/components/aiva/AivaPlanCookieSync';
import { AivaSuspendedGate } from '@/components/aiva/AivaSuspendedGate';
import { GracePeriodBanner } from '@/components/aiva/GracePeriodBanner';
import { TrialBanner } from '@/components/aiva/TrialBanner';

export default function AivaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AivaPlanCookieSync />
      <TrialBanner />
      <GracePeriodBanner />
      <AivaSuspendedGate>{children}</AivaSuspendedGate>
    </>
  );
}
