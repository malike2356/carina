import type { PackSkillInput } from '../../pack-types.js';

export const mediaExtendedSkills: PackSkillInput[] = [
  {
    name: 'spotify-dj',
    description: 'Search and play music via Spotify tools',
    trigger: ['spotify', 'play music', 'playlist', 'now playing'],
    steps: '1. Use spotify-search for tracks.\n2. Confirm with user before spotify-play.\n3. Report now playing via spotify-now-playing.',
    toolsUsed: ['spotify-search', 'spotify-play', 'spotify-now-playing'],
  },
  {
    name: 'video-storyboard',
    description: 'Analyze or generate video content',
    trigger: ['video analyze', 'video generation', 'storyboard', 'clip summary'],
    steps: '1. Use video-analyze for local files.\n2. Use video-generation for creative briefs.\n3. Summarize scenes and key moments.',
    toolsUsed: ['video-analyze', 'video-generation', 'vision-analyze'],
  },
  {
    name: 'podcast-transcribe',
    description: 'Transcribe and summarize podcast audio',
    trigger: ['podcast', 'transcribe audio', 'audio summary'],
    steps: '1. Use transcription on audio file.\n2. Summarize key points.\n3. Extract action items if requested.',
    toolsUsed: ['transcription', 'file-read'],
  },
  {
    name: 'image-batch',
    description: 'Batch process images with vision-analyze',
    trigger: ['batch images', 'analyze photos', 'image folder'],
    steps: '1. Use search-files for images.\n2. Run vision-analyze per file.\n3. Aggregate findings.',
    toolsUsed: ['search-files', 'vision-analyze'],
  },
  {
    name: 'tts-narration',
    description: 'Generate narration audio from scripts',
    trigger: ['narration', 'text to speech script', 'voiceover'],
    steps: '1. Polish script text.\n2. Use text-to-speech.\n3. Return output path.',
    toolsUsed: ['text-to-speech', 'file-write'],
  },
  {
    name: 'media-qc',
    description: 'Quality-check media assets before publish',
    trigger: ['media qc', 'asset review', 'thumbnail check'],
    steps: '1. Inspect dimensions/format via shell-exec ffprobe.\n2. vision-analyze for visual issues.\n3. Return pass/fail checklist.',
    toolsUsed: ['shell-exec', 'vision-analyze'],
  },
];
