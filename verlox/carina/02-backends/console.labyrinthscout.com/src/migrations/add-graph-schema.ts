import type pg from 'pg';

/** Asset / attack-path graph (AI Security OS prompt 10). */
export async function runGraphSchemaMigration(client: pg.PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS protect_graph_nodes (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id   UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      node_type    TEXT NOT NULL CHECK (node_type IN (
        'device', 'user', 'service_account', 'app', 'finding'
      )),
      external_key TEXT NOT NULL,
      label        TEXT NOT NULL,
      properties   JSONB NOT NULL DEFAULT '{}',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (account_id, node_type, external_key)
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_protect_graph_nodes_account
      ON protect_graph_nodes (account_id, node_type)
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS protect_graph_edges (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id    UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      edge_type     TEXT NOT NULL CHECK (edge_type IN (
        'runs_on', 'authenticates_as', 'talks_to', 'has_finding', 'lateral_candidate'
      )),
      from_node_id  UUID NOT NULL REFERENCES protect_graph_nodes(id) ON DELETE CASCADE,
      to_node_id    UUID NOT NULL REFERENCES protect_graph_nodes(id) ON DELETE CASCADE,
      score         DOUBLE PRECISION NOT NULL DEFAULT 0,
      properties    JSONB NOT NULL DEFAULT '{}',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (account_id, edge_type, from_node_id, to_node_id)
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_protect_graph_edges_from
      ON protect_graph_edges (account_id, from_node_id)
  `);
}
