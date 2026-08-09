/**
 * Delivery state helpers for calendar invitations (Prompt 704).
 * UI may show invitation_sent / delivery_failed aliases; storage uses contract enum.
 */

import type { VcalAttendeeResponseStatus, VcalDeliveryState } from '../types.js';

export function uiDeliveryLabel(state: VcalDeliveryState | undefined | null): string {
  switch (state) {
    case 'sent':
      return 'invitation_sent';
    case 'failed':
      return 'delivery_failed';
    case 'accepted':
      return 'accepted';
    case 'declined':
      return 'declined';
    case 'delivered':
      return 'delivered';
    case 'pending':
      return 'pending';
    default:
      return 'unknown';
  }
}

export function mapGoogleResponseToDelivery(
  responseStatus: string | undefined,
): { responseStatus: VcalAttendeeResponseStatus; deliveryState: VcalDeliveryState } {
  const normalized = String(responseStatus ?? 'needsAction');
  if (normalized === 'accepted') {
    return { responseStatus: 'accepted', deliveryState: 'accepted' };
  }
  if (normalized === 'declined') {
    return { responseStatus: 'declined', deliveryState: 'declined' };
  }
  if (normalized === 'tentative') {
    return { responseStatus: 'tentative', deliveryState: 'delivered' };
  }
  return { responseStatus: 'needsAction', deliveryState: 'sent' };
}

export function invitationCopyDisclaimer(): string {
  return 'Invitation sent does not guarantee the guest calendar accepted or inserted the event.';
}
