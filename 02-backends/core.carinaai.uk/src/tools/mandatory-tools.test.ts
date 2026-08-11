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

  it('matches send-email requests to gmail-send', () => {
    const tools = primaryMandatoryTools('send this email to To: laudpaul@gmail.com Subject: Hello');
    expect(tools).toContain('gmail-send');
    expect(tools).toContain('email-send');
  });

  it('routes latest-email requests to Gmail read tools', () => {
    const tools = primaryMandatoryTools('What is the most recent email I have received?');
    expect(tools).toContain('gmail-list');
    expect(tools).toContain('gmail-get');
  });

  it('matches draft-for-approval email requests to workspace email draft tool', () => {
    const tools = primaryMandatoryTools(
      'can you email him if draft an email for me to approve and or send from the workspace?',
    );
    expect(tools).toContain('workspace-email-draft-for-approval');
    expect(tools).not.toContain('gmail-send');
    const keep = primaryMandatoryTools('no draft and keep in workspace');
    expect(keep).toContain('workspace-email-draft-for-approval');
  });

  it('matches Drive inventory requests to Google Drive tools', () => {
    const tools = primaryMandatoryTools('what is inside my Google Drive?');
    expect(tools).toContain('google-drive-list');
    expect(tools).toContain('google-drive-search');
    expect(tools).toContain('google-drive-read');
  });

  it('matches personal reminder/task-list requests to notes-manage', () => {
    const tools = primaryMandatoryTools(
      'put this as a reminder in my task list to apply for my masters certificate',
    );
    expect(tools).toContain('notes-manage');
    const hint = buildMandatoryToolHint(
      'put this as a reminder in my task list to apply for my masters certificate',
    );
    expect(hint).toContain('Task ID');
    expect(hint).toContain('notes-manage');
  });

  it('matches workspace document save requests to workspace document tools', () => {
    const tools = primaryMandatoryTools('create a sample document and save it in my workspace documents');
    expect(tools).toContain('vault-create-file');
    expect(tools).toContain('workspace-document-create');
  });

  it('matches self inventory / activity audit requests to worker-activity-audit', () => {
    const tools = primaryMandatoryTools(
      'hello selorm. i need a self investory and audit of all your activities in the last 24hours',
    );
    expect(tools).toContain('worker-activity-audit');
    expect(tools).toContain('worker-conversation-search');
    const hint = buildMandatoryToolHint('what did you do in the last 24 hours');
    expect(hint).toContain('worker-activity-audit');
    expect(hint).toContain('worker-scoped');
  });

  it('matches Telegram bot token setup requests to channel self-config', () => {
    const tools = primaryMandatoryTools('connect Telegram with this BotFather token 123456789:ABCdef_1234567890-token');
    expect(tools).toContain('aiva-channel-connect');
  });

  it('matches contact lookup requests to contacts tool', () => {
    const tools = primaryMandatoryTools('did you find alex karikari?');
    expect(tools).toContain('contacts');
    const hint = buildMandatoryToolHint('did you check my google contacts?');
    expect(hint).toContain('contacts');
    expect(hint).toContain('escalate');
  });

  it('matches bare find/who-is name lookups to contacts and Companies House officers', () => {
    for (const ask of ['find ayeke', 'find Apigey', 'find Afia', 'who is Patience Gablah?', 'and what did you find?']) {
      const tools = primaryMandatoryTools(ask);
      expect(tools).toContain('contacts');
      expect(tools).toContain('companies-house-search-officers');
    }
    expect(primaryMandatoryTools('find my documents')).not.toContain('contacts');
    expect(primaryMandatoryTools('find my documents')).not.toContain('companies-house-search-officers');
  });

  it('escalates person email hunts through Companies House as well as Gmail', () => {
    const tools = primaryMandatoryTools('did you find alex karikari?');
    expect(tools).toContain('contacts');
    expect(tools).toContain('companies-house-search-officers');
  });

  it('matches cron and morning digest requests to worker-automation', () => {
    expect(primaryMandatoryTools('test all cron jobs')).toContain('worker-automation');
    expect(primaryMandatoryTools('no morning digest, or nothing?')).toContain('worker-automation');
    const hint = buildMandatoryToolHint('list my scheduled automations');
    expect(hint).toContain('worker-automation');
    expect(primaryMandatoryTools('list my scheduled automations')).not.toContain('cronjob');
  });

  it('escalates missing contact fields to email and web tools', () => {
    const tools = primaryMandatoryTools('does he have an email address?');
    expect(tools).toContain('contacts');
    expect(tools).toContain('gmail-search');
    expect(tools).toContain('web-search');
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
