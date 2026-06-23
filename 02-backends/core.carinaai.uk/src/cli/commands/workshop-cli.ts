import {
  approveWorkshopDraft,
  getWorkshopDraft,
  listWorkshopDrafts,
  purgeWorkshopDrafts,
  rejectWorkshopDraft,
  workshopReviewEnabled,
} from '../../skills/workshop-store.js';

function usage(): void {
  console.log(`Usage: carina workshop <command>

Commands:
  status                 Show workshop queue mode and counts
  list [--pending]       List drafts (default: pending only)
  show <id>              Show one draft
  approve <id>           Approve and publish draft to skill store
  reject <id>            Reject draft
  purge [--rejected]       Remove rejected (or all) drafts

Set CARINA_SKILL_WORKSHOP=true to queue auto-writer and session-learner captures for review.
Set SKILL_AUTO_WRITE=false to disable LLM auto-write entirely.
`);
}

export async function runWorkshopCommand(args: string[]): Promise<void> {
  const cmd = args[0] ?? 'status';

  if (cmd === 'status') {
    const pending = listWorkshopDrafts('pending').length;
    const approved = listWorkshopDrafts('approved').length;
    const rejected = listWorkshopDrafts('rejected').length;
    console.log(`Workshop review: ${workshopReviewEnabled() ? 'on' : 'off (set CARINA_SKILL_WORKSHOP=true)'}`);
    console.log(`Queue: pending=${pending} approved=${approved} rejected=${rejected}`);
    return;
  }

  if (cmd === 'list') {
    const pendingOnly = args.includes('--pending') || !args.includes('--all');
    const drafts = pendingOnly ? listWorkshopDrafts('pending') : listWorkshopDrafts();
    for (const d of drafts.slice(0, 50)) {
      console.log(`  ${d.id.slice(0, 8)}  ${d.status.padEnd(8)}  ${d.source.padEnd(14)}  ${d.name}`);
    }
    return;
  }

  if (cmd === 'show') {
    const id = args[1];
    if (!id) {
      console.error('show requires draft id');
      process.exitCode = 1;
      return;
    }
    const draft = getWorkshopDraft(id);
    if (!draft) {
      console.error('Draft not found');
      process.exitCode = 1;
      return;
    }
    console.log(JSON.stringify(draft, null, 2));
    return;
  }

  if (cmd === 'approve') {
    const id = args[1];
    if (!id) {
      console.error('approve requires draft id');
      process.exitCode = 1;
      return;
    }
    const result = await approveWorkshopDraft(id);
    console.log(`Approved ${result.draft.name} (${result.action})`);
    return;
  }

  if (cmd === 'reject') {
    const id = args[1];
    if (!id) {
      console.error('reject requires draft id');
      process.exitCode = 1;
      return;
    }
    await rejectWorkshopDraft(id);
    console.log(`Rejected draft ${id.slice(0, 8)}`);
    return;
  }

  if (cmd === 'purge') {
    const n = purgeWorkshopDrafts(args.includes('--rejected') ? 'rejected' : undefined);
    console.log(`Purged ${n} draft(s)`);
    return;
  }

  usage();
}
