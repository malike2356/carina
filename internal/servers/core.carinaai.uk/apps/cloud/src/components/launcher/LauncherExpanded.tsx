import { OrbitalDiagram } from './OrbitalDiagram';
import { SystemStatusPanel } from './SystemStatusPanel';
import { LauncherWithSidebar } from './LauncherSidebar';
import { useSystemStatus } from '../../hooks/useSystemStatus';

type NavPath = '/launcher' | '/workspaces' | '/projects' | '/memory' | '/skills' | '/channels' | '/scout' | '/settings';

interface Props {
  activePath: NavPath;
  onNavigate: (path: NavPath) => void;
}

export function LauncherExpanded({ activePath, onNavigate }: Props) {
  const { status } = useSystemStatus();

  const handleSelectSection = (sectionId: string) => {
    const sectionMap: Record<string, NavPath> = {
      memory: '/memory',
      skills: '/skills',
      scout: '/scout',
      channels: '/channels',
      projects: '/projects',
      voice: '/settings',
    };
    const path = sectionMap[sectionId];
    if (path) onNavigate(path);
  };

  return (
    <LauncherWithSidebar activePath={activePath} onNavigate={onNavigate}>
      <div className="launcher-expanded-content">
        <OrbitalDiagram onSelectSection={handleSelectSection} version={status?.version} />
        <SystemStatusPanel />
      </div>
    </LauncherWithSidebar>
  );
}
