import Link from 'next/link';

export default function OutreachChannelsPage() {
  return (
    <div className="mx-auto max-w-[90rem] space-y-4 p-6">
      <p className="text-sm text-text-secondary">
        Content and engagement channels that feed sales engagement. Email sequences live under Sequences
        and Approvals; messaging channels stay under workspace Channels.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/aiva/outreach/channels/youtube"
          className="rounded-lg border border-border bg-card p-4 hover:border-accent"
        >
          <p className="text-sm font-medium text-text-primary">YouTube Channel</p>
          <p className="mt-1 text-xs text-text-muted">
            Faceless publishing, comment lead capture, and niche content across domains.
          </p>
        </Link>
        <Link href="/aiva/approvals" className="rounded-lg border border-border bg-card p-4 hover:border-accent">
          <p className="text-sm font-medium text-text-primary">Email Soft Wall</p>
          <p className="mt-1 text-xs text-text-muted">
            Approve sequence drafts before Gmail send. Required for every cold touch.
          </p>
        </Link>
        <Link href="/email" className="rounded-lg border border-border bg-card p-4 hover:border-accent">
          <p className="text-sm font-medium text-text-primary">Mailbox</p>
          <p className="mt-1 text-xs text-text-muted">Read replies and triage interest back into the pipeline.</p>
        </Link>
        <Link href="/channels" className="rounded-lg border border-border bg-card p-4 hover:border-accent">
          <p className="text-sm font-medium text-text-primary">Messaging channels</p>
          <p className="mt-1 text-xs text-text-muted">WhatsApp, Slack, Telegram hooks for later sequence steps.</p>
        </Link>
      </div>
    </div>
  );
}
