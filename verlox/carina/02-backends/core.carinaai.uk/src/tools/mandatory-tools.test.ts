import { describe, expect, it } from 'vitest';
import {
  buildMandatoryToolHint,
  buildMandatoryToolsBlock,
  matchMandatoryToolRules,
  primaryMandatoryTools,
} from './mandatory-tools.js';

describe('mandatory-tools', () => {
  it('buildMandatoryToolsBlock lists core categories', () => {
    const block = buildMandatoryToolsBlock();
    expect(block).toContain('Mandatory tool use');
    expect(block).toContain('shell-exec');
    expect(block).toContain('file-read');
    expect(block).toContain('web-search');
  });

  it('matches arithmetic questions to shell tools', () => {
    const matches = matchMandatoryToolRules('what is 17 * 23?');
    expect(matches.some((m) => m.rule.id === 'arithmetic')).toBe(true);
    expect(primaryMandatoryTools('what is 17 * 23?')).toContain('shell-exec');
  });

  it('matches file read requests to file tools', () => {
    const tools = primaryMandatoryTools('read the file src/index.ts');
    expect(tools).toContain('file-read');
  });

  it('matches remember instructions to memory tool', () => {
    const tools = primaryMandatoryTools('remember that I prefer terse replies');
    expect(tools).toContain('memory');
  });

  it('matches image and banner requests to image-generation', () => {
    const tools = primaryMandatoryTools('Generate a welcome banner for a new VERLOX staff member.');
    expect(tools).toContain('image-generation');
    const hint = buildMandatoryToolHint('Generate a welcome banner for a new VERLOX staff member.');
    expect(hint).toContain('image-generation');
    expect(hint).toContain('Do not substitute');
  });

  it('buildMandatoryToolHint returns structured guidance', () => {
    const hint = buildMandatoryToolHint('what time is it in London?');
    expect(hint).toContain('Mandatory tool routing');
    expect(hint).toContain('shell-exec');
  });

  it('returns null hint for casual messages without mandatory triggers', () => {
    expect(buildMandatoryToolHint('hello')).toBeNull();
  });
});
