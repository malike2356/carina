import { pool } from '../db.js';

export type GraphNodeType = 'device' | 'user' | 'service_account' | 'app' | 'finding';
export type GraphEdgeType =
  | 'runs_on'
  | 'authenticates_as'
  | 'talks_to'
  | 'has_finding'
  | 'lateral_candidate';

export async function upsertGraphNode(input: {
  accountId: string;
  nodeType: GraphNodeType;
  externalKey: string;
  label: string;
  properties?: Record<string, unknown>;
}): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO protect_graph_nodes (account_id, node_type, external_key, label, properties)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (account_id, node_type, external_key)
     DO UPDATE SET label = EXCLUDED.label,
                   properties = protect_graph_nodes.properties || EXCLUDED.properties,
                   updated_at = NOW()
     RETURNING id`,
    [
      input.accountId,
      input.nodeType,
      input.externalKey,
      input.label,
      JSON.stringify(input.properties ?? {}),
    ],
  );
  return result.rows[0]!.id;
}

export async function upsertGraphEdge(input: {
  accountId: string;
  edgeType: GraphEdgeType;
  fromNodeId: string;
  toNodeId: string;
  score?: number;
  properties?: Record<string, unknown>;
}): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO protect_graph_edges (
       account_id, edge_type, from_node_id, to_node_id, score, properties
     ) VALUES ($1, $2, $3::uuid, $4::uuid, $5, $6)
     ON CONFLICT (account_id, edge_type, from_node_id, to_node_id)
     DO UPDATE SET score = EXCLUDED.score,
                   properties = protect_graph_edges.properties || EXCLUDED.properties
     RETURNING id`,
    [
      input.accountId,
      input.edgeType,
      input.fromNodeId,
      input.toNodeId,
      input.score ?? 0,
      JSON.stringify(input.properties ?? {}),
    ],
  );
  return result.rows[0]!.id;
}

export type BlastNeighbor = {
  nodeId: string;
  nodeType: string;
  label: string;
  edgeType: string;
  score: number;
  hops: number;
};

/**
 * Blast radius if device/node X is compromised: 1-2 hop neighbors ranked by edge score.
 * Limits: not BloodHound Enterprise; no Kerberos path finding; no AD sync.
 */
export async function queryBlastRadius(
  accountId: string,
  nodeId: string,
  maxHops = 2,
): Promise<BlastNeighbor[]> {
  const result = await pool.query<{
    node_id: string;
    node_type: string;
    label: string;
    edge_type: string;
    score: number;
    hops: number;
  }>(
    `WITH RECURSIVE walk AS (
       SELECT e.to_node_id AS node_id, e.edge_type, e.score, 1 AS hops
       FROM protect_graph_edges e
       WHERE e.account_id = $1 AND e.from_node_id = $2::uuid
       UNION ALL
       SELECT e.to_node_id, e.edge_type, e.score * 0.7, w.hops + 1
       FROM protect_graph_edges e
       JOIN walk w ON e.from_node_id = w.node_id
       WHERE e.account_id = $1 AND w.hops < $3
     )
     SELECT DISTINCT ON (n.id)
       n.id AS node_id, n.node_type, n.label, w.edge_type, w.score, w.hops
     FROM walk w
     JOIN protect_graph_nodes n ON n.id = w.node_id
     WHERE n.account_id = $1
     ORDER BY n.id, w.score DESC, w.hops ASC`,
    [accountId, nodeId, maxHops],
  );

  return result.rows
    .map((r) => ({
      nodeId: r.node_id,
      nodeType: r.node_type,
      label: r.label,
      edgeType: r.edge_type,
      score: Number(r.score),
      hops: r.hops,
    }))
    .sort((a, b) => b.score - a.score || a.hops - b.hops);
}
