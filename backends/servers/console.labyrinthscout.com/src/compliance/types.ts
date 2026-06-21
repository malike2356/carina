export interface GapAction {
  description: string;
  actionType: 'configure_sso' | 'enable_audit_logs' | 'upgrade_tier' | 'configure_monitoring';
  actionUrl: string;
}

export interface ControlCoverage {
  controlId: string;
  name: string;
  criteriaGroup: string;
  covered: boolean;
  evidenceCount: number;
  lastEvidenceAt: string | null;
  gapAction?: GapAction;
}

export interface TrendPoint {
  date: string;
  coveredControls: number;
  totalControls: number;
}

export interface ComplianceScore {
  configured: boolean;
  totalControls: number;
  coveredControls: number;
  coveragePercent: number;
  evidenceCount: number;
  evidenceWindow: {
    start: string;
    end: string;
  };
  lastCollectionAt: string | null;
  controls: ControlCoverage[];
  trendData: TrendPoint[];
}

export interface ScoutCombinedScore {
  total: number;
  security: number;
  compliance: number;
}
