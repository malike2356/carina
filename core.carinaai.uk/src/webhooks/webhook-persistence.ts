export const WEBHOOK_MATURITY_MIGRATION = `
ALTER TABLE webhook_subscriptions ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE webhook_subscriptions ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE webhook_subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE webhook_subscriptions ADD COLUMN IF NOT EXISTS max_attempts INT DEFAULT 5;
ALTER TABLE webhook_subscriptions ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES webhook_subscriptions(id) ON DELETE SET NULL,
  event TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  http_status INT,
  attempt_count INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  error_message TEXT,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_subscription
  ON webhook_deliveries (subscription_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status_retry
  ON webhook_deliveries (status, next_retry_at)
  WHERE status IN ('failed', 'retrying', 'pending');
`;
