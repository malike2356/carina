import { looksLikeHtml as looksLikeHtmlInEditor } from '@/components/editor/tiptap-extensions';

const INVISIBLE_CHARS = /[\u200B-\u200D\u2060\uFEFF]/g;
const URL_RE = /https?:\/\/[^\s<>"']+/gi;
const HTML_TAG_RE = /<\/?[a-z][\w:-]*\b[^>]*>/i;

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function looksLikeHtml(value: string): boolean {
  return (
    looksLikeHtmlInEditor(value)
    || /<!doctype html/i.test(value)
    || /<br\s*\/?>/i.test(value)
    || HTML_TAG_RE.test(value)
  );
}

export function stripHtmlToText(html: string): string {
  const text = decodeEntities(
    String(html ?? '')
      .replace(/\r\n?/g, '\n')
      .replace(/<!--[\s\S]*?-->/g, '\n')
      .replace(/<(style|script|head|title|meta|noscript)[^>]*>[\s\S]*?<\/\1>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h[1-6]|li|tr|blockquote|pre)>/gi, '\n')
      .replace(/<\/(ul|ol|table)>/gi, '\n\n')
      .replace(/<li[^>]*>/gi, '- ')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
  );
  return text;
}

export function sanitizeEmailAddress(value: string): string | null {
  const input = String(value ?? '').trim();
  if (!input || looksLikeHtml(input)) return null;

  const bracketMatch = input.match(/<([^<>@\s]+@[^<>@\s]+)>/);
  if (bracketMatch) return bracketMatch[1].trim();

  const emailMatch = input.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (emailMatch) return emailMatch[0].trim();

  return null;
}

function stripTrackingUrls(text: string): string {
  return text.replace(URL_RE, '[link]');
}

function stripLegacyPrefixes(text: string): string {
  return text.replace(/^To:\s*[^\n]+\n+/i, '').trim();
}

function normalizePlainText(text: string): string {
  return decodeEntities(
    String(text ?? '')
      .replace(/\r\n?/g, '\n')
      .replace(INVISIBLE_CHARS, '')
      .trim(),
  );
}

export function emailBodyForDisplay(value: string): string {
  const input = normalizePlainText(value);
  if (!input) return '';
  const plain = looksLikeHtml(input) ? stripHtmlToText(input) : input;
  return stripLegacyPrefixes(stripTrackingUrls(plain)).trim();
}

export function emailPreviewLine(bodyPreview: string, bodyFull?: string | null): string {
  const candidate = emailBodyForDisplay(bodyPreview || bodyFull || '');
  if (!candidate) return '';
  return candidate
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !/^To:\s*/i.test(line))
    ?? '';
}
