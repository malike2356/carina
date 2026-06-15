#!/usr/bin/env node
/**
 * carina-agent meta-package CLI shim.
 * Delegates to @carina/core while reporting carina-agent in --version.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const coreBin = require.resolve('@carina/core/bin/carina');
const metaPkg = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8'),
);

const result = spawnSync(process.execPath, [coreBin, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: {
    ...process.env,
    CARINA_PACKAGE_NAME: metaPkg.name,
    CARINA_PACKAGE_VERSION: metaPkg.version,
  },
});

process.exit(result.status ?? 1);
