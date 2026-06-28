import { execFileSync } from 'node:child_process';

export interface RAvailability {
  installed: boolean;
  version?: string;
  packages?: Record<string, boolean>;
  error?: string;
}

const CORE_PACKAGES = ['haven', 'dplyr', 'broom', 'jsonlite'] as const;

function packageInstalled(packageName: string): boolean {
  try {
    const output = execFileSync(
      'Rscript',
      ['-e', `cat(requireNamespace("${packageName}", quietly=TRUE))`],
      { encoding: 'utf-8', timeout: 15_000 },
    );
    return output.trim() === 'TRUE';
  } catch {
    return false;
  }
}

export function checkR(extraPackages: string[] = []): RAvailability {
  try {
    const version = execFileSync('Rscript', ['--version'], {
      encoding: 'utf-8',
      timeout: 5_000,
    }).trim();
    const packages: Record<string, boolean> = {};
    for (const pkg of [...CORE_PACKAGES, ...extraPackages]) {
      packages[pkg] = packageInstalled(pkg);
    }
    return { installed: true, version, packages };
  } catch (err) {
    return {
      installed: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
