import Link from 'next/link';
import { LifeBuoy, Mail, BookOpen } from 'lucide-react';
import { AIVA_QUICKSTART_DOC, AIVA_SUPPORT_EMAIL, supportMailto } from '@/lib/docs-links';

export default function AivaHelpPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 py-4">
      <div>
        <h1 className="text-2xl font-semibold">Help and support</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Getting started guides and human support for your Aiva workspace.
        </p>
      </div>

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
              forwarding. OAuth is recommended for Google and Microsoft mailboxes.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-text-primary">What does the AI Employee do with my emails?</dt>
            <dd className="mt-1 text-text-secondary">
              Carina polls your mailbox, categorises new messages, and drafts replies for client-style mail.
              Nothing is sent until you approve it in the Approvals inbox.
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
              Starter: within one business day. Growth: same-day priority when possible.
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
