/**
 * Quiet Aiva prepaid top-up packs (soft wall / billing only; not marketed).
 * Message mapping matches trial framing: £1 ≈ 20 managed messages.
 */
export type AivaPrepaidPackId = 'gbp5' | 'gbp10' | 'gbp25';

export interface AivaPrepaidPack {
  id: AivaPrepaidPackId;
  label: string;
  amountGbp: number;
  amountPence: number;
  messages: number;
  priceConfigKey: string;
}

export const AIVA_PREPAID_MESSAGES_PER_GBP = 20;

export const AIVA_PREPAID_PACKS: Record<AivaPrepaidPackId, AivaPrepaidPack> = {
  gbp5: {
    id: 'gbp5',
    label: '£5',
    amountGbp: 5,
    amountPence: 500,
    messages: 5 * AIVA_PREPAID_MESSAGES_PER_GBP,
    priceConfigKey: 'STRIPE_PRICE_AIVA_PREPAID_5',
  },
  gbp10: {
    id: 'gbp10',
    label: '£10',
    amountGbp: 10,
    amountPence: 1000,
    messages: 10 * AIVA_PREPAID_MESSAGES_PER_GBP,
    priceConfigKey: 'STRIPE_PRICE_AIVA_PREPAID_10',
  },
  gbp25: {
    id: 'gbp25',
    label: '£25',
    amountGbp: 25,
    amountPence: 2500,
    messages: 25 * AIVA_PREPAID_MESSAGES_PER_GBP,
    priceConfigKey: 'STRIPE_PRICE_AIVA_PREPAID_25',
  },
};

export const AIVA_PREPAID_PACK_IDS = Object.keys(AIVA_PREPAID_PACKS) as AivaPrepaidPackId[];

export function isAivaPrepaidPackId(value: string): value is AivaPrepaidPackId {
  return value in AIVA_PREPAID_PACKS;
}

export function listAivaPrepaidPacks(): AivaPrepaidPack[] {
  return AIVA_PREPAID_PACK_IDS.map((id) => AIVA_PREPAID_PACKS[id]);
}
