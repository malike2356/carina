import { describe, expect, it } from 'vitest';
import os from 'os';
import path from 'path';
import { expandPath, isSafePath, isBlockedSystemWrite } from './path-utils.js';

describe('expandPath', () => {
  it('expands ~/ to home directory', () => {
    expect(expandPath('~/documents/file.txt')).toBe(
      path.join(os.homedir(), 'documents/file.txt'),
    );
  });

  it('leaves absolute paths unchanged', () => {
    expect(expandPath('/tmp/test.txt')).toBe('/tmp/test.txt');
  });

  it('leaves relative paths unchanged', () => {
    expect(expandPath('relative/path.txt')).toBe('relative/path.txt');
  });
});

describe('isSafePath', () => {
  it('blocks path traversal with ..', () => {
    expect(isSafePath('/tmp/../etc/passwd')).toBe(false);
    expect(isSafePath('../../etc/passwd')).toBe(false);
  });

  it('blocks /etc paths', () => {
    expect(isSafePath('/etc/passwd')).toBe(false);
    expect(isSafePath('/etc/ssh/sshd_config')).toBe(false);
  });

  it('blocks /usr, /bin, /sys, /proc', () => {
    expect(isSafePath('/usr/bin/python')).toBe(false);
    expect(isSafePath('/bin/bash')).toBe(false);
    expect(isSafePath('/sys/kernel')).toBe(false);
    expect(isSafePath('/proc/self')).toBe(false);
  });

  it('allows safe paths', () => {
    expect(isSafePath('/tmp/test.txt')).toBe(true);
    expect(isSafePath('/home/user/docs/report.md')).toBe(true);
    expect(isSafePath('/opt/carina/data/output.txt')).toBe(true);
  });

  it('blocks /etc exactly', () => {
    expect(isSafePath('/etc')).toBe(false);
  });
});

describe('isBlockedSystemWrite', () => {
  it('blocks writes to /etc', () => {
    expect(isBlockedSystemWrite('/etc/cron.d/carina')).toBe(true);
  });

  it('allows writes to /tmp', () => {
    expect(isBlockedSystemWrite('/tmp/output.txt')).toBe(false);
  });
});
