import '../../launcher.css';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useRecentProjects } from '../../hooks/useRecentProjects';
import { useProjects } from '../../hooks/useProjects';
import { getTimeGreeting } from '../../lib/time';
import { ProjectResumeCard, ProjectCardSkeleton } from './ProjectResumeCard';
import { LauncherStatusBar } from './LauncherStatusBar';

interface Props {
  onContinue: () => void;
  onSelectProject: (id: string) => void;
  onExpand: () => void;
  onViewAllProjects: () => void;
}

export function LauncherPrimary({ onContinue, onSelectProject, onExpand, onViewAllProjects }: Props) {
  const { user } = useCurrentUser();
  const { recentProjects, loading } = useRecentProjects(3);
  const { totalCount } = useProjects();
  const greeting = getTimeGreeting();

  return (
    <div className="launcher-shell">
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
        <div className="launcher-left" onClick={onExpand} title="Expand to full dashboard">
          <div className="launcher-logo-wrap">
            <img
              src="/logo/carina_logo_1.png"
              alt="Carina"
              className="launcher-logo-icon"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <span className="launcher-wordmark">Carina</span>
            <span className="launcher-tagline">ONE MEMORY. ONE AGENT. EVERYWHERE.</span>
          </div>
          <div className="launcher-greeting">
            <h2 className="greeting-text">
              {greeting}, {user?.firstName ?? user?.email?.split('@')[0] ?? 'there'}.
            </h2>
            <p className="greeting-sub">{totalCount} active project{totalCount !== 1 ? 's' : ''}.</p>
          </div>
        </div>

        <div className="launcher-right">
          <div className="launcher-right-inner">
            <p className="section-label">PICK UP WHERE YOU LEFT OFF</p>

            <div className="project-list">
              {loading
                ? [0, 1, 2].map(i => <ProjectCardSkeleton key={i} />)
                : recentProjects.length > 0
                  ? recentProjects.map(p => (
                      <ProjectResumeCard
                        key={p.id}
                        project={p}
                        onClick={() => onSelectProject(p.id)}
                      />
                    ))
                  : <p style={{ color: '#4a6a8a', fontSize: 13 }}>No projects yet. Start a new one below.</p>
              }
            </div>

            <button className="view-all-link" type="button" onClick={onViewAllProjects}>
              View all projects
              <span className="projects-badge">{totalCount}</span>
            </button>

            <button className="continue-work-btn" type="button" onClick={onContinue}>
              CONTINUE WORK <span>&#8594;</span>
            </button>
          </div>
        </div>
      </div>

      <LauncherStatusBar />
    </div>
  );
}
