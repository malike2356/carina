const EMAIL_INTENT_RE =
  /\b(e-?mails?|gmail|inbox|sent mail|mailbox|mailboxes|mailing list|mail thread|mail threads)\b/i;
const CALENDAR_INTENT_RE =
  /\b(calendar|calender|meeting|meetings|schedule|scheduling|appointment|appointments|diary|availability|free busy)\b/i;
const DRIVE_INTENT_RE =
  /\b(google\s+drive|drive\s+file|drive\s+folder|drive\s+docs?|docs?|documents?|document\s+vault|file\s+browser|files?)\b/i;
const CONTACTS_INTENT_RE =
  /\b(contacts?|phone number|phone numbers|address book|contact list)\b/i;
const WORKSPACE_DOCUMENT_INTENT_RE =
  /\b(workspace\s+documents?|documents?\s+page|document\s+vault|vault docs?|research vault|library)\b/i;
const COMPANIES_HOUSE_INTENT_RE =
  /\b(companies?\s*house|uk\s+company\s+register|company\s+number|find\s+uk\s+compan|search\s+officers?|persons?\s+with\s+significant\s+control|\bpscs?\b)\b/i;

export type AivaEmptyReplyBucket =
  | 'gmail'
  | 'calendar'
  | 'drive'
  | 'contacts'
  | 'workspace-documents'
  | 'companies-house'
  | 'generic';

export function resolveAivaEmptyReplyBucket(userMessage?: string): AivaEmptyReplyBucket {
  const ask = String(userMessage ?? '').trim();
  if (!ask) return 'generic';
  if (EMAIL_INTENT_RE.test(ask)) return 'gmail';
  if (CALENDAR_INTENT_RE.test(ask)) return 'calendar';
  if (DRIVE_INTENT_RE.test(ask)) return 'drive';
  if (CONTACTS_INTENT_RE.test(ask)) return 'contacts';
  if (WORKSPACE_DOCUMENT_INTENT_RE.test(ask)) return 'workspace-documents';
  if (COMPANIES_HOUSE_INTENT_RE.test(ask)) return 'companies-house';
  return 'generic';
}

function toolsPath(toolSlug: string): string {
  return `/aiva/tools?tool=${encodeURIComponent(toolSlug)}`;
}

export function aivaEmptyReplyFallback(userMessage?: string): string {
  switch (resolveAivaEmptyReplyBucket(userMessage)) {
    case 'gmail':
      return [
        'I could not finish that email search this turn.',
        `Open Tools, choose Gmail, and reconnect if the grant shows needs_reauth: ${toolsPath('gmail')}.`,
        'Then ask again.',
      ].join(' ');
    case 'calendar':
      return [
        'I could not finish that calendar lookup this turn.',
        `Open Tools, choose Google Calendar, and reconnect if needed: ${toolsPath('google-calendar')}.`,
        'Then ask again.',
      ].join(' ');
    case 'drive':
      return [
        'I could not finish that Drive lookup this turn.',
        `Open Tools, choose Google Drive / Docs, and reconnect if needed: ${toolsPath('google-drive')}.`,
        'Then ask again.',
      ].join(' ');
    case 'contacts':
      return [
        'I could not finish that contacts lookup this turn.',
        `Open Tools, choose Google Contacts: ${toolsPath('google-contacts')}.`,
        'Then ask again.',
      ].join(' ');
    case 'workspace-documents':
      return [
        'I could not finish that document lookup this turn.',
        'Open the Documents page in the workspace, then ask again.',
      ].join(' ');
    case 'companies-house':
      return [
        'I could not finish that Companies House lookup this turn.',
        `Open Tools, choose Companies House, and grant or reconnect if needed: ${toolsPath('companies-house')}.`,
        'Ops must set COMPANIES_HOUSE_API_KEY for the platform key path. Then ask again.',
      ].join(' ');
    case 'generic':
    default:
      return [
        'I hit a blank reply that turn; there was nothing usable after tool status.',
        'Please try once more.',
        'If this needs a connected tool, open Tools and reconnect it first.',
      ].join(' ');
  }
}
