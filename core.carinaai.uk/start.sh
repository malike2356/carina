#!/bin/bash
cd "$(dirname "$0")"
export NODE_ENV=production
export WEB_ENABLED=true
export SKIP_CLI=true
export HOSTED_MODE=false
export CARINA_OPERATOR_HOSTS=core.carinaai.uk
exec /usr/bin/node dist/src/index.js
