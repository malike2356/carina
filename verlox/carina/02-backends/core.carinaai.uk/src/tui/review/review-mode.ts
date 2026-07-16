import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import type { ChatMessage } from '../ink/hooks/useMessages.js';
import { redactTimelineText } from '../runtime-events/timeline-store.js';

export interface ReviewBlock {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  text: string;
}

export interface CopyResult {
  ok: boolean;
  detail: string;
  path?: string;
}

export function transcriptBlocks(messages: ChatMessage[]): ReviewBlock[] {
  return messages.flatMap((message) => message.parts.map((part, index): ReviewBlock => {
    if (part.kind === 'tool') {
      return {
        id: `${message.id}:tool:${index}`,
        role: 'tool',
        text: [part.toolName, part.args ? safeString(part.args) : '', part.result ? safeString(part.result) : '']
          .filter(Boolean)
          .join('\n'),
      };
    }
    return {
      id: `${message.id}:${index}`,
      role: message.role,
      text: part.content,
    };
  }));
}

export function searchTranscript(blocks: ReviewBlock[], query: string): ReviewBlock[] {
  const q = query.trim().toLowerCase();
  if (!q) return blocks;
  return blocks.filter((block) => block.text.toLowerCase().includes(q) || block.role.includes(q));
}

export function lastAssistantReply(blocks: ReviewBlock[]): string {
  return [...blocks].reverse().find((block) => block.role === 'assistant')?.text ?? '';
}

export function exportTranscriptMarkdown(blocks: ReviewBlock[]): string {
  if (blocks.length === 0) return '# Carina transcript\n\nNo transcript data.';
  return [
    '# Carina transcript',
    '',
    ...blocks.map((block) => `## ${block.role}\n\n${redactTimelineText(block.text)}`),
  ].join('\n');
}

export function exportRuntimeSummaryJson(blocks: ReviewBlock[]): string {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    blocks: blocks.map((block) => ({
      id: block.id,
      role: block.role,
      text: redactTimelineText(block.text),
    })),
  }, null, 2);
}

export function detectSafeUrls(text: string): string[] {
  const matches = text.match(/\bhttps?:\/\/[^\s<>"')]+/g) ?? [];
  return matches.filter((url) => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' || parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    } catch {
      return false;
    }
  });
}

export async function copyText(text: string, label = 'carina-review'): Promise<CopyResult> {
  const copied = tryClipboard(text);
  if (copied) return { ok: true, detail: 'Copied to clipboard.' };
  const filePath = path.join(os.tmpdir(), `${label}-${Date.now()}.txt`);
  await fs.writeFile(filePath, text, 'utf-8');
  return { ok: false, detail: `Clipboard unavailable. Output written to ${filePath}`, path: filePath };
}

function tryClipboard(text: string): boolean {
  const commands = process.platform === 'darwin'
    ? [['pbcopy']]
    : [['wl-copy'], ['xclip', '-selection', 'clipboard'], ['xsel', '--clipboard', '--input']];

  for (const [cmd, ...args] of commands) {
    const result = spawnSync(cmd, args, { input: text, stdio: ['pipe', 'ignore', 'ignore'] });
    if (result.status === 0) return true;
  }
  return false;
}

function safeString(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
