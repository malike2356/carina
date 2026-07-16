import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const PYTHON_SCRIPT = `
import sys, json, os, subprocess

def prepare_audio(path):
    ext = os.path.splitext(path)[1].lower()
    if ext == '.wav':
        return path
    wav_path = path + '.prep.wav'
    result = subprocess.run(
        ['ffmpeg', '-y', '-i', path, '-ar', '16000', '-ac', '1', wav_path],
        capture_output=True,
        check=False,
    )
    if result.returncode == 0 and os.path.isfile(wav_path) and os.path.getsize(wav_path) > 44:
        return wav_path
    return path

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "no audio path provided"}))
        return

    audio_path = prepare_audio(sys.argv[1])
    language = sys.argv[2] if len(sys.argv) > 2 else None

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print(json.dumps({"error": "faster-whisper not available; install it or provide an OpenAI/Groq key"}))
        return

    try:
        cache_dir = os.environ.get("CARINA_HOME", "/tmp")
        model_dir = os.path.join(cache_dir, "whisper-models")
        os.makedirs(model_dir, exist_ok=True)
        model = WhisperModel("tiny", device="cpu", compute_type="int8", download_root=model_dir)
        segments, _ = model.transcribe(
            audio_path,
            language=language,
            beam_size=5,
            vad_filter=False,
            condition_on_previous_text=False,
        )
        text = " ".join(s.text.strip() for s in segments).strip()
        if not text:
            print(json.dumps({"error": "empty transcription"}))
        else:
            print(json.dumps({"text": text}))
    except Exception as exc:
        print(json.dumps({"error": str(exc)}))

main()
`.trim();

/** Local Whisper transcription using faster-whisper via Python subprocess. */
export async function transcribeAudioLocal(
  filePath: string,
  language?: string,
): Promise<{ text: string } | { error: string }> {
  try {
    const args = ['-c', PYTHON_SCRIPT, filePath];
    if (language) args.push(language);
    const { stdout } = await execFileAsync('python3', args, { timeout: 120_000 });
    const line = stdout.trim();
    if (!line) return { error: 'local whisper returned no output' };
    return JSON.parse(line) as { text: string } | { error: string };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `local transcription subprocess failed: ${msg}` };
  }
}
