import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { VaultItemKind } from './kinds.js';

export const DOCUMENT_VAULT_CONVERTER_VERSION = 'document-vault-formats/1.0.0';

export type FormatFidelity =
  | 'lossless'
  | 'sanitized'
  | 'lossy_on_office_roundtrip'
  | 'canonical_csv'
  | 'binary_preserve'
  | 'generated_or_original'
  | 'lossy_text_strip';

export type FormatCapability = {
  id: string;
  extensions: string[];
  mimeTypes: string[];
  vaultKind: VaultItemKind | string;
  create: boolean;
  edit: boolean;
  import: boolean;
  export: boolean;
  preview: boolean;
  pdfSource: boolean;
  fidelity: FormatFidelity | string;
  warnings?: string[];
};

export type FormatCapabilityMatrix = {
  version: string;
  converterVersion: string;
  limits: {
    maxUploadBytes: number;
    maxTextChars: number;
    maxSpreadsheetRows: number;
    maxSpreadsheetColumns: number;
    maxPdfSourceChars: number;
  };
  formats: FormatCapability[];
  unsupported: Array<{ id: string; extensions: string[]; reason: string }>;
};

const here = path.dirname(fileURLToPath(import.meta.url));
const matrixPath = path.resolve(
  here,
  '../../contracts/aiva-document-vault.v1/format-capability-matrix.json',
);

let cached: FormatCapabilityMatrix | null = null;

export function loadFormatCapabilityMatrix(): FormatCapabilityMatrix {
  if (!cached) {
    cached = JSON.parse(readFileSync(matrixPath, 'utf8')) as FormatCapabilityMatrix;
  }
  return cached;
}

export function getFormatCapability(formatIdOrExt: string): FormatCapability | null {
  const matrix = loadFormatCapabilityMatrix();
  const key = formatIdOrExt.trim().toLowerCase().replace(/^\./, '');
  return (
    matrix.formats.find((f) => f.id === key)
    || matrix.formats.find((f) => f.extensions.includes(key))
    || null
  );
}

export function assertEditableFormat(formatIdOrExt: string): FormatCapability {
  const cap = getFormatCapability(formatIdOrExt);
  if (!cap || !cap.edit) {
    throw new Error(`Format is not editable in Document Vault: ${formatIdOrExt}`);
  }
  return cap;
}

export function isUnsupportedExtension(ext: string): { blocked: boolean; reason?: string } {
  const matrix = loadFormatCapabilityMatrix();
  const key = ext.trim().toLowerCase().replace(/^\./, '');
  for (const row of matrix.unsupported) {
    if (row.extensions.includes(key)) return { blocked: true, reason: row.reason };
  }
  return { blocked: false };
}
