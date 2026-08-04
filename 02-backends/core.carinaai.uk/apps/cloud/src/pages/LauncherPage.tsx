import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LauncherPrimary } from '../components/launcher/LauncherPrimary';
import { LauncherExpanded } from '../components/launcher/LauncherExpanded';
import { LauncherWithSidebar } from '../components/launcher/LauncherSidebar';
import { useRecentProjects } from '../hooks/useRecentProjects';
import { useProjects } from '../hooks/useProjects';
import { ProjectResumeCard, ProjectCardSkeleton } from '../components/launcher/ProjectResumeCard';

type Mode = 'primary' | 'sidebar' | 'expanded';
type NavPath = '/launcher' | '/workspaces' | '/projects' | '/memory' | '/skills' | '/channels' | '/scout' | '/settings';

export function LauncherPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('primary');
  const [activePath, setActivePath] = useState<NavPath>('/launcher');

  const handleContinue = () => navigate('/dashboard');
  const handleSelectProject = (_id: string) => navigate('/dashboard');

  const handleNavigate = (path: NavPath) => {
    setActivePath(path);
    if (path === '/workspaces') {
      setMode('expanded');
    } else {
      setMode('sidebar');
    }
  };

  if (mode === 'primary') {
    return (
      <LauncherPrimary
        onContinue={handleContinue}
        onSelectProject={handleSelectProject}
        onExpand={() => setMode('expanded')}
        onViewAllProjects={() => { setActivePath('/workspaces'); setMode('expanded'); }}
      />
    );
  }

  if (mode === 'expanded' || activePath === '/workspaces') {
    return (
      <LauncherExpanded activePath={activePath} onNavigate={handleNavigate} />
    );
  }

  return (
    <LauncherWithSidebar activePath={activePath} onNavigate={handleNavigate}>
      <LauncherHomeContent onContinue={handleContinue} onSelectProject={handleSelectProject} />
    </LauncherWithSidebar>
  );
}

function LauncherHomeContent({ onContinue, onSelectProject }: { onContinue: () => void; onSelectProject: (id: string) => void }) {
  const { recentProjects, loading } = useRecentProjects(3);
  const { totalCount } = useProjects();

  return (
    <div className="launcher-home-content">
      <p className="section-label">PICK UP WHERE YOU LEFT OFF</p>
      <div className="project-list">
        {loading
          ? [0, 1, 2].map(i => <ProjectCardSkeleton key={i} />)
          : recentProjects.map(p => (
              <ProjectResumeCard key={p.id} project={p} onClick={() => onSelectProject(p.id)} />
            ))
        }
      </div>
      <button className="view-all-link" type="button">
        View all projects
        <span className="projects-badge">{totalCount}</span>
      </button>
      <button className="continue-work-btn" type="button" onClick={onContinue}>
        CONTINUE WORK <span>&#8594;</span>
      </button>
    </div>
  );
}
