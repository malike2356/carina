import type { LauncherProject } from '../../lib/types/launcher';

interface Props {
  project: LauncherProject;
  onClick: () => void;
}

const PROJECT_COLORS = ['#3b82f6', '#9b59f5', '#f59e0b', '#16c97e', '#00d4ff', '#ec4899'];

export function ProjectResumeCard({ project, onClick }: Props) {
  const initial = project.name[0]?.toUpperCase() ?? '?';
  return (
    <button className="project-card" onClick={onClick} type="button">
      <div className="project-icon" style={{ background: project.color || PROJECT_COLORS[0] }}>
        {project.iconUrl
          ? <img src={project.iconUrl} alt="" width={20} height={20} />
          : <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{initial}</span>
        }
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

export function ProjectCardSkeleton() {
  return (
    <div className="project-card project-card-skeleton">
      <div className="skeleton skeleton-icon" />
      <div className="skeleton-lines" style={{ flex: 1 }}>
        <div className="skeleton skeleton-line" style={{ width: '60%' }} />
        <div className="skeleton skeleton-line" style={{ width: '40%' }} />
      </div>
      <div className="skeleton skeleton-line" style={{ width: 50 }} />
      <span />
    </div>
  );
}
