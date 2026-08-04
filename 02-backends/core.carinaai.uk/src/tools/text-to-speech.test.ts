import { describe, expect, it, vi, beforeEach } from 'vitest';

const { generateSpeechMock } = vi.hoisted(() => {
  const generateSpeechMock = vi.fn();
  return { generateSpeechMock };
});

vi.mock('../utils/tts.js', () => ({
  generateSpeech: generateSpeechMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('text-to-speech tool', () => {
  it('returns error when text is empty', async () => {
    const { textToSpeechTool } = await import('./text-to-speech.js');
    const result = await textToSpeechTool.execute({ text: '' }) as { error?: string };
    expect(result.error).toBe('text is required.');
    expect(generateSpeechMock).not.toHaveBeenCalled();
  });

  it('returns error when text is whitespace only', async () => {
    const { textToSpeechTool } = await import('./text-to-speech.js');
    const result = await textToSpeechTool.execute({ text: '   ' }) as { error?: string };
    expect(result.error).toBe('text is required.');
  });

  it('returns media path on success', async () => {
    generateSpeechMock.mockResolvedValue({
      filePath: 'data/tts/abc123.mp3',
      cleanup: vi.fn(),
    });
    const { textToSpeechTool } = await import('./text-to-speech.js');
    const result = await textToSpeechTool.execute({ text: 'Hello world' }) as {
      media?: string;
      format?: string;
      message?: string;
    };
    expect(result.media).toBe('data/tts/abc123.mp3');
    expect(result.format).toBe('mp3');
    expect(result.message).toMatch(/^MEDIA:/);
  });

  it('calls generateSpeech with the trimmed input text', async () => {
    generateSpeechMock.mockResolvedValue({ filePath: 'data/tts/x.mp3', cleanup: vi.fn() });
    const { textToSpeechTool } = await import('./text-to-speech.js');
    await textToSpeechTool.execute({ text: '  hello  ' });
    expect(generateSpeechMock).toHaveBeenCalledWith('hello');
  });

  it('returns error when generateSpeech throws (edge-tts not installed)', async () => {
    generateSpeechMock.mockRejectedValue(
      new Error('TTS generation failed: edge-tts CLI not found. Run: pip3 install edge-tts'),
    );
    const { textToSpeechTool } = await import('./text-to-speech.js');
    const result = await textToSpeechTool.execute({ text: 'hello' }) as { error?: string };
    expect(result.error).toContain('edge-tts');
  });

  it('returns error when generateSpeech throws (unsupported provider)', async () => {
    generateSpeechMock.mockRejectedValue(new Error('Unsupported TTS provider: whisper'));
    const { textToSpeechTool } = await import('./text-to-speech.js');
    const result = await textToSpeechTool.execute({ text: 'hello' }) as { error?: string };
    expect(result.error).toContain('Unsupported TTS provider');
  });
});
