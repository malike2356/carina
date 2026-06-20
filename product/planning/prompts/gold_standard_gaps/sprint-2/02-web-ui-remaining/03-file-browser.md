# Prompt 03: File Browser Panel

## Context

Carina's workspace needs a file browser panel so users can navigate the project filesystem,
open files, and reference them in conversations without leaving the browser. The file browser
reads from the agent's working directory on the server and is not a general filesystem
explorer; it is scoped to the user's project directories.

## What to Build

### 1. File API in Carina core

In `src/api/files.ts`, add session-gated routes:
```
GET  /api/files?path=relative/path   - list directory contents
GET  /api/files/read?path=file.txt   - read file (UTF-8 text files only, <1MB)
POST /api/files/upload               - upload file (multipart, <10MB, to project dir)
```

Directory listing response:
```typescript
type FileEntry = {
  name: string;
  path: string; // relative to project root
  type: 'file' | 'directory';
  size?: number; // bytes, files only
  modified: string; // ISO timestamp
};
```

Security rules:
- Path must be within the configured `PROJECT_ROOT` env var (default `/app/data`)
- Reject `..` path segments
- Reject symbolic links that escape the root
- Max file read size: 1MB

### 2. File browser component

In `apps/cloud/src/components/FileBrowser.tsx`:
```tsx
- Two-panel layout: tree (left), file content (right)
- Tree shows directories and files with icons
- Clicking a directory expands/collapses it
- Clicking a file loads its content in the right panel (syntax highlighted via Prism.js)
- "Open in Chat" button adds the file path as a reference in the current conversation
- "Copy Path" copies the relative file path to clipboard
- Search bar at top filters tree by filename
```

### 3. Workspace integration

The file browser opens as a slide-in panel from the right side of the workspace (same
pattern as the terminal drawer). Keyboard shortcut: Ctrl+Shift+E.

The chat input gains a "@file" mention trigger: typing `@` shows a file picker dropdown
backed by `/api/files?path=`. Selecting a file inserts its path as a reference. When Carina
processes the message, it automatically reads the referenced file content.

### 4. File upload

Add a drag-and-drop zone to the file browser header. Dropped files upload to
`/data/uploads/<session-id>/` and immediately appear in the tree. The agent can access
uploaded files via the `read-file` tool.

## Verification Checklist

- [ ] Browse to a subdirectory, see files listed with sizes and dates
- [ ] Click a `.ts` file, see syntax-highlighted content in right panel
- [ ] "Open in Chat" inserts `@data/myfile.ts` into chat input
- [ ] Drag a `.txt` file onto browser panel - appears in uploads directory
- [ ] Path with `../` returns 400 error (path traversal blocked)

## Files to Create or Modify

- CREATE `src/api/files.ts`
- MODIFY `src/server.ts` - mount file API routes
- CREATE `apps/cloud/src/components/FileBrowser.tsx`
- MODIFY `apps/cloud/src/pages/WorkspacePage.tsx` - add file browser panel
- MODIFY `apps/cloud/src/components/ChatInput.tsx` - add @file mention picker
