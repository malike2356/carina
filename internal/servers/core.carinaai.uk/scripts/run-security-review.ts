#!/usr/bin/env tsx
import {
  collectReviewTargets,
  defaultAuditRunner,
  ensureGitBaseRef,
  readGithubEvent,
  resolveRepoRoot,
} from '../src/security/automated-review/git-changes.js';
import {
  formatReviewMarkdown,
  formatReviewSummary,
  runSecurityReview,
  shouldBlockCi,
} from '../src/security/automated-review/review-bot.js';

async function main(): Promise<void> {
  const repoRoot = resolveRepoRoot();
  const event = readGithubEvent();
  const baseRef = process.env.SECURITY_REVIEW_BASE_REF ?? event.baseRef ?? 'origin/main';
  const paths = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
  const json = process.argv.includes('--json');
  const skipAudit = process.argv.includes('--skip-audit');
  const skipScout = process.argv.includes('--skip-scout');

  if (process.env.GITHUB_EVENT_NAME === 'pull_request') {
    ensureGitBaseRef(baseRef);
  }

  const files = collectReviewTargets(repoRoot, { baseRef, paths: paths.length > 0 ? paths : undefined });
  const review = await runSecurityReview({
    prNumber: event.prNumber,
    author: event.author,
    files,
    includeDependencyScan: !skipAudit,
    runAudit: defaultAuditRunner(repoRoot),
    skipScout,
  });

  if (json) {
    console.log(JSON.stringify(review, null, 2));
  } else {
    console.log(formatReviewSummary(review));
    console.log('');
    console.log(formatReviewMarkdown(review));
  }

  if (shouldBlockCi(review)) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
