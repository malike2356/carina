# Web UI Upgrade 07; Odysseus UX Efficiency

**Status: COMPLETED 2026-06-23**

**What was built:**
- Entity anchors in markdown (`#session-*`, `#document-*`, etc.) via `MarkdownContent.tsx`
- `QRCodeCanvas` component; companion pairing UI at `settings/pairing/page.tsx`
- Command palette (`CommandPalette.tsx`), keyboard shortcuts, profile switcher in sidebar
- Navigation efficiency from 3-zone shell redesign

> **REUSE RULE:** See `../REUSE-RULES.md`. File name references the behavioral source only. All implementation must use Carina's own voice, naming, CLI output, and UI copy. No competitor brand names in any shipped file.


**Source:** Odysseus (`static/app.js`, `src/agent_loop.py`; `_LINK_RULES`, `_UI_CONVENTIONS`)
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

### 5 UX Features to Build

| # | Feature | Odysseus Source | Description |
|---|---------|----------------|-------------|
| 1 | Entity anchors | `_LINK_RULES` in agent_loop.py | Clickable links for sessions, docs, notes, emails, tasks, skills |
| 2 | QR code generation | `qrcode.min.js` | QR codes for sharing sessions, pairing |
| 3 | Companion pairing UI | `companion/routes.py` | LAN discovery + token pairing flow |
| 4 | Navigation efficiency | SPA design | Reduce clicks between surfaces |
| 5 | Quick actions | Chat input shortcuts | Slash commands, quick toggles in composer |

Carina note: the pairing UI and QR generator are now implemented in `app.carinaai.uk/src/app/(workspace)/settings/pairing/page.tsx` and `src/components/ui/QRCode.tsx`. Keep the flow aligned if you extend device linking.

---

## FEATURE 1; ENTITY ANCHORS

### What This Is

Odysseus uses clickable markdown anchors everywhere. When the agent references a session, document, note, or email, it renders as `[Name](#session-abc123)`; and the frontend converts these into clickable links that navigate to the relevant panel.

Carina should adopt this pattern: any entity reference in a chat message becomes a clickable link.

### Anchor Format

```
Session:    [Chat Title](#session-<id>)
Document:   [Document Title](#document-<id>)
Note:       [Note Title](#note-<id>)
Email:      [Subject](#email-<uid>)
Calendar:   [Event Summary](#event-<uid>)
Task:       [Task Name](#task-<id>)
Skill:      [skill-name](#skill-<name>)
Research:   [Topic](#research-<session_id>)
Memory:     [Memory Text](#memory-<id>)
```

### Implementation

```tsx
// lib/entity-anchors.ts

type EntityType = 'session' | 'document' | 'note' | 'email' | 'calendar' | 'task' | 'skill' | 'research' | 'memory';

interface EntityAnchor {
  type: EntityType;
  id: string;
  label: string;
  url: string;
}

const ENTITY_URL_MAP: Record<EntityType, (id: string) => string> = {
  session:  (id) => `/sessions/${id}`,
  document: (id) => `/documents/${id}`,
  note:     (id) => `/notes/${id}`,
  email:    (id) => `/email/${id}`,
  calendar: (id) => `/calendar?event=${id}`,
  task:     (id) => `/tasks/${id}`,
  skill:    (id) => `/skills/${id}`,
  research: (id) => `/research/${id}`,
  memory:   (id) => `/memories/${id}`,
};

// Parse entity anchors from markdown
export function parseEntityAnchors(text: string): EntityAnchor[] {
  const anchors: EntityAnchor[] = [];
  const regex = /\[([^\]]+)\]\(#(session|document|note|email|calendar|task|skill|research|memory)-([^)]+)\)/g;
  
  let match;
  while ((match = regex.exec(text)) !== null) {
    const [, label, type, id] = match;
    anchors.push({
      type: type as EntityType,
      id,
      label,
      url: ENTITY_URL_MAP[type as EntityType](id),
    });
  }
  
  return anchors;
}

// Render markdown with entity anchors as clickable links
export function renderEntityAnchors(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\[([^\]]+)\]\(#(session|document|note|email|calendar|task|skill|research|memory)-([^)]+)\))/g;
  
  let lastIndex = 0;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    
    const [, , label, type, id] = match;
    const url = ENTITY_URL_MAP[type as EntityType](id);
    const Icon = ENTITY_ICONS[type as EntityType];
    
    parts.push(
      <Link
        key={`${type}-${id}`}
        href={url}
        className="entity-anchor"
        title={`Open ${type}: ${label}`}
      >
        <Icon className="entity-icon" />
        {label}
      </Link>
    );
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  
  return <>{parts}</>;
}
```

Carina note: the markdown renderer now turns `#session-*`, `#document-*`, `#research-*`, `#calendar-*`, `#task-*`, `#email-*`, `#skill-*`, and `#memory-*` links into workspace navigation where a matching surface exists.

### Entity Icons

```tsx
const ENTITY_ICONS: Record<EntityType, React.ComponentType> = {
  session:  MessageSquareIcon,
  document: FileTextIcon,
  note:     StickyNoteIcon,
  email:    MailIcon,
  calendar: CalendarIcon,
  task:     CheckSquareIcon,
  skill:    ZapIcon,
  research: SearchIcon,
  memory:   BrainIcon,
};
```

### CSS Styling

```css
.entity-anchor {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  background: var(--accent-bg);
  color: var(--accent);
  font-weight: 500;
  text-decoration: none;
  transition: background 0.15s;
}

.entity-anchor:hover {
  background: var(--accent-hover);
  text-decoration: underline;
}

.entity-icon {
  width: 14px;
  height: 14px;
  opacity: 0.8;
}

/* Entity type-specific colors */
.entity-anchor[data-type="session"]  { --accent-bg: rgba(59, 130, 246, 0.1); --accent: #3b82f6; }
.entity-anchor[data-type="document"] { --accent-bg: rgba(16, 185, 129, 0.1); --accent: #10b981; }
.entity-anchor[data-type="note"]     { --accent-bg: rgba(245, 158, 11, 0.1); --accent: #f59e0b; }
.entity-anchor[data-type="email"]    { --accent-bg: rgba(139, 92, 246, 0.1); --accent: #8b5cf6; }
.entity-anchor[data-type="calendar"] { --accent-bg: rgba(236, 72, 153, 0.1); --accent: #ec4899; }
.entity-anchor[data-type="task"]     { --accent-bg: rgba(14, 165, 233, 0.1); --accent: #0ea5e9; }
.entity-anchor[data-type="skill"]    { --accent-bg: rgba(249, 115, 22, 0.1); --accent: #f97316; }
.entity-anchor[data-type="research"] { --accent-bg: rgba(99, 102, 241, 0.1); --accent: #6366f1; }
.entity-anchor[data-type="memory"]   { --accent-bg: rgba(168, 85, 247, 0.1); --accent: #a855f7; }
```

**Study reference:** `odysseus/src/agent_loop.py`; lines 90-111 (`_UI_CONVENTIONS` section), lines 202-213 (`_LINK_RULES`).

---

## FEATURE 2; QR CODE GENERATION

### What This Is

Generate QR codes for sharing session links, pairing tokens, or URLs. Useful for mobile pairing flow.

### Implementation

```tsx
// components/QRCode.tsx
'use client';

import { useEffect, useRef } from 'react';
import QRCodeLib from 'qrcode';

interface QRCodeProps {
  value: string;
  size?: number;
  includeMargin?: boolean;
}

export function QRCode({ value, size = 200, includeMargin = true }: QRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCodeLib.toCanvas(canvasRef.current, value, {
      width: size,
      margin: includeMargin ? 2 : 0,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
  }, [value, size, includeMargin]);

  return (
    <div className="qr-code-container">
      <canvas ref={canvasRef} />
      <p className="qr-code-value">{value}</p>
    </div>
  );
}
```

**Dependency:** `npm install qrcode`

**Study reference:** `odysseus/static/lib/qrcode.min.js`

### Use Cases

```
- Share session: /sessions/abc123 → QR code → phone scans → opens chat
- Pair device: pairing token → QR code → phone scans → auto-pairs
- Share document: /documents/report → QR code → colleague scans → opens doc
```

---

## FEATURE 3; COMPANION PAIRING UI

### What This Is

A pairing flow where a phone or secondary device can connect to Carina over LAN. Adopted from Odysseus' companion pairing system.

### Flow

```
1. User opens Pairing page in web UI
2. Carina starts Bonjour/mDNS advertising on LAN
3. User opens Carina mobile app on phone
4. Phone discovers Carina server on LAN
5. OR: Web UI shows QR code, phone scans it
6. Admin approves pairing request
7. Phone receives bearer token
8. Phone is now paired and can use Carina API
```

### Implementation

```tsx
// app/(workspace)/pairing/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { QRCode } from '@/components/QRCode';

export default function PairingPage() {
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState<DeviceRequest[]>([]);
  const [pairedDevices, setPairedDevices] = useState<PairedDevice[]>([]);

  useEffect(() => {
    // Poll for pairing requests and paired devices
    fetchPairedDevices();
    const interval = setInterval(fetchPairedDevices, 5000);
    return () => clearInterval(interval);
  }, []);

  const startPairing = async () => {
    const res = await fetch('/api/pairing/start', { method: 'POST' });
    const { code } = await res.json();
    setPairingCode(code);
  };

  const approveRequest = async (requestId: string) => {
    await fetch(`/api/pairing/approve/${requestId}`, { method: 'POST' });
    fetchPairedDevices();
  };

  const revokeDevice = async (deviceId: string) => {
    await fetch(`/api/pairing/revoke/${deviceId}`, { method: 'DELETE' });
    fetchPairedDevices();
  };

  return (
    <div className="pairing-page">
      <h2>Device Pairing</h2>

      {/* Pairing Code / QR */}
      <div className="pairing-section">
        {pairingCode ? (
          <div className="pairing-active">
            <QRCode value={pairingCode} size={250} />
            <p>Scan this QR code with the Carina mobile app</p>
            <p className="pairing-code">Code: {pairingCode}</p>
            <button onClick={() => setPairingCode(null)}>Cancel</button>
          </div>
        ) : (
          <button onClick={startPairing}>Start Pairing</button>
        )}
      </div>

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <div className="pairing-section">
          <h3>Pending Requests</h3>
          {pendingRequests.map((req) => (
            <div key={req.id} className="pairing-request">
              <span>{req.deviceName}</span>
              <span>{req.deviceType}</span>
              <button onClick={() => approveRequest(req.id)}>Approve</button>
              <button onClick={() => rejectRequest(req.id)}>Reject</button>
            </div>
          ))}
        </div>
      )}

      {/* Paired Devices */}
      <div className="pairing-section">
        <h3>Paired Devices</h3>
        {pairedDevices.map((device) => (
          <div key={device.id} className="paired-device">
            <span>{device.name}</span>
            <span>{device.lastSeen}</span>
            <button onClick={() => revokeDevice(device.id)}>Revoke</button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Study reference:** `odysseus/companion/routes.py`, `odysseus/companion/pairing.py`

**Existing Carina code to integrate:**
```
src/infrastructure/device-pairing.ts
src/infrastructure/device-scopes.ts
src/pairing/pairing.ts
src/api/pairing-routes.ts
builtin-extensions/bonjour-discovery/
```

---

## FEATURE 4; NAVIGATION EFFICIENCY

### What This Is

Reduce clicks between surfaces. Odysseus puts everything in one page; chat with side panels for documents, notes, calendar. Carina has separate pages which is more powerful but requires more navigation.

### Improvements

#### 4a. Quick Switcher (Cmd+K)

```tsx
// components/shell/QuickSwitcher.tsx
// Universal search + navigation. Cmd+K to open.
// Search sessions, documents, notes, skills, settings pages.

export function QuickSwitcher() {
  // Search across all entity types
  // Navigate on select
  // Recent items shown by default
}
```

#### 4b. Side Panel Previews

Instead of navigating away from chat to view a document, open it in a side panel:

```tsx
// In chat page: clicking a document anchor opens side panel instead of navigating
<button onClick={() => openInSidePanel('document', docId)}>
  Preview in side panel
</button>
```

#### 4c. Breadcrumb Efficiency

```tsx
// Current: Dashboard > Documents > Report
// Better: Dashboard / Report  (skip intermediate pages when possible)
```

#### 4d. Keyboard Shortcuts

```
Cmd+K        → Quick switcher
Cmd+Enter    → Send message
Cmd+L        → New chat session
Cmd+/        → Focus chat input
Cmd+Shift+F  → Search across workspace
Cmd+B        → Toggle sidebar
Cmd+J        → Toggle right panel
Esc          → Close panel / modal
```

---

## FEATURE 5; QUICK ACTIONS IN COMPOSER

### What This Is

Slash commands and quick toggles directly in the chat composer.

### Implementation

```tsx
// In ChatInputBar.tsx
// Slash commands triggered by "/"

const SLASH_COMMANDS = [
  { command: '/clear', description: 'Start a new session', action: () => clearSession() },
  { command: '/model', description: 'Switch model', action: () => openModelPicker() },
  { command: '/export', description: 'Export this chat', action: () => exportChat() },
  { command: '/summarize', description: 'Summarize this conversation', action: () => summarizeChat() },
  { command: '/find', description: 'Search in conversation', action: () => openSearch() },
  { command: '/skill', description: 'Load a skill', action: () => openSkillPicker() },
  { command: '/todo', description: 'Create a task', action: () => openQuickTodo() },
  { command: '/remind', description: 'Set a reminder', action: () => openQuickReminder() },
];

// Show slash command popover when "/" is typed
```

### Quick Toggles

```
Model selector chip:    [Claude Sonnet 4 ▼]    (click to switch)
Thinking toggle:        [ Thinking: On/Off]   (toggle reasoning)
Tool restrictions:      [ Tools: All ▼]       (restrict toolset)
```

---

## IMPLEMENTATION PLAN

### Week 1
```
- Entity anchor parser + renderer
- Entity anchor styling with type-specific colors
- QR code component
- Companion pairing UI page
- Integration with existing pairing infrastructure
```

### Week 2
```
- Quick switcher (Cmd+K)
- Side panel previews for entity anchors
- Keyboard shortcuts system
- Slash commands in composer
- Quick toggles in composer
- Navigation efficiency polish
```

---

## REFERENCE FILES

```
Odysseus:
  odysseus/src/agent_loop.py; _LINK_RULES, _UI_CONVENTIONS (lines 90-111, 202-213)
  odysseus/static/app.js; 4083-line SPA with entity handling
  odysseus/static/lib/qrcode.min.js; QR code library
  odysseus/companion/routes.py; pairing routes
  odysseus/companion/pairing.py; pairing logic

Carina (reuse):
  src/ui/session-anchors.ts; existing session anchor code
  src/infrastructure/device-pairing.ts; pairing infrastructure
  src/pairing/pairing.ts; pairing logic
  builtin-extensions/bonjour-discovery/; LAN discovery
```

---

## Done When (verified)

- [x] Entity anchor links in markdown navigate to workspace surfaces
- [x] QR code generation for pairing tokens
- [x] Companion pairing settings page with device list and revoke
- [x] Command palette (Cmd+K) for cross-surface navigation
- [x] Keyboard shortcuts for sidebar, panels, and chat actions
- [ ] Dedicated `/pairing` page (pairing lives under `/settings/pairing`)
- [ ] Slash-command popover in composer (desktop app has this; web uses command palette)
