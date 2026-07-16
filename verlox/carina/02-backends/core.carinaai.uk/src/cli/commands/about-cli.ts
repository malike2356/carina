import { readPackageInfo } from '../registry.js';
import { config } from '../../config/index.js';

const MIT_URL = 'https://opensource.org/licenses/MIT';

export function aboutText(version = readPackageInfo().version): string {
  return [
    `Carina Agent Runtime v${version}`,
    `License: MIT (${MIT_URL})`,
    'Build commercial products on Carina. Keep your domain logic private.',
    'AGPL-3.0 alternatives require you to open-source everything you build on them.',
    '',
    'Carina does not.',
    '',
    `Docs:     ${config.product.coreUrl}/docs/`,
    `Hosted:   ${config.product.appUrl}/`,
    'Scout:    https://console.labyrinthscout.com/',
    'GitHub:   https://github.com/carinaai/core',
  ].join('\n');
}

export async function runAboutCommand(): Promise<void> {
  console.log(aboutText());
}

export function versionWithLicenseLine(version = readPackageInfo().version): string {
  const pkg = readPackageInfo();
  return `${pkg.name} v${version} | MIT License | Build commercial products freely`;
}
