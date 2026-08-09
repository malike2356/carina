/** Citation helpers for vault content retrieval (prompt 714). */

export type VaultCitation = {
  itemId: string;
  revision: number;
  name: string;
  snippet: string;
  score: number;
  sourceId: string;
  workspaceId: string;
};

export function makeSourceId(workspaceId: string, itemId: string, revision: number): string {
  return `${workspaceId}/${itemId}@r${Math.trunc(revision)}`;
}

export function citationAsDict(c: VaultCitation): Record<string, unknown> {
  return {
    item_id: c.itemId,
    revision: c.revision,
    name: c.name,
    snippet: c.snippet,
    score: c.score,
    source_id: c.sourceId,
    workspace_id: c.workspaceId,
  };
}
