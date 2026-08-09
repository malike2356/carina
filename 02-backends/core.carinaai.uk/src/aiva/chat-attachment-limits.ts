/** Durable file size and MIME policy for Aiva chat uploads. */

export const AIVA_CHAT_ATTACHMENT_MAX_BYTES = 100 * 1024 * 1024; // 100MB decoded
/** JSON body must fit base64 (~4/3) plus envelope. */
export const AIVA_CHAT_ATTACHMENT_JSON_LIMIT = '150mb';

export const AIVA_CHAT_ATTACHMENT_EXTENSIONS = [
  '.sav',
  '.csv',
  '.tsv',
  '.xlsx',
  '.xls',
  '.ods',
  '.txt',
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.docx',
] as const;
