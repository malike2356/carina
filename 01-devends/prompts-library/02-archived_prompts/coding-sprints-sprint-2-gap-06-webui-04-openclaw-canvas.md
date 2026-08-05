# Web UI Upgrade 04; OpenClaw Canvas & Artifact Rendering

**Status: COMPLETED 2026-06-23**

**What was built:**
- `ArtifactCanvas.tsx` inline artifact/diagram rendering in chat markdown
- Canvas blocks detected in `MarkdownContent.tsx` for `artifact`, `canvas`, `diagram` fenced code
- Graph/chart rendering on HTML canvas with responsive sizing
- Resizable canvas side panel (`CanvasSidePanel.tsx`, `lib/canvas-panel.tsx`) with Open in panel, pop-out, download, Esc to close
- `WorkspaceLayoutClient.tsx` split layout alongside chat

> **REUSE RULE:** See `../REUSE-RULES.md`. File name references the behavioral source only. All implementation must use Carina's own voice, naming, CLI output, and UI copy. No competitor brand names in any shipped file.


**Source:** OpenClaw (`CanvasWindowController.swift`, `CanvasManager.swift`, `canvas-url.ts`)
**Status:** Missing in Carina web UI
**Effort:** 2 weeks

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## SPECIFICATION

### What This Is

OpenClaw has a Canvas system where agent-generated artifacts (HTML, SVG, Markdown, code, images) open in dedicated viewports; not inline in the chat. This gives rich artifacts their own space with proper rendering, zoom, and interaction.

Carina should adopt a canvas/artifact viewer for the web UI.

Carina note: markdown surfaces now render fenced `artifact`, `canvas`, and `diagram` blocks through an embedded preview component in `app.carinaai.uk/src/components/chat/ArtifactCanvas.tsx`. Keep any future artifact viewer aligned with that path instead of introducing a second preview system.

### Architecture

```
Chat Message
  → Agent generates artifact (HTML page, SVG diagram, Chart, Report)
  → "Open in Canvas" button appears on the artifact
  → Click opens CanvasViewer in a side panel or modal
  → Canvas renders the artifact with full interactivity
  → Canvas supports: HTML/CSS/JS, SVG, Markdown, Images, Code with syntax highlighting
```

---

## IMPLEMENTATION

### 1. Canvas Viewer Component

```tsx
// components/canvas/CanvasViewer.tsx
'use client';

import { useState, useRef, useEffect } from 'react';

type CanvasContentType = 'html' | 'svg' | 'markdown' | 'image' | 'code';

interface CanvasViewerProps {
  content: string;
  contentType: CanvasContentType;
  title?: string;
  onClose: () => void;
}

export function CanvasViewer({ content, contentType, title, onClose }: CanvasViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  return (
    <div className="canvas-overlay">
      <div className="canvas-chrome">
        {/* Toolbar */}
        <div className="canvas-toolbar">
          <span className="canvas-title">{title || 'Artifact'}</span>
          <div className="canvas-actions">
            <button onClick={() => handleZoom('out')}>Zoom Out</button>
            <span>{zoomLevel}%</span>
            <button onClick={() => handleZoom('in')}>Zoom In</button>
            <button onClick={handleDownload}>Download</button>
            <button onClick={() => window.open(getBlobUrl(), '_blank')}>
              Open in New Tab
            </button>
            <button onClick={onClose}>Close</button>
          </div>
        </div>

        {/* Content Area */}
        <div className="canvas-content">
          {contentType === 'html' && (
            <iframe
              ref={iframeRef}
              srcDoc={content}
              sandbox="allow-scripts allow-same-origin"
              className="canvas-iframe"
              title={title}
            />
          )}
          {contentType === 'svg' && (
            <div
              className="canvas-svg"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          )}
          {contentType === 'markdown' && (
            <div className="canvas-markdown">
              <MarkdownRenderer content={content} />
            </div>
          )}
          {contentType === 'image' && (
            <img src={content} alt={title} className="canvas-image" />
          )}
          {contentType === 'code' && (
            <CodeViewer code={content} />
          )}
        </div>
      </div>
    </div>
  );
}
```

### 2. Canvas Detection in Chat

Agent messages that contain artifacts should show an "Open in Canvas" button:

```tsx
// In chat/AssistantMessage.tsx
function detectArtifact(content: string): CanvasContentType | null {
  // HTML artifact: complete HTML document or substantial HTML block
  if (/<!DOCTYPE html>/i.test(content) || /<html[\s>]/i.test(content)) {
    return 'html';
  }
  // SVG artifact
  if (/<svg[\s>]/.test(content) && content.includes('</svg>')) {
    return 'svg';
  }
  // Large code block (>50 lines)
  const codeBlockMatch = content.match(/```(\w+)?\n([\s\S]{200,})```/);
  if (codeBlockMatch) {
    return 'code';
  }
  return null;
}

// In the message renderer:
const artifact = detectArtifact(message.content);
if (artifact) {
  return (
    <div>
      <MessageContent content={message.content} />
      <button
        onClick={() => openCanvas(message.content, artifact)}
        className="canvas-open-btn"
      >
        Open in Canvas ↗
      </button>
    </div>
  );
}
```

### 3. Canvas State Management

```typescript
// hooks/useCanvas.ts
'use client';

import { create } from 'zustand';

interface CanvasState {
  isOpen: boolean;
  content: string;
  contentType: CanvasContentType;
  title?: string;
  open: (content: string, contentType: CanvasContentType, title?: string) => void;
  close: () => void;
}

export const useCanvas = create<CanvasState>((set) => ({
  isOpen: false,
  content: '',
  contentType: 'html',
  title: undefined,
  open: (content, contentType, title) =>
    set({ isOpen: true, content, contentType, title }),
  close: () => set({ isOpen: false, content: '', contentType: 'html' }),
}));
```

### 4. Canvas Side Panel Mode

For larger screens, render canvas as a resizable side panel alongside chat:

```tsx
// In workspace layout
export default function WorkspaceLayout({ children }) {
  const canvas = useCanvas();

  return (
    <div className="workspace-layout">
      <div className={`workspace-main ${canvas.isOpen ? 'with-canvas' : ''}`}>
        {children}
      </div>
      {canvas.isOpen && (
        <div className="workspace-canvas">
          <CanvasViewer
            content={canvas.content}
            contentType={canvas.contentType}
            title={canvas.title}
            onClose={canvas.close}
          />
        </div>
      )}
    </div>
  );
}
```

### 5. Canvas URL Scheme

Support a canvas URL scheme for sharing and deep linking:

```
/app/canvas?type=html&title=Dashboard
/app/canvas?type=svg&title=Architecture%20Diagram
```

Also support `canvas://` protocol for desktop app integration (future, from OpenClaw `CanvasSchemeHandler.swift`).

---

## IMPLEMENTATION PLAN

### Week 1; Core Canvas
```
- Create CanvasViewer component (HTML, SVG, Markdown, Image, Code renderers)
- Create useCanvas store
- Add artifact detection in chat messages
- Add "Open in Canvas" button to qualifying messages
- Canvas modal mode
```

### Week 2; Polish
```
- Canvas side panel mode with resizable split
- Canvas URL scheme for deep linking
- Download and "Open in New Tab" actions
- Zoom controls
- Keyboard shortcuts (Esc to close, Cmd+Plus/Minus to zoom)
- Fullscreen mode
```

---

## REFERENCE FILES

```
OpenClaw:
  openclaw/apps/macos/Sources/OpenClaw/CanvasWindowController.swift
  openclaw/apps/macos/Sources/OpenClaw/CanvasManager.swift
  openclaw/apps/macos/Sources/OpenClaw/CanvasSchemeHandler.swift
  openclaw/apps/macos/Sources/OpenClaw/CanvasChromeContainerView.swift
  openclaw/ui/src/ui/canvas-url.ts
```

---

## Done When (verified)

- [x] Artifact/canvas content renders inline in chat messages
- [x] Markdown fenced blocks with `artifact`, `canvas`, or `diagram` language trigger canvas viewer
- [x] Responsive canvas sizing with device pixel ratio support
- [x] Dedicated side-panel canvas mode with resizable split
- [x] `/canvas` and `/app/canvas` deep-link routes for standalone artifact view
