#!/usr/bin/env bash
# File good-first-issues to GitHub. Requires gh auth and repo malike2356/carina-agent.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="${GITHUB_REPO:-malike2356/carina-agent}"

for f in "$SCRIPT_DIR"/0*.md; do
  [[ -f "$f" ]] || continue
  title=$(node -e "
    const fs = require('fs');
    const m = fs.readFileSync(process.argv[1], 'utf8').match(/^---\\n([\\s\\S]*?)\\n---/);
    if (!m) process.exit(1);
    const yaml = m[1];
    const t = yaml.match(/title:\\s*[\"']?([^\"'\\n]+)[\"']?/);
    if (!t) process.exit(1);
    console.log(t[1].trim());
  " "$f")
  labels=$(node -e "
    const fs = require('fs');
    const body = fs.readFileSync(process.argv[1], 'utf8');
    const m = body.match(/^---\\n([\\s\\S]*?)\\n---/);
    const yaml = m[1];
    const labels = [];
    let inLabels = false;
    for (const line of yaml.split('\\n')) {
      if (/^labels:/.test(line)) { inLabels = true; continue; }
      if (inLabels && /^\\s+-\\s+(.+)/.test(line)) labels.push(line.replace(/^\\s+-\\s+/, '').trim());
      else if (inLabels && /^\\S/.test(line)) break;
    }
    console.log(labels.join(','));
  " "$f")
  issue_body=$(node -e "
    const fs = require('fs');
    const body = fs.readFileSync(process.argv[1], 'utf8');
    const rest = body.replace(/^---[\\s\\S]*?---\\n?/, '');
    process.stdout.write(rest);
  " "$f")
  echo "Creating: $title"
  gh issue create --repo "$REPO" --title "$title" --label "$labels" --body "$issue_body"
done

echo "Done."
