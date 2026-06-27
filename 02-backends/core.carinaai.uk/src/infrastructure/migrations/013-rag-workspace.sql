-- Add workspace scoping to rag_chunks so tenant-specific knowledge can be filtered
-- efficiently without JSONB extraction.
ALTER TABLE rag_chunks ADD COLUMN IF NOT EXISTS workspace_id uuid;

CREATE INDEX IF NOT EXISTS rag_chunks_workspace_idx ON rag_chunks(workspace_id);
CREATE INDEX IF NOT EXISTS rag_chunks_source_idx ON rag_chunks(source);
