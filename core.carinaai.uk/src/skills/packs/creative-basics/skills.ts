import type { PackSkillInput } from '../property-uk/skills.js';

export const creativeBasicsSkills: PackSkillInput[] = [
  {
    name: 'html-design',
    description: 'Generate HTML landing pages, decks, and prototypes',
    trigger: ['landing page', 'mockup', 'design a page', 'HTML prototype', 'web page'],
    steps: `1. Clarify purpose, audience, and key sections.
2. Choose inline CSS or a single shared stylesheet.
3. Build semantic HTML with responsive basics (mobile-first).
4. Write the file with file-write to the user's resources or output directory.
5. Return the file path and tell the user to open it in a browser.`,
    toolsUsed: ['file-write'],
  },
  {
    name: 'architecture-diagram',
    description: 'Create SVG architecture and system diagrams',
    trigger: ['architecture diagram', 'system diagram', 'infra diagram', 'flow diagram'],
    steps: `1. Identify components, data flows, and boundaries.
2. Choose layout: boxes-and-arrows or layered stack.
3. Generate clean SVG with a dark-theme palette.
4. Wrap in minimal HTML shell for easy viewing.
5. Write the file and return the path.`,
    toolsUsed: ['file-write'],
  },
  {
    name: 'excalidraw-diagram',
    description: 'Generate hand-drawn style Excalidraw diagrams',
    trigger: ['excalidraw', 'hand-drawn diagram', 'sketch diagram', 'whiteboard'],
    steps: `1. Define elements, connections, and labels.
2. Generate valid Excalidraw JSON (rectangles, arrows, text).
3. Write a .excalidraw file with file-write.
4. Tell the user to import at excalidraw.com or open in the desktop app.`,
    toolsUsed: ['file-write'],
  },
  {
    name: 'quick-mockup',
    description: 'Fast throwaway HTML mockups for comparison',
    trigger: ['quick mockup', 'compare layouts', 'throwaway prototype', 'sketch ui'],
    steps: `1. Generate 2-3 distinct HTML layout variants.
2. Keep each variant minimal and disposable.
3. Write separate files for side-by-side comparison.
4. Frame output as fast exploration, not production code.`,
    toolsUsed: ['file-write'],
  },
  {
    name: 'ascii-art',
    description: 'Generate ASCII art banners and text art',
    trigger: ['ascii art', 'banner', 'figlet', 'text art'],
    steps: `1. Probe for figlet/cowsay/jp2a via shell-exec (which figlet).
2. If available, use the CLI for styled output.
3. If not, generate ASCII art directly as monospace text.
4. Return the result without requiring external tools.`,
    toolsUsed: ['shell-exec', 'file-write'],
  },
  {
    name: 'humanizer',
    description: 'Rewrite AI-sounding text into natural human prose',
    trigger: ['humanize', 'sound more natural', 'less AI', 'rewrite naturally'],
    steps: `1. Strip AI-isms: "Furthermore", "It's worth noting", excessive hedging.
2. Vary sentence length and structure.
3. Remove listicle-itis unless the user wants a list.
4. Preserve meaning and facts; change only voice and rhythm.`,
    toolsUsed: [],
  },
  {
    name: 'ideation',
    description: 'Structured brainstorming with constraint randomization',
    trigger: ['brainstorm', 'ideate', 'generate ideas', 'creative options'],
    steps: `1. State the problem and constraints clearly.
2. Generate 5-10 divergent ideas without filtering.
3. Apply a random constraint to remix the top 3.
4. Present ranked options with trade-offs.`,
    toolsUsed: [],
  },
];
