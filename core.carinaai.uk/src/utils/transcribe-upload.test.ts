import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const transcribeAudioFileMock = vi.fn();

vi.mock('./transcribe-audio.js', () => ({
  transcribeAudioFile: transcribeAudioFileMock,
}));

describe('transcribeUploadedAudio', () => {
  afterEach(() => {
    transcribeAudioFileMock.mockReset();
  });

  it('writes the uploaded buffer to a temp audio file before transcription', async () => {
    transcribeAudioFileMock.mockImplementation(async (filePath: string) => ({
      text: path.extname(filePath),
    }));

    const { transcribeUploadedAudio } = await import('./transcribe-upload.js');
    const result = await transcribeUploadedAudio(Buffer.from('voice-bytes'), 'audio/webm;codecs=opus', 'en');

    expect(result).toEqual({ text: '.webm' });
    expect(transcribeAudioFileMock).toHaveBeenCalledTimes(1);
    expect(String(transcribeAudioFileMock.mock.calls[0]?.[0] ?? '')).toMatch(/\.webm$/);
  });

  it('rejects empty audio payloads', async () => {
    const { transcribeUploadedAudio } = await import('./transcribe-upload.js');
    await expect(transcribeUploadedAudio(Buffer.alloc(0), 'audio/webm')).resolves.toEqual({
      error: 'audio payload is empty',
    });
  });

  it('cleans up the temp directory after transcription', async () => {
    let capturedPath = '';
    transcribeAudioFileMock.mockImplementation(async (filePath: string) => {
      capturedPath = filePath;
      return { text: 'ok' };
    });

    const { transcribeUploadedAudio } = await import('./transcribe-upload.js');
    await transcribeUploadedAudio(Buffer.from('voice-bytes'), 'audio/ogg');

    expect(capturedPath).toContain(path.join(os.tmpdir(), 'carina-voice-'));
    const tempDir = path.dirname(capturedPath);
    await expect(fs.stat(tempDir)).rejects.toThrow();
  });
});
