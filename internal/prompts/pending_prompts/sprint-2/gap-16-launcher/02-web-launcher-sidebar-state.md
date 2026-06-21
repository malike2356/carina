# Prompt 02: Web Launcher - Sidebar Navigation State


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Reference

Design: `02-launcher_siderbar.png`

## Context

When the user clicks anywhere in the left panel (or a sidebar toggle button) the launcher
transitions to the sidebar state. The branding panel collapses to a narrow sidebar with
icon-and-label nav links. The right "PICK UP WHERE YOU LEFT OFF" panel stays identical.

This state also serves as the persistent layout once the user is inside any launcher
sub-view (Workspaces, Projects, Memory, etc.).

## What to Build

### 1. Sidebar structure

Create `apps/cloud/src/components/launcher/LauncherSidebar.tsx`:
```tsx
export function LauncherWithSidebar({ children, activePath, onNavigate }) {
  const { user } = useCurrentUser();

  return (
    <div className="launcher-shell">
      <LauncherTitlebar showLabel={false} />
      <div className="launcher-body-sidebar">
        <aside className="launcher-sidebar">
          <SidebarBrand />
          <SidebarNav activePath={activePath} onNavigate={onNavigate} />
          <SidebarUserFooter user={user} />
        </aside>
        <main className="launcher-sidebar-content">
          {children}
        </main>
      </div>
      <LauncherStatusBar />
    </div>
  );
}
```

### 2. Sidebar brand block (top of sidebar)

```tsx
function SidebarBrand() {
  return (
    <div className="sidebar-brand">
      <img src="/logo/carina_logo_1.png" alt="Carina" className="sidebar-logo" />
      <div className="sidebar-brand-text">
        <span className="sidebar-brand-name">Carina</span>
        <span className="sidebar-brand-workspace">Laud's Workspace</span>
      </div>
    </div>
  );
}
```

CSS:
```css
.launcher-sidebar {
  width: 200px;
  flex-shrink: 0;
  background: #080f1e;
  border-right: 1px solid #1a2b45;
  display: flex;
  flex-direction: column;
  padding: 20px 0;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px 20px 16px;
  border-bottom: 1px solid #1a2b45;
  margin-bottom: 8px;
}

.sidebar-logo { width: 32px; height: 32px; object-fit: contain; }

.sidebar-brand-name {
  display: block;
  font-size: 15px;
  font-weight: 700;
  color: #e8f0f8;
  line-height: 1.2;
}

.sidebar-brand-workspace {
  display: block;
  font-size: 11px;
  color: #6b8aaa;
}
```

### 3. Sidebar navigation items

Navigation items (in order as shown in `02-launcher_siderbar.png`):
```tsx
const NAV_ITEMS = [
  { href: '/launcher',    icon: HomeIcon,       label: 'Home'       },
  { href: '/workspaces',  icon: GridIcon,       label: 'Workspaces' },
  { href: '/projects',    icon: FolderIcon,     label: 'Projects'   },
  { href: '/memory',      icon: DatabaseIcon,   label: 'Memory'     },
  { href: '/skills',      icon: SparkleIcon,    label: 'Skills'     },
  { href: '/channels',    icon: ChatBubbleIcon, label: 'Channels'   },
  { href: '/scout',       icon: ShieldIcon,     label: 'Scout'      },
  { href: '/settings',    icon: GearIcon,       label: 'Settings'   },
];

function SidebarNav({ activePath, onNavigate }) {
  return (
    <nav className="sidebar-nav">
      {NAV_ITEMS.map(item => (
        <button
          key={item.href}
          className={`sidebar-nav-item ${activePath === item.href ? 'active' : ''}`}
          onClick={() => onNavigate(item.href)}
        >
          <item.icon size={18} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
```

Use icons from `lucide-react` (already a dependency):
- Home: `Home`
- Workspaces: `LayoutGrid`
- Projects: `FolderOpen`
- Memory: `Brain`
- Skills: `Zap`
- Channels: `MessageSquare`
- Scout: `Shield`
- Settings: `Settings`

CSS:
```css
.sidebar-nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 8px;
}

.sidebar-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: #6b8aaa;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  width: 100%;
  transition: background 0.12s, color 0.12s;
}
.sidebar-nav-item:hover {
  background: #0d1829;
  color: #c0d4e8;
}
.sidebar-nav-item.active {
  background: #0d1829;
  color: #00d4ff;
  border-left: 2px solid #00d4ff;
  padding-left: 10px;
}
.sidebar-nav-item svg { flex-shrink: 0; }
```

### 4. Sidebar user footer

The "L" avatar with name and role shown at the bottom of the sidebar:
```tsx
function SidebarUserFooter({ user }) {
  return (
    <div className="sidebar-user">
      <div className="sidebar-user-avatar">
        {user.avatarUrl
          ? <img src={user.avatarUrl} alt="" />
          : <span>{user.firstName[0]}</span>
        }
      </div>
      <div className="sidebar-user-info">
        <span className="sidebar-user-name">{user.firstName}</span>
        <span className="sidebar-user-role">{user.role}</span>
      </div>
    </div>
  );
}
```

CSS:
```css
.sidebar-user {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px;
  border-top: 1px solid #1a2b45;
  margin-top: auto;
}

.sidebar-user-avatar {
  width: 34px; height: 34px; border-radius: 50%;
  background: #1a2b45;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; font-weight: 700; color: #00d4ff;
  flex-shrink: 0;
  overflow: hidden;
}
.sidebar-user-avatar img { width: 100%; height: 100%; object-fit: cover; }

.sidebar-user-name { display: block; font-size: 13px; font-weight: 600; color: #e8f0f8; }
.sidebar-user-role { display: block; font-size: 11px; color: #6b8aaa; }
```

### 5. Sidebar content area (right of sidebar) - Home view

When `activePath === '/launcher'` the content area shows the same "Pick up where you left off"
panel as the primary state, but now filling the remaining width:
```tsx
function LauncherHomeContent({ onContinue, onSelectProject }) {
  const { recentProjects } = useRecentProjects(3);
  const { totalCount } = useProjects();

  return (
    <div className="launcher-home-content">
      <p className="section-label">PICK UP WHERE YOU LEFT OFF</p>
      <div className="project-list">
        {recentProjects.map(p => (
          <ProjectResumeCard key={p.id} project={p} onClick={() => onSelectProject(p.id)} />
        ))}
      </div>
      <button className="view-all-link" onClick={() => onNavigate('/projects')}>
        View all projects
        <span className="projects-badge">{totalCount}</span>
      </button>
      <button className="continue-work-btn" onClick={onContinue}>
        CONTINUE WORK <span>&#8594;</span>
      </button>
    </div>
  );
}
```

CSS:
```css
.launcher-sidebar-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px;
  overflow-y: auto;
}

.launcher-home-content {
  width: 100%;
  max-width: 440px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
```

### 6. State transition: primary -> sidebar

The left panel in the primary state has a subtle "expand" affordance. When clicked (or
when the user starts interacting beyond the initial CONTINUE button), transition to sidebar:
```tsx
const [mode, setMode] = useState<'primary' | 'sidebar' | 'expanded'>('primary');

// In primary state, clicking the left panel expands to sidebar
<div className="launcher-left" onClick={() => setMode('sidebar')}>
```

Animate the transition with CSS:
```css
.launcher-body { transition: grid-template-columns 0.25s ease; }
/* primary: 380px 1fr -> sidebar: 200px 1fr */
```

## Verification Checklist

- [ ] Clicking the left panel in primary state smoothly transitions to sidebar layout
- [ ] Active nav item shows cyan left-border and cyan text
- [ ] "Home" is active by default when in launcher home view
- [ ] User avatar shows first letter of user's first name if no avatar image
- [ ] Sidebar is 200px wide, does not collapse on narrow screens (minimum 800px window)
- [ ] Scout, Channels, Memory nav items navigate to their respective launcher sub-views

## Files to Create or Modify

- CREATE `apps/cloud/src/components/launcher/LauncherSidebar.tsx`
- CREATE `apps/cloud/src/components/launcher/SidebarNav.tsx`
- MODIFY `apps/cloud/src/components/launcher/LauncherPrimary.tsx` - add onClick to left panel
- MODIFY `apps/cloud/src/launcher.css` - add sidebar and nav CSS
