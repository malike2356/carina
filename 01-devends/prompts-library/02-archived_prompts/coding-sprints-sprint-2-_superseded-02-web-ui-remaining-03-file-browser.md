# Prompt 03: File Browser Panel


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

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
