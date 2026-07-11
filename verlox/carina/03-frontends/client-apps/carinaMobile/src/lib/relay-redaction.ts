const CARD_PATTERN = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g;
const PIN_PATTERN = /\bPIN[:\s]+\d{4,6}\b/gi;
const PASSWORD_PATTERN = /\bpassword[:\s]+\S+/gi;

export function applyRelayRedaction(text: string): string {
  return text
    .replace(CARD_PATTERN, '[CARD_REDACTED]')
    .replace(PIN_PATTERN, '[PIN_REDACTED]')
    .replace(PASSWORD_PATTERN, '[PASSWORD_REDACTED]');
}

export function isWithinPrivacyHours(
  currentHour: number,
  startHour: number,
  endHour: number,
): boolean {
  if (startHour <= endHour) {
    return currentHour >= startHour && currentHour <= endHour;
  }
  return currentHour >= startHour || currentHour <= endHour;
}
