# Action: Creative Skills - Select and Reinterpret a Small, Carina-Appropriate Subset (Standalone Carina)

## Goal
Add a handful of creative-output `Skill` entries that Carina can genuinely deliver with its existing toolset (HTML/SVG/diagram generation via `file-write` + an LLM turn), and explicitly decline to port the majority of the spec's 21 skills, which assume heavyweight media-generation infrastructure (ComfyUI, Manim, ffmpeg pipelines, TouchDesigner) that has no place in a property-AI SaaS product's default install.

## Context
- Project: `core.carinaai.uk`. Node.js 22 + TypeScript 5, ESM imports, pnpm, Vitest.
- **This spec is the least Carina-appropriate file in the whole batch and needs the heaviest scope reduction.** It lists 21 skills for generating ASCII art, pixel art, music (Suno/AudioCraft/heartmula), video (Manim, ffmpeg, ComfyUI), comics, infographics, and controlling TouchDesigner instances. Carina is "Autonomous AI agent platform with skill packs" for property professionals (per its own `package.json` description and the `property-uk` reference pack) - not a creative-media generation platform. Before porting anything, ask: would VERLOX ship this to a paying property-management customer, or is this scope creep from a different product's skill catalog being bulk-imported? Most of these skills answer "scope creep."
- Group the 21 into three buckets and treat each differently:

  **Bucket 1 - genuinely portable with existing tools (build these, ~4 skills)**:
  `claude-design` (HTML landing pages/decks via `file-write` + LLM generation - this is just "write good HTML," something the agent can already do), `architecture-diagram` (SVG diagrams as HTML - same: text generation + `file-write`), `excalidraw` (JSON diagram format - same: structured text generation + `file-write`), `sketch` (throwaway HTML mockups - same pattern, narrower scope). All four reduce to "the LLM generates text in a particular format/style and writes it to a file" - zero new tools or dependencies needed, just well-written `Skill.steps` prose plus maybe a small `knowledge/` reference file of conventions/templates.

  **Bucket 2 - portable but need a new lightweight tool (consider case by case, ~3 skills)**:
  `ascii-art` (needs `pyfiglet`/`cowsay`/`jp2a` CLIs - small, common, easy to probe-and-degrade), `humanizer` (pure text transformation - no external tool at all, just a well-specified prompt/skill), `ideation` (pure prompt-engineering - no tool needed). These are cheap; if the user wants them, they're a half-day each.

  **Bucket 3 - require infrastructure this product has no reason to carry (do not port; document as explicitly excluded, ~14 skills)**:
  `ascii-video`/`manim-video` (ffmpeg + Manim rendering pipelines - GBs of dependencies, render farms' worth of CPU time, for an agent whose customers want HMO compliance checks), `comfyui`/`touchdesigner-mcp` (control external GPU-bound creative-software instances that would need to be separately hosted, configured, and paired - this is "build a whole second product's worth of integration surface"), `audiocraft-audio-generation`/`songwriting-and-ai-music`/`heartmula` (music generation - same GPU/model-hosting problem), `pixel-art`/`baoyu-comic`/`baoyu-infographic`/`baoyu-article-illustrator`/`popular-web-designs`/`pretext`/`p5js`/`design-md` (niche generative-art/design-system catalogs that, while individually buildable as prompt-engineering exercises, collectively represent a large surface area of low-value-to-property-customers content).

- Read `src/skills/packs/property-uk/skills.ts` and `prompts/system.ts` for the established `Skill`/system-suffix conventions before writing anything new.

## Files to create
- `src/skills/packs/creative-basics/skills.ts` - the bucket-1 (and any approved bucket-2) skill entries
- `src/skills/packs/creative-basics/pack.json`
- `src/skills/packs/creative-basics/knowledge/html-design-conventions.ts` (optional - only if the `claude-design`/`sketch` skills benefit from a shared reference of layout/CSS conventions, mirroring how `05-floor-plan.md` separates cost data from tool logic)

## Step-by-step

1. **Surface the bucket breakdown to the user before building anything** - this spec asks for 21 skills and the right answer is "build 4-7 of them." State plainly which bucket each skill falls into and why, and get a thumbs-up on the cut list before investing engineering time porting content nobody asked for. (If the user says "actually I want the music/video stuff too," that's a much bigger, separate initiative requiring new infrastructure decisions - treat it as its own project, not a sub-task of "port some skill descriptions.")

2. For each approved bucket-1 skill, write a `PackSkillInput` entry whose `steps` describes a concrete generation workflow the LLM can follow directly (no external tools beyond `file-write`):
   - `html-design`: trigger words (`"landing page"`, `"mockup"`, `"design a page"`, `"HTML prototype"`); steps covering structure -> styling approach (inline CSS vs. a shared stylesheet) -> responsive basics -> writing the file -> how to present it back to the user (path + a one-line "open this in a browser to view")
   - `architecture-diagram`: trigger words (`"architecture diagram"`, `"system diagram"`, `"infra diagram"`); steps covering choosing a layout (boxes-and-arrows vs. layered), generating clean SVG markup, dark-theme palette choices (the spec's stated default), wrapping in a minimal HTML shell, writing the file
   - `excalidraw-diagram`: trigger words (`"excalidraw"`, `"hand-drawn diagram"`, `"sketChina diagram"` - check actual likely phrasing); steps covering the Excalidraw JSON schema basics (element types, positions, styles), generating valid JSON, writing the `.excalidraw` file, and how the user opens it (excalidraw.com import, or the desktop app)
   - `quick-mockup` (from `sketch`): narrower-scoped sibling of `html-design` - "generate 2-3 throwaway HTML variants to compare," explicitly framed as fast and disposable (the spec's own framing: "throwaway... to compare," not production-quality)

3. For any approved bucket-2 skills:
   - `ascii-art`: write the skill steps to probe for `figlet`/`cowsay`/`jp2a` via `shell-exec` (`which figlet`, etc.) before attempting to use them, with a graceful fallback to "generate ASCII art directly as text" if the CLIs aren't present (the LLM can produce simple ASCII art itself - the CLIs are a nicety, not a requirement, so the skill should degrade rather than fail)
   - `humanizer`/`ideation`: pure prompt-engineering skills, no tool dependency - write the `steps` as a clear methodology (for `humanizer`: specific AI-ism patterns to strip, e.g. "Furthermore," "It's worth noting that," excessive hedging, listicle-itis; for `ideation`: a constraint-randomization technique the LLM can run on itself)

4. Write `pack.json` mirroring `property-uk`'s shape, with an honest `skillCount`.

5. Wire into `src/skills/index.ts` (or the generic pack loader, if `06-domain-pack-system.md` produced one - check first, as in `01-autonomous-ai-agents.md`).

6. Document the bucket-3 exclusions explicitly in your completion summary as a numbered "considered and excluded" list with one-line reasons each - this is the artifact that lets the user later say "actually let's do `comfyui`" with full context on why it wasn't done by default, rather than wondering whether it was forgotten.

## Expected behavior
- A user asking "make me a quick architecture diagram of our email pipeline" gets clean, dark-themed SVG written to a file they can open immediately - no GPU, no external service, no new dependency.
- The `ascii-art` skill (if approved) produces output whether or not `figlet`/`jp2a` are installed.
- The user has a clear, reasoned map of what was excluded and why, instead of a silent 21-to-4 scope cut.

## Test
```bash
cd core.carinaai.uk
pnpm vitest run src/skills/
pnpm test
pnpm build
```
Manual check:
```
In a Carina session: "Design a simple landing page for a property management service"
# Confirm a real HTML file is written and looks reasonable when opened in a browser
```

## Dependencies
- None beyond what already exists (`file-write`, the LLM itself) for bucket 1 and the prompt-engineering bucket-2 skills
- `figlet`/`cowsay`/`jp2a` CLIs, optionally, for the `ascii-art` skill (probe-and-degrade, never required)
