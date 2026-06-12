import fs from 'fs/promises';
import path from 'path';
import {
  validateExtensionManifest,
  type ExtensionManifest,
  type ExtensionRisk,
} from './manifest.js';

const SENSITIVE = [
  /sk-[a-zA-Z0-9]{20,}/,
  /api[_-]?key\s*[:=]\s*['"]?[a-zA-Z0-9_-]{16,}/i,
  /password\s*[:=]\s*['"]?[^\s'"]{6,}/i,
  /AKIA[0-9A-Z]{16}/,
];

const HIGH_RISK_TOOL_PATTERNS = [
  /shell-exec/i,
  /code-exec/i,
  /pty/i,
  /subprocess/i,
];

export type ExtensionValidationResult = {
  ok: boolean;
  manifest: ExtensionManifest;
  warnings: string[];
  errors: string[];
  risk: ExtensionRisk;
};

export async function readExtensionManifest(bundleDir: string): Promise<ExtensionManifest> {
  const manifestPath = path.join(bundleDir, 'extension.json');
  const raw = JSON.parse(await fs.readFile(manifestPath, 'utf-8')) as unknown;
  return validateExtensionManifest(raw, path.basename(bundleDir));
}

async function collectTextFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectTextFiles(full)));
    } else if (/\.(json|md|txt|yaml|yml|js|ts)$/i.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

async function scanSensitive(bundleDir: string): Promise<string[]> {
  const errors: string[] = [];
  for (const file of await collectTextFiles(bundleDir)) {
    const content = await fs.readFile(file, 'utf-8');
    for (const pattern of SENSITIVE) {
      if (pattern.test(content)) {
        errors.push(`Sensitive pattern in ${path.relative(bundleDir, file)}`);
      }
    }
  }
  return errors;
}

async function validateEntryPaths(bundleDir: string, manifest: ExtensionManifest): Promise<string[]> {
  const errors: string[] = [];
  for (const cap of manifest.capabilities) {
    const rel = manifest.entryPoints[cap];
    if (!rel) continue;
    const target = path.join(bundleDir, rel);
    try {
      await fs.access(target);
    } catch {
      errors.push(`Missing entry path for ${cap}: ${rel}`);
    }
  }
  return errors;
}

async function assessToolRisk(bundleDir: string, manifest: ExtensionManifest): Promise<{
  risk: ExtensionRisk;
  warnings: string[];
}> {
  const warnings: string[] = [];
  let risk = manifest.risk ?? 'low';
  if (!manifest.capabilities.includes('tools')) {
    return { risk, warnings };
  }

  const toolsPath = manifest.entryPoints.tools;
  if (!toolsPath) return { risk, warnings };

  try {
    const raw = JSON.parse(
      await fs.readFile(path.join(bundleDir, toolsPath), 'utf-8'),
    ) as unknown;
    const tools = Array.isArray(raw)
      ? raw
      : raw && typeof raw === 'object' && Array.isArray((raw as { tools?: unknown }).tools)
        ? (raw as { tools: unknown[] }).tools
        : [];
    const serialized = JSON.stringify(tools);
    for (const pattern of HIGH_RISK_TOOL_PATTERNS) {
      if (pattern.test(serialized)) {
        risk = 'high';
        warnings.push('Tool metadata references high-risk execution patterns');
        break;
      }
    }
  } catch {
    warnings.push('Could not parse tools metadata for risk scan');
  }

  return { risk, warnings };
}

export async function validateExtensionBundle(
  bundleDir: string,
  options: { allowHighRisk?: boolean } = {},
): Promise<ExtensionValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  let manifest: ExtensionManifest;
  try {
    manifest = await readExtensionManifest(bundleDir);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(msg);
  }

  if (path.basename(bundleDir) !== manifest.id) {
    warnings.push(`Bundle directory name "${path.basename(bundleDir)}" differs from manifest id "${manifest.id}"`);
  }

  errors.push(...await validateEntryPaths(bundleDir, manifest));
  errors.push(...await scanSensitive(bundleDir));

  const toolRisk = await assessToolRisk(bundleDir, manifest);
  warnings.push(...toolRisk.warnings);
  const risk = toolRisk.risk;

  if (risk === 'high' && !options.allowHighRisk) {
    errors.push('High-risk extension requires --allow-dangerous to enable');
  }

  return {
    ok: errors.length === 0,
    manifest,
    warnings,
    errors,
    risk,
  };
}
