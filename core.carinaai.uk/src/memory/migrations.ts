import type pg from 'pg';

const TABLES = `
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS episodic_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  embedding VECTOR(768),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS skill_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  trigger_keywords TEXT[] NOT NULL,
  steps TEXT NOT NULL,
  tools_used TEXT[] DEFAULT '{}',
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rag_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  pack TEXT NOT NULL DEFAULT 'property-uk',
  content TEXT NOT NULL,
  embedding VECTOR(768),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inbound_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  message_id TEXT UNIQUE,
  read BOOLEAN DEFAULT FALSE,
  received_at TIMESTAMPTZ DEFAULT NOW()
);
`;

const INDEXES = [
  `CREATE INDEX IF NOT EXISTS episodic_memories_embedding_idx
   ON episodic_memories USING ivfflat (embedding vector_cosine_ops)
   WITH (lists = 100)`,
  `CREATE INDEX IF NOT EXISTS rag_chunks_embedding_idx
   ON rag_chunks USING ivfflat (embedding vector_cosine_ops)
   WITH (lists = 100)`,
];

// Migrate existing 1536-dim columns to 768 (DeepSeek native dimension).
// Safe to run repeatedly - only fires when the old dimension is detected.
async function migrateDimensions(client: pg.PoolClient): Promise<void> {
  const check = await client.query<{ data_type: string }>(`
    SELECT pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    WHERE c.relname = 'episodic_memories'
      AND a.attname = 'embedding'
      AND a.attnum > 0
  `);

  const currentType = check.rows[0]?.data_type ?? '';
  const needsMigration = currentType.includes('1536') || currentType.includes('1024');
  if (!needsMigration) return; // already 768 or table doesn't exist yet

  const fromDim = currentType.includes('1536') ? '1536' : '1024';
  console.log(`Migrating vector columns from ${fromDim} to 768 dims...`);
  // Drop indexes first (they reference the column type)
  await client.query('DROP INDEX IF EXISTS episodic_memories_embedding_idx');
  await client.query('DROP INDEX IF EXISTS rag_chunks_embedding_idx');
  // Wipe existing vectors - they are incompatible with the new dimension
  await client.query('UPDATE episodic_memories SET embedding = NULL');
  await client.query('UPDATE rag_chunks SET embedding = NULL');
  // Alter column type
  await client.query('ALTER TABLE episodic_memories ALTER COLUMN embedding TYPE VECTOR(768)');
  await client.query('ALTER TABLE rag_chunks ALTER COLUMN embedding TYPE VECTOR(768)');
  console.log('Vector column migration complete. Re-run pnpm ingest to rebuild the RAG index.');
}

export async function runMigrations(client: pg.PoolClient): Promise<void> {
  await client.query(TABLES);
  await migrateDimensions(client);
  for (const sql of INDEXES) {
    try {
      await client.query(sql);
    } catch {
      // ivfflat requires at least one row; safe to skip and retry after ingest
    }
  }
}
