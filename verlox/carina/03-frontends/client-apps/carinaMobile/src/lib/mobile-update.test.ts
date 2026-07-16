import { describe, expect, it } from 'vitest';
import {
  buildMobileUpdateState,
  compareVersions,
  resolveMobileDownloadUrl,
} from './mobile-update';

describe('mobile update policy', () => {
  it('compares semantic versions', () => {
    expect(compareVersions('0.1.1', '0.1.2')).toBe(-1);
    expect(compareVersions('0.1.2', '0.1.1')).toBe(1);
    expect(compareVersions('0.1.1', '0.1.1')).toBe(0);
    expect(compareVersions('1.0', '1.0.0')).toBe(0);
  });

  it('resolves relative APK URLs against the cloud URL', () => {
    expect(
      resolveMobileDownloadUrl(
        { apkUrl: '/downloads/carina-mobile.apk' },
        'https://app.carinaai.uk/',
      ),
    ).toBe('https://app.carinaai.uk/downloads/carina-mobile.apk');
  });

  it('detects optional updates', () => {
    const state = buildMobileUpdateState('0.1.1', {
      version: '0.1.2',
      apkUrl: '/downloads/carina-mobile.apk',
    });

    expect(state?.updateAvailable).toBe(true);
    expect(state?.updateRequired).toBe(false);
  });

  it('detects required updates from minSupportedVersion', () => {
    const state = buildMobileUpdateState('0.1.1', {
      version: '0.1.3',
      minSupportedVersion: '0.1.2',
      apkUrl: '/downloads/carina-mobile.apk',
    });

    expect(state?.updateAvailable).toBe(true);
    expect(state?.updateRequired).toBe(true);
  });
});
