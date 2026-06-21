export type DomainRulePack = {
  id: string;
  label: string;
  /** Inject when any listed toolset is active for this session. */
  toolsets?: string[];
  /** Inject when any listed tool is in the session tool surface. */
  tools?: string[];
  rules: string[];
  /** Provenance: builtin kernel id or extension bundle id. */
  source?: string;
};
