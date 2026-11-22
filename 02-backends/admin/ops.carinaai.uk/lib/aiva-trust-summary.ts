/**
 * Aiva trust summary stub (retired 2026-11-22).
 * Real module archived at archive/carina-stripped-aiva-scout-20261122/.
 */

export type AivaTrustSummary = {
  retired: true;
  message: string;
};

export async function getAivaTrustSummary(): Promise<AivaTrustSummary> {
  return {
    retired: true,
    message: 'Aiva trust summary removed from Carina (2026-11-22). Aiva is on Hermes.',
  };
}
