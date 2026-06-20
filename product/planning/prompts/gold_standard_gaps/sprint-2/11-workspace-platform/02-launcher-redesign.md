# Prompt 02: Workspace Launcher Redesign

## Context

The current web UI launches into a chat interface. The Workspace Platform vision requires
a proper launcher: a workspace home that shows active projects, recent sessions, memory
stats, and quick-start actions. This is the "desktop" the user lands on before entering
a session.

## What to Build

### 1. Workspace home layout

Replace the current entry point at `apps/cloud/src/App.tsx` with a launcher screen shown
when no session is active:

```
+--------------------------------------------------+
| Carina Workspace              [Settings] [Scout] |
+--------------------------------------------------+
| Good morning. You have 3 active projects.        |
|                                                  |
| RECENT PROJECTS                                  |
| +----------+ +----------+ +----------+           |
| | ABBIS    | | Scout    | | Novalent |           |
| | 2h ago   | | 1d ago   | | 3d ago   |           |
| +----------+ +----------+ +----------+           |
|                                                  |
| RECENT SESSIONS                                  |
| > CVE investigation (billing module)    2h ago   |
| > Nginx rate-limiting config            4h ago   |
| > ABBIS deployment debug                1d ago   |
|                                                  |
| QUICK START                                      |
| [New Session]  [Run Skill]  [Open Terminal]      |
|                [Import File]                     |
+--------------------------------------------------+
| Memories: 47   Tools: 71   Skills: 96            |
+--------------------------------------------------+
```

### 2. WorkspaceLauncher component

Create `apps/cloud/src/components/WorkspaceLauncher.tsx`:
```tsx
export function WorkspaceLauncher({ onStartSession }: { onStartSession: () => void }) {
  const { profile } = useUserProfile();
  const { projects } = useProjects();
  const { sessions } = useRecentSessions(5);
  const { stats } = useWorkspaceStats();

  const greeting = getGreeting(profile.preferences.timezone);

  return (
    <div className="workspace-launcher">
      <header className="launcher-header">
        <h1 className="workspace-title">Carina Workspace</h1>
        <div className="header-actions">
          <ScoutStatusChip />
          <button onClick={() => navigate('/settings')}>Settings</button>
        </div>
      </header>

      <div className="greeting">
        {greeting}. You have {projects.active.length} active projects.
      </div>

      <section className="projects-section">
        <h2>Recent Projects</h2>
        <div className="project-cards">
          {projects.recent.map(p => (
            <ProjectCard key={p.id} project={p} onClick={() => openProject(p.id)} />
          ))}
          <NewProjectCard onClick={onCreateProject} />
        </div>
      </section>

      <section className="sessions-section">
        <h2>Recent Sessions</h2>
        {sessions.map(s => <SessionRow key={s.id} session={s} />)}
      </section>

      <footer className="workspace-stats">
        Memories: {stats.memories} | Tools: {stats.tools} | Skills: {stats.skills}
      </footer>
    </div>
  );
}
```

### 3. Project concept

A Project groups sessions, memories, and files under a shared context:
```typescript
export type Project = {
  id: string;
  name: string;
  description?: string;
  distroId?: string; // if running a specific distro (e.g. 'abbis')
  color: string; // for card color-coding
  icon?: string; // initials or emoji
  createdAt: Date;
  lastActivityAt: Date;
  sessionCount: number;
};
```

Sessions can be linked to a project. Project context is automatically injected into
session system prompts.

### 4. Quick-start actions

- "New Session" - opens standard chat interface
- "Run Skill" - opens skill picker modal then drops into session with skill active
- "Open Terminal" - opens PTY bridge directly (no chat)
- "Import File" - opens file browser to attach a file, then starts session with file context

### 5. Keyboard navigation

The launcher must be keyboard-friendly:
- `n` - New session
- `p` - Project picker
- `/` or `Ctrl+K` - Search sessions/memories
- Arrow keys - navigate project cards
- Enter - open selected project

## Verification Checklist

- [ ] Landing on the web UI shows the launcher (not a blank chat)
- [ ] Recent projects show with correct last-activity time
- [ ] Clicking a recent session opens that session
- [ ] "New Session" button starts a fresh session and exits launcher
- [ ] `n` keyboard shortcut starts a new session from the launcher
- [ ] Scout status chip shows current score in the launcher header

## Files to Create or Modify

- CREATE `apps/cloud/src/components/WorkspaceLauncher.tsx`
- CREATE `apps/cloud/src/components/ProjectCard.tsx`
- CREATE `apps/cloud/src/hooks/useProjects.ts`
- CREATE `apps/cloud/src/hooks/useWorkspaceStats.ts`
- MODIFY `apps/cloud/src/App.tsx` - show WorkspaceLauncher when no active session
- CREATE `src/api/workspace.ts` - projects CRUD and stats endpoint
