import * as XLSX from 'xlsx';
import {
  DOCUMENT_VAULT_CONVERTER_VERSION,
  getFormatCapability,
  loadFormatCapabilityMatrix,
} from './format-capabilities.js';
import { buildDeterministicPdf, htmlOrMarkdownToPlain } from './format-pdf.js';
import { assertSafeUploadBytes, sanitizeHtmlFragment, stripRtfToText } from './format-safety.js';
import type { VaultItemKind } from './kinds.js';
import { kindFromFormatOrExtension } from './kinds.js';
import { sha256Hex } from './model.js';

export type ConversionWarning = {
  code: string;
  message: string;
  fidelity: string;
};

export type ConversionResult = {
  ok: true;
  formatId: string;
  vaultKind: VaultItemKind;
  mimeType: string;
  extension: string;
  content: Buffer;
  textPreview: string;
  warnings: ConversionWarning[];
  converterVersion: string;
  sourceChecksum: string;
  generated: boolean;
};

export type ConversionFailure = {
  ok: false;
  error: string;
  code: 'blocked' | 'unsupported' | 'corrupt' | 'limit' | 'validation';
};

export type ConversionOutcome = ConversionResult | ConversionFailure;

function textBytes(value: string): Buffer {
  return Buffer.from(value, 'utf8');
}

function withinTextLimit(text: string): boolean {
  return text.length <= loadFormatCapabilityMatrix().limits.maxTextChars;
}

async function extractDocxText(bytes: Buffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer: bytes });
  return String(result.value ?? '');
}

async function extractPdfText(bytes: Buffer): Promise<string> {
  const pdfParse = (await import('pdf-parse')).default;
  const parsed = await pdfParse(bytes);
  return String(parsed.text ?? '');
}

function spreadsheetToCanonicalCsv(bytes: Buffer, extension: string): {
  csv: string;
  warnings: ConversionWarning[];
} {
  const matrix = loadFormatCapabilityMatrix();
  const workbook = XLSX.read(bytes, { type: 'buffer', dense: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('Spreadsheet has no worksheets');
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], {
    defval: null,
    raw: false,
  });
  if (rows.length > matrix.limits.maxSpreadsheetRows) {
    throw Object.assign(new Error('Spreadsheet row limit exceeded'), { code: 'limit' as const });
  }
  const headers = rows.length ? Object.keys(rows[0]!) : [];
  if (headers.length > matrix.limits.maxSpreadsheetColumns) {
    throw Object.assign(new Error('Spreadsheet column limit exceeded'), { code: 'limit' as const });
  }
  const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
  const warnings: ConversionWarning[] = [
    {
      code: 'spreadsheet_normalized',
      message: `Normalized ${extension.toUpperCase()} to CSV grid (formulas/macros stripped).`,
      fidelity: 'canonical_csv',
    },
  ];
  return { csv, warnings };
}

export async function convertImportUpload(input: {
  filename: string;
  bytes: Buffer;
}): Promise<ConversionOutcome> {
  const sniff = assertSafeUploadBytes(input.filename, input.bytes);
  if (sniff.blocked || !sniff.formatId) {
    return {
      ok: false,
      error: sniff.reason ?? 'Upload blocked',
      code: sniff.spoofed ? 'corrupt' : 'blocked',
    };
  }

  const cap = getFormatCapability(sniff.formatId);
  if (!cap) {
    return { ok: false, error: 'Unknown format capability', code: 'unsupported' };
  }

  const sourceChecksum = sha256Hex(input.bytes);
  const warnings: ConversionWarning[] = [];
  if (sniff.spoofed) {
    warnings.push({
      code: 'extension_spoof_corrected',
      message: `Filename extension did not match content; treated as ${sniff.extension}.`,
      fidelity: String(cap.fidelity),
    });
  }
  for (const w of cap.warnings ?? []) {
    warnings.push({ code: 'format_limitation', message: w, fidelity: String(cap.fidelity) });
  }

  try {
    switch (cap.id) {
      case 'markdown':
      case 'plain_text':
      case 'json': {
        const text = input.bytes.toString('utf8');
        if (!withinTextLimit(text)) {
          return { ok: false, error: 'Text exceeds vault limit', code: 'limit' };
        }
        if (cap.id === 'json') {
          JSON.parse(text);
        }
        return {
          ok: true,
          formatId: cap.id,
          vaultKind: kindFromFormatOrExtension(cap.vaultKind),
          mimeType: sniff.mimeType,
          extension: sniff.extension || cap.extensions[0]!,
          content: textBytes(text),
          textPreview: text.slice(0, 500),
          warnings,
          converterVersion: DOCUMENT_VAULT_CONVERTER_VERSION,
          sourceChecksum,
          generated: false,
        };
      }
      case 'html': {
        const sanitized = sanitizeHtmlFragment(input.bytes.toString('utf8'));
        if (!withinTextLimit(sanitized)) {
          return { ok: false, error: 'HTML exceeds vault limit', code: 'limit' };
        }
        warnings.push({
          code: 'html_sanitized',
          message: 'Scripts, styles, and event handlers were removed.',
          fidelity: 'sanitized',
        });
        return {
          ok: true,
          formatId: 'html',
          vaultKind: 'html',
          mimeType: 'text/html',
          extension: 'html',
          content: textBytes(sanitized),
          textPreview: sanitized.slice(0, 500),
          warnings,
          converterVersion: DOCUMENT_VAULT_CONVERTER_VERSION,
          sourceChecksum,
          generated: false,
        };
      }
      case 'rich_document': {
        const text = await extractDocxText(input.bytes);
        if (!withinTextLimit(text)) {
          return { ok: false, error: 'DOCX text exceeds vault limit', code: 'limit' };
        }
        warnings.push({
          code: 'docx_text_only',
          message: 'DOCX import extracted plain text; formatting and macros were not kept.',
          fidelity: 'lossy_on_office_roundtrip',
        });
        return {
          ok: true,
          formatId: 'rich_document',
          vaultKind: 'rich_document',
          mimeType: sniff.mimeType,
          extension: 'docx',
          content: textBytes(text),
          textPreview: text.slice(0, 500),
          warnings,
          converterVersion: DOCUMENT_VAULT_CONVERTER_VERSION,
          sourceChecksum,
          generated: false,
        };
      }
      case 'spreadsheet': {
        if (sniff.extension === 'csv' || sniff.extension === 'tsv') {
          const text = input.bytes.toString('utf8');
          if (!withinTextLimit(text)) {
            return { ok: false, error: 'CSV exceeds vault limit', code: 'limit' };
          }
          return {
            ok: true,
            formatId: 'spreadsheet',
            vaultKind: 'spreadsheet',
            mimeType: 'text/csv',
            extension: 'csv',
            content: textBytes(text),
            textPreview: text.slice(0, 500),
            warnings,
            converterVersion: DOCUMENT_VAULT_CONVERTER_VERSION,
            sourceChecksum,
            generated: false,
          };
        }
        const { csv, warnings: sheetWarnings } = spreadsheetToCanonicalCsv(
          input.bytes,
          sniff.extension,
        );
        if (!withinTextLimit(csv)) {
          return { ok: false, error: 'Spreadsheet CSV exceeds vault limit', code: 'limit' };
        }
        return {
          ok: true,
          formatId: 'spreadsheet',
          vaultKind: 'spreadsheet',
          mimeType: 'text/csv',
          extension: 'csv',
          content: textBytes(csv),
          textPreview: csv.slice(0, 500),
          warnings: [...warnings, ...sheetWarnings],
          converterVersion: DOCUMENT_VAULT_CONVERTER_VERSION,
          sourceChecksum,
          generated: true,
        };
      }
      case 'pdf': {
        // Uploaded PDF kept as original binary; also try text preview.
        let preview = '';
        try {
          preview = (await extractPdfText(input.bytes)).slice(0, 500);
        } catch {
          warnings.push({
            code: 'pdf_text_unavailable',
            message: 'PDF text extraction failed; original bytes were kept.',
            fidelity: 'generated_or_original',
          });
        }
        return {
          ok: true,
          formatId: 'pdf',
          vaultKind: 'pdf',
          mimeType: 'application/pdf',
          extension: 'pdf',
          content: input.bytes,
          textPreview: preview,
          warnings,
          converterVersion: DOCUMENT_VAULT_CONVERTER_VERSION,
          sourceChecksum,
          generated: false,
        };
      }
      case 'presentation':
      case 'odt':
      case 'image': {
        return {
          ok: true,
          formatId: cap.id,
          vaultKind: kindFromFormatOrExtension(cap.vaultKind, 'binary_upload'),
          mimeType: sniff.mimeType,
          extension: sniff.extension || cap.extensions[0]!,
          content: input.bytes,
          textPreview: '',
          warnings,
          converterVersion: DOCUMENT_VAULT_CONVERTER_VERSION,
          sourceChecksum,
          generated: false,
        };
      }
      case 'rtf': {
        const text = stripRtfToText(input.bytes.toString('utf8'));
        if (!withinTextLimit(text)) {
          return { ok: false, error: 'RTF text exceeds vault limit', code: 'limit' };
        }
        warnings.push({
          code: 'rtf_stripped',
          message: 'RTF control words were stripped to plain text.',
          fidelity: 'lossy_text_strip',
        });
        return {
          ok: true,
          formatId: 'rtf',
          vaultKind: 'plain_text',
          mimeType: 'text/plain',
          extension: 'txt',
          content: textBytes(text),
          textPreview: text.slice(0, 500),
          warnings,
          converterVersion: DOCUMENT_VAULT_CONVERTER_VERSION,
          sourceChecksum,
          generated: true,
        };
      }
      default:
        return { ok: false, error: `No importer for ${cap.id}`, code: 'unsupported' };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = (err as { code?: string })?.code === 'limit' ? 'limit' : 'corrupt';
    return { ok: false, error: message, code };
  }
}

export async function convertExportContent(input: {
  vaultKind: VaultItemKind;
  content: Buffer;
  targetFormat: string;
  title?: string;
}): Promise<ConversionOutcome> {
  const target = getFormatCapability(input.targetFormat);
  if (!target || !target.export) {
    return {
      ok: false,
      error: `Export to ${input.targetFormat} is not supported`,
      code: 'unsupported',
    };
  }

  const sourceChecksum = sha256Hex(input.content);
  const warnings: ConversionWarning[] = [];
  for (const w of target.warnings ?? []) {
    warnings.push({ code: 'format_limitation', message: w, fidelity: String(target.fidelity) });
  }

  const text = input.content.toString('utf8');

  try {
    switch (target.id) {
      case 'markdown':
      case 'plain_text':
      case 'html':
      case 'json':
        return {
          ok: true,
          formatId: target.id,
          vaultKind: kindFromFormatOrExtension(target.vaultKind),
          mimeType: target.mimeTypes[0]!,
          extension: target.extensions[0]!,
          content: input.content,
          textPreview: text.slice(0, 500),
          warnings,
          converterVersion: DOCUMENT_VAULT_CONVERTER_VERSION,
          sourceChecksum,
          generated: false,
        };
      case 'spreadsheet': {
        if (input.targetFormat === 'csv' || target.extensions[0] === 'csv') {
          return {
            ok: true,
            formatId: 'spreadsheet',
            vaultKind: 'spreadsheet',
            mimeType: 'text/csv',
            extension: 'csv',
            content: input.content,
            textPreview: text.slice(0, 500),
            warnings,
            converterVersion: DOCUMENT_VAULT_CONVERTER_VERSION,
            sourceChecksum,
            generated: false,
          };
        }
        const workbook = XLSX.read(input.content, { type: 'buffer', raw: false });
        const out = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
        warnings.push({
          code: 'csv_to_xlsx',
          message: 'Exported CSV grid to XLSX without formulas.',
          fidelity: 'canonical_csv',
        });
        return {
          ok: true,
          formatId: 'spreadsheet',
          vaultKind: 'spreadsheet',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          extension: 'xlsx',
          content: out,
          textPreview: text.slice(0, 500),
          warnings,
          converterVersion: DOCUMENT_VAULT_CONVERTER_VERSION,
          sourceChecksum,
          generated: true,
        };
      }
      case 'pdf': {
        const kind =
          input.vaultKind === 'html'
            ? 'html'
            : input.vaultKind === 'markdown'
              ? 'markdown'
              : 'plain_text';
        const plain = htmlOrMarkdownToPlain(text, kind);
        const matrix = loadFormatCapabilityMatrix();
        if (plain.length > matrix.limits.maxPdfSourceChars) {
          return { ok: false, error: 'PDF source exceeds character limit', code: 'limit' };
        }
        const pdf = buildDeterministicPdf(plain, {
          title: input.title ?? 'Document',
          author: 'Aiva Document Vault',
        });
        warnings.push({
          code: 'pdf_generated_artifact',
          message: 'PDF is a generated artifact from the editable source revision.',
          fidelity: 'generated_or_original',
        });
        return {
          ok: true,
          formatId: 'pdf',
          vaultKind: 'pdf',
          mimeType: 'application/pdf',
          extension: 'pdf',
          content: pdf,
          textPreview: plain.slice(0, 500),
          warnings,
          converterVersion: DOCUMENT_VAULT_CONVERTER_VERSION,
          sourceChecksum,
          generated: true,
        };
      }
      case 'rich_document': {
        // Export editable rich docs as markdown text with lossy warning (no OOXML writer).
        warnings.push({
          code: 'docx_export_as_markdown',
          message: 'Rich document export returns markdown text; DOCX packaging is lossy/not packaged.',
          fidelity: 'lossy_on_office_roundtrip',
        });
        return {
          ok: true,
          formatId: 'rich_document',
          vaultKind: 'rich_document',
          mimeType: 'text/markdown',
          extension: 'md',
          content: textBytes(text),
          textPreview: text.slice(0, 500),
          warnings,
          converterVersion: DOCUMENT_VAULT_CONVERTER_VERSION,
          sourceChecksum,
          generated: true,
        };
      }
      default:
        return { ok: false, error: `No exporter for ${target.id}`, code: 'unsupported' };
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      code: 'corrupt',
    };
  }
}
