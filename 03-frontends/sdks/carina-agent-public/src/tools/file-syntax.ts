import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import YAML from 'yaml';

const execFileAsync = promisify(execFile);

let pythonAvailable: boolean | null = null;

async function hasPython(): Promise<boolean> {
  if (pythonAvailable !== null) return pythonAvailable;
  try {
    await execFileAsync('python3', ['--version']);
    pythonAvailable = true;
  } catch {
    pythonAvailable = false;
  }
  return pythonAvailable;
}

export async function collectSyntaxErrors(filePath: string, content: string): Promise<string[]> {
  const ext = path.extname(filePath).toLowerCase();
  const errors: string[] = [];

  if (ext === '.json') {
    try {
      JSON.parse(content);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
    return errors;
  }

  if (ext === '.yaml' || ext === '.yml') {
    try {
      YAML.parse(content);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
    return errors;
  }

  if (ext === '.py') {
    if (!(await hasPython())) return errors;
    const tmpPath = filePath;
    try {
      await execFileAsync('python3', ['-m', 'py_compile', tmpPath]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(msg);
    }
    return errors;
  }

  return errors;
}

export function newSyntaxErrors(before: string[], after: string[]): string[] {
  const beforeSet = new Set(before);
  return after.filter((e) => !beforeSet.has(e));
}
