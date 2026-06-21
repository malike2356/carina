export interface LauncherUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'Owner' | 'Admin' | 'Member';
  avatarUrl: string | null;
}

export interface LauncherProject {
  id: string;
  name: string;
  workspaceType: string;
  color: string;
  iconUrl: string | null;
  lastActivityAt: string;
  lastActivityAgo: string;
  active: boolean;
}

export interface SystemStatus {
  scout: { ok: boolean; status: string; lastScanAgo: string };
  version: string;
  encrypted: boolean;
  synced: boolean;
  uptime: string;
}

export interface SubsystemHealth {
  id: string;
  label: string;
  healthPercent: number;
}

export interface SystemHealth {
  overallPercent: number;
  subsystems: SubsystemHealth[];
  activeSessions: number;
  memoryCount: number;
  skillsLoaded: number;
  scoutLastScanAgo: string;
}
