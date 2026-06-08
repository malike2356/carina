# Phase 3.2 — Creative Skills

## Task
Port all creative skills. These enable Carina to generate ASCII art, diagrams, infographics, pixel art, music, video, and visual designs.

## Skills to port

### architecture-diagram
Dark-themed SVG architecture/cloud/infra diagrams as HTML.
Uses: SVG generation, cloud icon sets (AWS, GCP, Azure).

### ascii-art
ASCII art generation: pyfiglet, cowsay, boxes, image-to-ascii.
Uses: pyfiglet CLI, jp2a (image to ASCII).

### ascii-video
Convert video/audio to colored ASCII MP4/GIF.
Uses: ffmpeg, custom frame-to-ASCII converter.

### baoyu-article-illustrator
Article illustrations with consistent type x style x palette.
Uses: SVG generation, predefined palettes and styles.

### baoyu-comic
Knowledge comics: educational, biography, tutorial format.
Uses: Comic strip layout, SVG panels.

### baoyu-infographic
Infographics: 21 layouts x 21 styles.
Uses: SVG layout engine, data visualization.

### claude-design
Design one-off HTML artifacts: landing pages, decks, prototypes.
Uses: HTML/CSS generation, inline styles.

### comfyui
Generate images, video, and audio with ComfyUI.
Uses: ComfyUI API, workflow JSON.

### design-md
Author/validate/export Google's DESIGN.md token spec files.
Uses: DESIGN.md specification, validation rules.

### excalidraw
Hand-drawn Excalidraw JSON diagrams: architecture, flow, sequence.
Uses: Excalidraw JSON format.

### humanizer
Humanize text: strip AI-isms, add real voice.
Uses: Text transformation rules, style guides.

### ideation
Generate project ideas via creative constraints.
Uses: Constraint randomization, idea matrix.

### manim-video
Manim CE animations: 3Blue1Brown math/algo videos.
Uses: Manim Python library, ffmpeg.

### p5js
p5.js sketches: generative art, shaders, interactive, 3D.
Uses: p5.js library, HTML canvas.

### pixel-art
Pixel art with era palettes: NES, Game Boy, PICO-8.
Uses: Pixel grid generation, palette mapping.

### popular-web-designs
54 real design systems (Stripe, Linear, Vercel) as HTML/CSS.
Uses: Design system templates, CSS frameworks.

### pretext
Browser demos with @chenglou/pretext library.
Uses: Pretext library, interactive demos.

### sketch
Throwaway HTML mockups: 2-3 design variants to compare.
Uses: Quick HTML prototyping.

### songwriting-and-ai-music
Songwriting craft and Suno AI music prompts.
Uses: Song structure templates, Suno API.

### touchdesigner-mcp
Control a running TouchDesigner instance via MCP.
Uses: TouchDesigner MCP protocol.

## Porting instructions
Each skill follows the standard SKILL.md format with frontmatter.
Skills requiring external tools (ffmpeg, manim, ComfyUI) must check tool availability first.
All creative outputs should save to a configurable output directory.
