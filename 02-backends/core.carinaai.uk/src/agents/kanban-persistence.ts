export const KANBAN_BOARD_MIGRATION = `
ALTER TABLE kanban_cards ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;
ALTER TABLE kanban_cards ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;
ALTER TABLE kanban_cards ADD COLUMN IF NOT EXISTS work_prompt TEXT;
ALTER TABLE kanban_cards ADD COLUMN IF NOT EXISTS result_summary TEXT;
ALTER TABLE kanban_cards ADD COLUMN IF NOT EXISTS orchestrator_notes TEXT;
ALTER TABLE kanban_cards ADD COLUMN IF NOT EXISTS target_role TEXT DEFAULT 'any';
ALTER TABLE kanban_cards ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_kanban_cards_board_column
  ON kanban_cards (session_id, board_id, column_name, sort_order);
`;
