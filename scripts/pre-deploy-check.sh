#!/bin/bash
# Pre-deploy safety check - run locally before every production merge
set -e
cd "$(dirname "$0")/.."

echo "=== PRE-DEPLOY CHECK ==="
echo ""

echo "1. Pending central migrations:"
php artisan migrate:status | grep "Pending" || echo "   None pending"

echo ""
echo "2. Pending tenant migrations (sample - first 3 tenants):"
php artisan tenants:run "migrate:status" | head -50 || true

echo ""
echo "3. Config diff (check all required keys exist in .env):"
REQUIRED_KEYS=("APP_KEY" "DB_PASSWORD" "ANTHROPIC_API_KEY" "STRIPE_SECRET"
               "TENANCY_DB_PASSWORD" "REDIS_PASSWORD" "MEILISEARCH_KEY"
               "MAILGUN_SECRET" "STRIPE_WEBHOOK_SECRET")
for key in "${REQUIRED_KEYS[@]}"; do
  grep -q "^${key}=" .env && echo "    ${key}" || echo "    MISSING: ${key}"
done

echo ""
echo "4. Queue health:"
php artisan horizon:status

echo ""
echo "5. Last deploy timestamp:"
cat storage/deploy.txt 2>/dev/null || echo "   No previous deploy recorded"

echo ""
echo "=== Ready to deploy? (y/n) ==="
read -r answer
if [ "$answer" != "y" ]; then
  echo "Deploy cancelled."
  exit 1
fi
echo "Proceeding with deploy..."
