import fs from 'fs/promises';
import { insertKnowledgeDocument, OPS_KNOWLEDGE_WRITE } from '../../workers/knowledge-base.js';
import { transcribeAudioFile } from '../../utils/transcribe-audio.js';
import type { RecorderListingItem } from './recorder-browser.js';

export interface IngestedRecording {
  recordingId: string;
  knowledgeEntryId: string;
  title: string;
  source: 'google-transcript' | 'whisper' | 'metadata-only';
}

function buildDocumentBody(item: RecorderListingItem, transcript: string, source: string): string {
  const lines = [
    `# ${item.title}`,
    '',
    `Source: Google Recorder (${source})`,
    `Recording ID: ${item.id}`,
    item.recordedAt ? `Recorded at: ${item.recordedAt}` : null,
    item.detailUrl ? `URL: ${item.detailUrl}` : null,
    `Ingested at: ${new Date().toISOString()}`,
    '',
    '## Transcript',
    '',
    transcript.trim() || '_No transcript available._',
  ];
  return lines.filter((line) => line !== null).join('\n');
}

export async function ingestRecorderItem(input: {
  workerId: string;
  workspaceId: string;
  item: RecorderListingItem;
}): Promise<IngestedRecording> {
  const { item } = input;
  let transcript = item.transcript?.trim() || '';
  let source: IngestedRecording['source'] = transcript ? 'google-transcript' : 'metadata-only';

  if (!transcript && item.audioPath) {
    const result = await transcribeAudioFile(item.audioPath);
    if ('text' in result && result.text.trim()) {
      transcript = result.text.trim();
      source = 'whisper';
    }
  }

  const entry = await insertKnowledgeDocument({
    workerId: input.workerId,
    workspaceId: input.workspaceId,
    title: `Recorder: ${item.title}`.slice(0, 200),
    content: buildDocumentBody(item, transcript, source),
    ...OPS_KNOWLEDGE_WRITE,
  });

  if (item.audioPath) {
    await fs.unlink(item.audioPath).catch(() => undefined);
  }

  return {
    recordingId: item.id,
    knowledgeEntryId: entry.id,
    title: item.title,
    source,
  };
}
