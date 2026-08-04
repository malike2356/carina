import type { PackSkillInput } from '#core/skills/pack-types.js';

export const clinicomSkills: PackSkillInput[] = [
  {
    name: 'interpreter-transcribe',
    description: 'Transcribe interpreter audio via the Clinicom sidecar contract',
    trigger: ['transcribe', 'speech to text', 'interpreter audio', 'clinicom transcribe'],
    steps: `1. Collect audio payload (base64) and language hint.
2. Call clinicom-transcribe tool or POST /clinicom/tools/transcribe on the configured sidecar.
3. Return transcript, detected language, and confidence; do not store raw audio beyond session policy.`,
    toolsUsed: ['clinicom-transcribe'],
  },
  {
    name: 'interpreter-translate',
    description: 'Translate clinical dialogue between languages via Clinicom sidecar',
    trigger: ['translate', 'interpreter', 'language bridge', 'clinicom translate'],
    steps: `1. Confirm source and target language codes.
2. Call clinicom-translate tool preserving medical terms where possible.
3. Flag ambiguous terms for clinician review; never alter clinical meaning.`,
    toolsUsed: ['clinicom-translate'],
  },
  {
    name: 'patient-plain-language',
    description: 'Simplify clinical text to plain language for patients',
    trigger: ['plain language', 'easy read', 'simplify', 'clinicom simplify'],
    steps: `1. Identify target reading level (default grade 8).
2. Call clinicom-simplify tool.
3. Preserve critical medical terms and safety instructions.`,
    toolsUsed: ['clinicom-simplify'],
  },
  {
    name: 'interpreter-speak',
    description: 'Synthesize spoken output for interpreted encounters',
    trigger: ['text to speech', 'speak', 'read aloud', 'clinicom speak'],
    steps: `1. Confirm language and voice preference.
2. Call clinicom-speak tool.
3. Return audio metadata; avoid logging full transcript in telemetry.`,
    toolsUsed: ['clinicom-speak'],
  },
];
