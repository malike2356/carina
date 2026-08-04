import type { Request, Response } from 'express';
import fs from 'fs/promises';
import { generateSpeech } from '../utils/tts.js';

const MAX_TTS_CHARS = 4000;

export async function handleTtsRequest(req: Request, res: Response): Promise<void> {
  const text = String(req.body?.text ?? '').trim();
  if (!text) {
    res.status(400).json({ error: 'text is required' });
    return;
  }
  if (text.length > MAX_TTS_CHARS) {
    res.status(400).json({ error: `text too long (max ${MAX_TTS_CHARS} characters)` });
    return;
  }

  let cleanup: (() => Promise<void>) | null = null;
  try {
    const result = await generateSpeech(text);
    cleanup = result.cleanup;
    const audio = await fs.readFile(result.filePath);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.send(audio);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  } finally {
    if (cleanup) await cleanup().catch(() => {});
  }
}
