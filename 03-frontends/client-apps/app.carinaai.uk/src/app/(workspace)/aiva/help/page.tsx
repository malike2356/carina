import Link from 'next/link';
import { LifeBuoy, Mail, BookOpen } from 'lucide-react';
import { AIVA_QUICKSTART_DOC, AIVA_SUPPORT_EMAIL, supportMailto } from '@/lib/docs-links';

export default function AivaHelpPage() {
  return (
    <div className="mx-auto max-w-[90rem] space-y-8 py-4">
      <div>
        <h1 className="text-2xl font-semibold">Help and support</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Getting started guides and human support for your Aiva workspace.
          For quick answers, use Ask Carina in the bottom-right corner; she can escalate to the team when needed.
        </p>
      </div>

      <section className="rounded-xl border border-accent/30 bg-accent-dim/20 p-6">
        <div className="flex items-start gap-3">
          <LifeBuoy className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
          <div>
            <h2 className="font-medium text-text-primary">Ask Carina</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Carina is your first line of product help: hire workers, CRM leads and outreach, Soft Wall
              Approvals, channels, calendar, billing, and more. If she cannot resolve it, escalate from the chat
              and the team is notified by email or Telegram.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-start gap-3">
          <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
          <div>
            <h2 className="font-medium text-text-primary">Documentation</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Step-by-step setup for Email Handler, social DMs, approvals, and Scout governance.
            </p>
            <a
              href={AIVA_QUICKSTART_DOC}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm font-medium text-accent hover:underline"
            >
              Open Aiva quickstart guide
            </a>
            <p className="mt-3 text-xs text-text-muted">
              Social channel setup (LinkedIn, Instagram, Messenger, X, TikTok) is documented in the core social setup guide.
              Connect from each worker&apos;s Channels tab after hire.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-start gap-3">
          <Mail className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
          <div>
            <h2 className="font-medium text-text-primary">Email support</h2>
            <p className="mt-1 text-sm text-text-secondary">
              We aim to respond on business days. Include your workspace name and what you were trying to do.
            </p>
            <a
              href={supportMailto('Aiva support request')}
              className="mt-3 inline-block text-sm font-medium text-accent hover:underline"
            >
              {AIVA_SUPPORT_EMAIL}
            </a>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="font-medium text-text-primary">Social channels</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Connect native social channels on a worker to receive inbound DMs, draft replies, and optional scheduled post drafts.
        </p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-text-secondary">
          <li>Hire or open a Social Media Manager worker (or any worker with social channels enabled).</li>
          <li>Open the worker&apos;s Channels tab and connect LinkedIn, Instagram, Messenger, X, or TikTok.</li>
          <li>Review draft replies and post drafts in Approvals under the Social tab.</li>
          <li>Add automations on the worker for scheduled digests or engagement scans.</li>
        </ol>
        <Link href="/aiva/workers" className="mt-4 inline-block text-sm font-medium text-accent hover:underline">
          Manage workers
        </Link>
        <Link href="/aiva/approvals?tab=social" className="ml-4 inline-block text-sm font-medium text-accent hover:underline">
          Open social approvals
        </Link>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="font-medium text-text-primary">Frequently asked questions</h2>
        <dl className="mt-4 space-y-4 text-sm">
          <div>
            <dt className="font-medium text-text-primary">Where are my CRM leads and lead sheets?</dt>
            <dd className="mt-1 text-text-secondary">
              Sidebar Outreach opens CRM Leads (/aiva/outreach/leads, also /aiva/crm/leads). Import or export CSV,
              create linked lead files, then Sync, Rename, or Delete those files. Delete removes the linked file only,
              not table rows. Contacts (/contacts) is a separate people directory.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-text-primary">How do I ask Aiva to email leads safely?</dt>
            <dd className="mt-1 text-text-secondary">
              Ask your hired worker in Work chat or Telegram to contact the leads. Soft Wall drafts appear in Approvals.
              Approve there before anything sends. Do not expect cold email to leave without Approvals.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-text-primary">Where is my personal task list or reminder?</dt>
            <dd className="mt-1 text-text-secondary">
              Not under Schedules. Schedules (/tasks) is only workspace housekeeping (Calendar sync, Memory tidy).
              Personal reminders appear on Calendar and in Notes (Ctrl+Shift+N). Ask your worker for the Task ID or
              Reminder ID when they save one.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-text-primary">What is the difference between Schedules and Automations?</dt>
            <dd className="mt-1 text-text-secondary">
              Schedules are workspace jobs. Automations live on each worker (AI Workers → worker → Automations)
              for that employee&apos;s digests and recurring routines.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-text-primary">My Telegram Aiva went quiet. What should I check?</dt>
            <dd className="mt-1 text-text-secondary">
              Open the worker → Channels → Telegram and reconnect the BotFather token if needed, then message the bot
              again. Group chats usually need an @mention. If it still stays silent, use Ask Carina → Escalate to human support.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-text-primary">Can my worker watch LinkedIn DMs in the background?</dt>
            <dd className="mt-1 text-text-secondary">
              The web chat widget is session-only. Connect LinkedIn (or other social channels) on the worker
              Channels tab so inbound DMs are processed when they arrive. Draft replies appear in Approvals
              before anything is sent.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-text-primary">How do I connect my email?</dt>
            <dd className="mt-1 text-text-secondary">
              Open your Email Handler worker, choose Connect email, then Gmail, Outlook, IMAP, or inbound
              forwarding. For Gmail, click Connect Gmail, pick your Google account, and Allow access. No Google
              Cloud project is required. Use{' '}
              <span className="font-medium text-text-primary">Guide me</span> if you want the short steps
              (Advanced BYOK is only for orgs that must use their own Google Cloud client).
            </dd>
          </div>
          <div>
            <dt className="font-medium text-text-primary">How do I set up Google Drive or Calendar?</dt>
            <dd className="mt-1 text-text-secondary">
              Use Tool accounts (/aiva/tools) for Drive and other Google tools, and Calendar settings
              (/settings/calendar) for calendar sync. Click Connect with Google, pick your account, then Allow.
              Hire Aiva uses the company Verlox Google app, so you do not create a Cloud project or paste redirect
              URIs. Guide me Advanced is only if your organisation requires its own OAuth client (BYOK).
            </dd>
          </div>
          <div>
            <dt className="font-medium text-text-primary">What does the AI Employee do with my emails?</dt>
            <dd className="mt-1 text-text-secondary">
              Your hired Email Handler worker reads connected mail, categorises messages, and drafts replies for
              review. Nothing is sent until you approve it in Approvals, unless you explicitly asked to send now.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-text-primary">What is Training vs Knowledge?</dt>
            <dd className="mt-1 text-text-secondary">
              Training on a worker is that employee&apos;s FAQ and docs. Workspace Knowledge (/knowledge) is shared
              searchable uploads for the workspace. Ask Carina uses product help knowledge, not your private Training files.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-text-primary">What is Scout?</dt>
            <dd className="mt-1 text-text-secondary">
              Scout Govern is included on paid Aiva plans. It records an audit trail, supports kill switch
              suspension, and provides compliance export for AI Employee actions.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-text-primary">How do I cancel?</dt>
            <dd className="mt-1 text-text-secondary">
              Use Billing settings or the Stripe customer portal. You can also email{' '}
              <a href={supportMailto('Cancel Aiva subscription')} className="text-accent hover:underline">
                {AIVA_SUPPORT_EMAIL}
              </a>
              .
            </dd>
          </div>
          <div>
            <dt className="font-medium text-text-primary">Response times</dt>
            <dd className="mt-1 text-text-secondary">
              Starter: within one business day. Growth and Business: same-day priority when possible.
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-start gap-3">
          <LifeBuoy className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
          <div>
            <h2 className="font-medium text-text-primary">Billing and plan</h2>
            <p className="mt-1 text-sm text-text-secondary">
              View your subscription, invoices, and seat limits from billing settings.
            </p>
            <Link href="/billing/aiva" className="mt-3 inline-block text-sm font-medium text-accent hover:underline">
              Open billing
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
