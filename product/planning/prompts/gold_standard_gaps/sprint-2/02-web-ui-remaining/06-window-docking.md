# Prompt 06: Window Docking and Split Panes

## Context

Power users need to work across multiple panels simultaneously (chat + terminal, chat +
file browser, two sessions side by side). The workspace needs a dockable panel system
that lets users split the view and float panels.

Use `react-mosaic` for the mosaic window layout (it is battle-tested, TypeScript-first,
and follows the same pattern as VSCode's panel system).

## What to Build

### 1. Install react-mosaic

```bash
pnpm add react-mosaic-component
```

### 2. Panel types

Define available panels in `apps/cloud/src/workspace/panels.ts`:
```typescript
export type PanelId =
  | 'chat'
  | 'terminal'
  | 'file-browser'
  | 'memory'
  | 'scout'
  | 'skill-runner'
  | 'tool-log';

export const PANEL_META: Record<PanelId, { title: string; icon: string }> = {
  chat: { title: 'Chat', icon: 'ti-message-circle' },
  terminal: { title: 'Terminal', icon: 'ti-terminal' },
  'file-browser': { title: 'Files', icon: 'ti-folder' },
  memory: { title: 'Memory', icon: 'ti-brain' },
  scout: { title: 'Scout', icon: 'ti-shield' },
  'skill-runner': { title: 'Skills', icon: 'ti-bolt' },
  'tool-log': { title: 'Tool Log', icon: 'ti-list' },
};
```

### 3. Mosaic layout wrapper

In `apps/cloud/src/workspace/WorkspaceLayout.tsx`:
```tsx
import { Mosaic, MosaicWindow } from 'react-mosaic-component';

export function WorkspaceLayout() {
  const [layout, setLayout] = useLocalStorage<MosaicNode<PanelId>>('workspace-layout', 'chat');

  return (
    <Mosaic<PanelId>
      renderTile={(id, path) => (
        <MosaicWindow<PanelId> path={path} title={PANEL_META[id].title}>
          <PanelContent id={id} />
        </MosaicWindow>
      )}
      value={layout}
      onChange={setLayout}
    />
  );
}
```

The layout persists to `localStorage` so the user's window arrangement survives reload.

### 4. Panel toolbar

Each `MosaicWindow` gets a toolbar with:
- Panel title and icon
- "Split Horizontal" button (adds a new panel to the right)
- "Split Vertical" button (adds a new panel below)
- "Float" button (pops panel into a floating div, dismissable with Escape)
- "Close" button (removes panel; at minimum one panel always remains)

When splitting, show a panel picker dropdown listing all available panel types.

### 5. Default layout

New users see the default layout: chat panel full screen.
A "+" button in the toolbar lets them add panels. Presets:
- "Dev mode" preset: chat (left 60%) + terminal (right 40%)
- "Research mode" preset: chat (left 50%) + file browser (right 50%)
- "Security mode" preset: chat (top left) + scout (top right) + tool log (bottom)

Presets are saved to the user's profile in DB and loaded on next login.

## Verification Checklist

- [ ] Click "+" and add a terminal panel - workspace splits into two panes
- [ ] Drag the divider between panes to resize
- [ ] Close a panel - remaining panels fill the space
- [ ] Refresh page - layout is restored from localStorage
- [ ] "Dev mode" preset creates chat + terminal layout in one click

## Files to Create or Modify

- CREATE `apps/cloud/src/workspace/panels.ts`
- CREATE `apps/cloud/src/workspace/WorkspaceLayout.tsx`
- CREATE `apps/cloud/src/workspace/PanelContent.tsx`
- MODIFY `apps/cloud/src/pages/WorkspacePage.tsx` - replace current layout with mosaic
- MODIFY `apps/cloud/package.json` - add react-mosaic-component
