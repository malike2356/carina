import type { ReactNode } from 'react';
import { LegalGate } from '@/components/legal/LegalGate';

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return <LegalGate>{children}</LegalGate>;
}
