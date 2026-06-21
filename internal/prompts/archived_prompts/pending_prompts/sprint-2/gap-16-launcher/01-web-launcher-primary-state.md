# Prompt 01: Web Launcher - Primary (Splash) State


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Reference

Design: `01-launcher_primary.png`
Logo: `carina_logo_1.png` (icon) and `carina_logo_rectangular.png` (icon + wordmark)

## Context

This is the first screen a user sees when they open the Carina web app and have no active
session. It replaces the current blank chat screen at `apps/cloud/src/App.tsx` when
`activeSession === null`.

The primary state is a two-column layout: left panel is identity/branding, right panel
is workspace resumption.

## What to Build

### 1. File location

Create `apps/cloud/src/components/launcher/LauncherPrimary.tsx`

This is the default export rendered when no session is active:
```tsx
// In apps/cloud/src/App.tsx
import { LauncherPrimary } from './components/launcher/LauncherPrimary';

if (!activeSession) {
  return <LauncherPrimary onContinue={resumeLastSession} onSelectProject={openProject} />;
}
```

### 2. Outer shell

```tsx
<div className="launcher-shell">
  {/* macOS-style window chrome - only in browser, hidden in Tauri */}
  <div className="launcher-titlebar">
    <div className="titlebar-dots">
      <span className="dot dot-red" />
      <span className="dot dot-yellow" />
      <span className="dot dot-green" />
    </div>
    <span className="titlebar-label">CARINA LAUNCHER</span>
    <div className="titlebar-status">
      <span className="online-dot" />
      <span className="online-label">ONLINE</span>
    </div>
  </div>

  <div className="launcher-body">
    <LauncherLeftPanel />
    <LauncherRightPanel />
  </div>

  <LauncherStatusBar />
</div>
```

CSS for the shell (add to `apps/cloud/src/launcher.css` and import it):
```css
.launcher-shell {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  background: #060c18;
  color: #e8f0f8;
  font-family: Inter, system-ui, sans-serif;
  overflow: hidden;
}

.launcher-titlebar {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  background: #060c18;
  border-bottom: 1px solid #1a2b45;
  flex-shrink: 0;
  height: 44px;
}

.titlebar-dots { display: flex; gap: 8px; }
.dot { width: 13px; height: 13px; border-radius: 50%; }
.dot-red    { background: #ff5f57; }
.dot-yellow { background: #ffbd2e; }
.dot-green  { background: #28ca41; }

.titlebar-label {
  margin-left: 16px;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.12em;
  color: #4a6a8a;
  text-transform: uppercase;
}

.titlebar-status {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
}
.online-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #16c97e;
  box-shadow: 0 0 6px #16c97e;
}
.online-label { font-size: 11px; color: #16c97e; letter-spacing: 0.08em; }

.launcher-body {
  display: grid;
  grid-template-columns: 380px 1fr;
  flex: 1;
  overflow: hidden;
}
```

### 3. Left panel - identity and greeting

```tsx
function LauncherLeftPanel() {
  const { user } = useCurrentUser();
  const { projects } = useProjects();
  const greeting = getTimeGreeting(); // "Good morning", "Good afternoon", "Good evening"

  return (
    <div className="launcher-left">
      <div className="launcher-logo-wrap">
        <img src="/logo/carina_logo_1.png" alt="Carina" className="launcher-logo-icon" />
        <span className="launcher-wordmark">Carina</span>
        <span className="launcher-tagline">ONE MEMORY. ONE AGENT. EVERYWHERE.</span>
      </div>

      <div className="launcher-greeting">
        <h2 className="greeting-text">{greeting}, {user.firstName}.</h2>
        <p className="greeting-sub">{projects.active.length} active projects.</p>
      </div>
    </div>
  );
}
```

CSS for left panel:
```css
.launcher-left {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 48px 48px;
  border-right: 1px solid #1a2b45;
  gap: 40px;
}

.launcher-logo-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}

.launcher-logo-icon {
  width: 120px;
  height: 120px;
  object-fit: contain;
}

.launcher-wordmark {
  font-size: 38px;
  font-weight: 700;
  color: #e8f0f8;
  letter-spacing: -0.02em;
  line-height: 1;
}

.launcher-tagline {
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: #4a6a8a;
}

.greeting-text {
  font-size: 24px;
  font-weight: 600;
  color: #e8f0f8;
  margin: 0 0 6px 0;
}

.greeting-sub {
  font-size: 14px;
  color: #6b8aaa;
  margin: 0;
}
```

### 4. Right panel - "Pick up where you left off"

```tsx
function LauncherRightPanel({ onContinue, onSelectProject }) {
  const { recentProjects, lastProject } = useRecentProjects(3);

  return (
    <div className="launcher-right">
      <div className="launcher-right-inner">
        <p className="section-label">PICK UP WHERE YOU LEFT OFF</p>

        <div className="project-list">
          {recentProjects.map(p => (
            <ProjectResumeCard key={p.id} project={p} onClick={() => onSelectProject(p.id)} />
          ))}
        </div>

        <button className="view-all-link" onClick={() => openProjectsView()}>
          View all projects
          <span className="projects-badge">{totalProjectCount}</span>
        </button>

        <button className="continue-work-btn" onClick={onContinue}>
          CONTINUE WORK
          <span className="continue-arrow">&#8594;</span>
        </button>
      </div>
    </div>
  );
}
```

CSS for right panel:
```css
.launcher-right {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px;
}

.launcher-right-inner {
  width: 100%;
  max-width: 440px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #4a6a8a;
  margin: 0;
}

.project-list { display: flex; flex-direction: column; gap: 8px; }

.continue-work-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: 100%;
  padding: 18px 24px;
  background: #00d4ff;
  color: #060c18;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  margin-top: 8px;
  transition: background 0.15s, box-shadow 0.15s;
}
.continue-work-btn:hover {
  background: #33ddff;
  box-shadow: 0 0 24px rgba(0, 212, 255, 0.35);
}

.view-all-link {
  display: flex; align-items: center; gap: 8px;
  background: none; border: none; cursor: pointer;
  color: #00d4ff; font-size: 13px;
}
.projects-badge {
  background: #1a2b45; color: #6b8aaa;
  font-size: 11px; padding: 2px 8px; border-radius: 10px;
}
```

### 5. Project resume card

```tsx
function ProjectResumeCard({ project, onClick }) {
  return (
    <button className="project-card" onClick={onClick}>
      <div className="project-icon" style={{ background: project.color }}>
        <img src={project.iconUrl} alt="" width={20} height={20} />
      </div>
      <div className="project-info">
        <span className="project-name">{project.name}</span>
        <span className="project-type">{project.workspaceType}</span>
      </div>
      <span className="project-time">{project.lastActivityAgo}</span>
      <span className="project-chevron">&#8250;</span>
    </button>
  );
}
```

CSS:
```css
.project-card {
  display: grid;
  grid-template-columns: 44px 1fr auto 20px;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: #0d1829;
  border: 1px solid #1a2b45;
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  width: 100%;
  transition: background 0.12s, border-color 0.12s;
}
.project-card:hover {
  background: #121f35;
  border-color: #2a3f5f;
}

.project-icon {
  width: 40px; height: 40px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}

.project-name { display: block; font-size: 14px; font-weight: 600; color: #e8f0f8; }
.project-type { display: block; font-size: 12px; color: #6b8aaa; margin-top: 2px; }
.project-time { font-size: 12px; color: #6b8aaa; white-space: nowrap; }
.project-chevron { font-size: 18px; color: #4a6a8a; }
```

### 6. Status bar (bottom)

```tsx
function LauncherStatusBar() {
  const { scout, encrypted, synced, version } = useSystemStatus();

  return (
    <div className="launcher-statusbar">
      <StatusItem icon="shield" color="#16c97e" label={`Scout: ${scout.status}`} />
      <StatusItem icon="lock" color="#6b8aaa" label="Encrypted" />
      <StatusItem icon="sync" color="#6b8aaa" label="Synced" />
      <StatusItem icon="version" color="#6b8aaa" label={`v${version}`} className="ml-auto" />
    </div>
  );
}
```

CSS:
```css
.launcher-statusbar {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 10px 24px;
  background: #060c18;
  border-top: 1px solid #1a2b45;
  flex-shrink: 0;
  height: 40px;
}
.status-item { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #6b8aaa; }
```

## Verification Checklist

- [ ] Web app shows LauncherPrimary when no active session
- [ ] Logo image loads from `/logo/carina_logo_1.png`
- [ ] Greeting changes based on time of day
- [ ] User first name appears in greeting ("Good evening, Laud.")
- [ ] Three most-recently-active projects appear in order
- [ ] Last activity time shown as relative ("2 min ago", "1 hr ago")
- [ ] "CONTINUE WORK" button resumes the most recent session
- [ ] Status bar shows Scout protection status with green dot
- [ ] Hover on project card shows highlight
- [ ] Hover on CONTINUE WORK button shows cyan glow

## Files to Create or Modify

- CREATE `apps/cloud/src/components/launcher/LauncherPrimary.tsx`
- CREATE `apps/cloud/src/components/launcher/ProjectResumeCard.tsx`
- CREATE `apps/cloud/src/components/launcher/LauncherStatusBar.tsx`
- CREATE `apps/cloud/src/launcher.css`
- MODIFY `apps/cloud/src/App.tsx` - render LauncherPrimary when no active session
- COPY `carina_logo_1.png` -> `apps/cloud/public/logo/carina_logo_1.png`
- COPY `carina_logo_rectangular.png` -> `apps/cloud/public/logo/carina_logo_rectangular.png`
