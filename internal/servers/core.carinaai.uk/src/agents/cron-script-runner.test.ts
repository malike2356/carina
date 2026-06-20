import { describe, expect, it } from 'vitest';
import { injectScriptOutput } from './cron-script-runner.js';

describe('cron-script-runner', () => {
  it('injectScriptOutput replaces {{script_output}} placeholder', () => {
    const result = injectScriptOutput(
      'Summary:\n{{script_output}}\nDone.',
      'line one\nline two',
    );
    expect(result).toBe('Summary:\nline one\nline two\nDone.');
  });

  it('injectScriptOutput appends output when placeholder is missing', () => {
    const result = injectScriptOutput('Analyze this:', 'fresh data');
    expect(result).toBe('Analyze this:\n\nScript output:\nfresh data');
  });

  it('injectScriptOutput replaces all placeholders', () => {
    const result = injectScriptOutput('{{script_output}} and {{script_output}}', 'x');
    expect(result).toBe('x and x');
  });
});
