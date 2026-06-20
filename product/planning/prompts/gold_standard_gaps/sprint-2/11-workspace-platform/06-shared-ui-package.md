# Prompt 06: @verlox/carina-ui Shared Component Library

## Context

Each distro needs UI components for its workspace panel. Without a shared library, every
distro rebuilds the same form controls, data tables, status chips, and layout shells from
scratch. `@verlox/carina-ui` is the shared design system that all distros consume.

## What to Build

### 1. Package scaffold

Create `packages/ui/` in the monorepo (alongside `packages/web/`):
```
packages/ui/
  package.json      - name: @verlox/carina-ui
  tsconfig.json
  src/
    components/
      Button.tsx
      Input.tsx
      Select.tsx
      Table.tsx
      Card.tsx
      Badge.tsx
      StatusChip.tsx
      Modal.tsx
      Toast.tsx
      DataGrid.tsx
      FormField.tsx
      Panel.tsx       - workspace panel shell (header + body + footer)
    hooks/
      useCarinaApi.ts    - typed fetch wrapper for Carina API
      useDistroConfig.ts - read current distro config from context
    theme/
      tokens.css      - CSS custom properties (colors, spacing, type)
      index.ts        - JS theme tokens
    index.ts          - barrel export
```

### 2. Key components

**Panel** (workspace panel shell):
```tsx
export function Panel({ title, actions, children, footer }: PanelProps) {
  return (
    <div className="carina-panel">
      <div className="carina-panel-header">
        <h2 className="carina-panel-title">{title}</h2>
        {actions && <div className="carina-panel-actions">{actions}</div>}
      </div>
      <div className="carina-panel-body">{children}</div>
      {footer && <div className="carina-panel-footer">{footer}</div>}
    </div>
  );
}
```

**StatusChip** (Scout score, agent state, risk level):
```tsx
export function StatusChip({ status, label }: { status: 'ok' | 'warn' | 'error' | 'info'; label: string }) {
  return (
    <span className={`carina-status-chip carina-status-chip--${status}`}>
      {label}
    </span>
  );
}
```

**DataGrid** (generic sortable table for module data):
```tsx
export function DataGrid<T>({ columns, rows, onRowClick }: DataGridProps<T>) {
  // sortable, filterable, paginated table
  // used by: case list, billing table, asset registry, etc.
}
```

### 3. CSS design tokens

In `packages/ui/src/theme/tokens.css`:
```css
:root {
  --carina-color-primary: #16c97e;
  --carina-color-surface: #0f1923;
  --carina-color-surface-2: #1a2840;
  --carina-color-border: #2a3f58;
  --carina-color-text: #f0f4f8;
  --carina-color-text-muted: #8ba3bc;
  --carina-color-success: #16c97e;
  --carina-color-warning: #f59e0b;
  --carina-color-error: #e63946;
  --carina-radius-sm: 4px;
  --carina-radius-md: 8px;
  --carina-radius-lg: 12px;
  --carina-space-xs: 4px;
  --carina-space-sm: 8px;
  --carina-space-md: 16px;
  --carina-space-lg: 24px;
  --carina-space-xl: 40px;
}
```

### 4. Build config

`packages/ui/package.json`:
```json
{
  "name": "@verlox/carina-ui",
  "version": "0.1.0",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./theme": "./src/theme/tokens.css"
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts",
    "dev": "tsup src/index.ts --format esm --dts --watch"
  },
  "peerDependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  }
}
```

### 5. Usage in a distro module

```tsx
import { Panel, DataGrid, StatusChip } from '@verlox/carina-ui';
import '@verlox/carina-ui/theme';

export function CasePanel() {
  return (
    <Panel title="Cases" actions={<button>New Case</button>}>
      <DataGrid columns={CASE_COLUMNS} rows={cases} onRowClick={openCase} />
    </Panel>
  );
}
```

## Verification Checklist

- [ ] `pnpm build` in `packages/ui/` produces `dist/index.js` and `dist/index.d.ts`
- [ ] `apps/cloud` imports `@verlox/carina-ui` and renders `<Panel>` without errors
- [ ] `<StatusChip status="ok" label="Protected" />` renders with green color from tokens
- [ ] TypeScript IntelliSense works for all exported components in a distro module file
- [ ] `packages/ui` is listed in root `pnpm-workspace.yaml`

## Files to Create or Modify

- CREATE `packages/ui/package.json`
- CREATE `packages/ui/tsconfig.json`
- CREATE `packages/ui/src/components/` (all components)
- CREATE `packages/ui/src/theme/tokens.css`
- CREATE `packages/ui/src/index.ts`
- MODIFY `pnpm-workspace.yaml` - add `packages/ui` to workspaces
- MODIFY `apps/cloud/package.json` - add `@verlox/carina-ui` as workspace dependency
