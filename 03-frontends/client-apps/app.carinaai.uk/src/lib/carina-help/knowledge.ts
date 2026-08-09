import { AIVA_PRIMARY_NAV, AIVA_HIRE_ACTION, AIVA_HOME_ACTION } from '@/lib/aiva-nav';
import { NAV_PANELS, NAV_ROUTES, SETTINGS_SECTION_LINKS } from '@/lib/workspace-nav';
import {
  renderCarinaProductGuide,
  renderHowAivaWorks,
  renderOutreachProgram,
  renderResearchBookingsFiles,
  renderSafeDisclosureRules,
  renderSoftWallEmailCalendar,
  renderToolsContactsBilling,
  renderWorkersAndOrg,
} from '@/lib/carina-help/safe-product-ops';

function renderRouteList(
  title: string,
  routes: Array<{ label: string; href: string; description: string }>,
): string {
  return [
    `## ${title}`,
    ...routes.map((route) => `- ${route.label} (${route.href}): ${route.description}`),
  ].join('\n');
}

function renderNavSummary(): string {
  const workspaceRoutes = NAV_ROUTES.filter((route) => !route.parent);
  const workspacePanels = NAV_PANELS.map(
    (panel) => `- ${panel.label}: ${panel.description}`,
  );
  const aivaPrimary = AIVA_PRIMARY_NAV.map((item) => `- ${item.label} (${item.href})`);
  const settingsHighlights = [
    ...SETTINGS_SECTION_LINKS.join,
    ...SETTINGS_SECTION_LINKS.brain,
    ...SETTINGS_SECTION_LINKS.account,
    ...SETTINGS_SECTION_LINKS.security,
  ]
    .filter((link) => Boolean(link.href || link.panel))
    .filter(
      (link, index, all) =>
        all.findIndex(
          (candidate) => candidate.label === link.label && candidate.href === link.href,
        ) === index,
    )
    .map(
      (link) =>
        `- ${link.label}${link.href ? ` (${link.href})` : ''}: ${link.description}`,
    );

  return [
    '# Current product surface map',
    'Use the live app surface first when you answer support questions. Do not rely on stale screenshots or old docs when the current nav tells you otherwise.',
    'Hosts: app.carinaai.uk and admin.hireaiva.co.uk serve the same Aiva workspace product.',
    renderRouteList('Workspace routes', workspaceRoutes),
    '',
    '## Workspace intelligence panels',
    ...workspacePanels,
    '',
    '## Aiva shell routes',
    ...aivaPrimary,
    `- Home (${AIVA_HOME_ACTION.href})`,
    `- Hire (${AIVA_HIRE_ACTION.href})`,
    '',
    '## Settings shortcuts that matter most',
    ...settingsHighlights,
  ].join('\n');
}

function renderProductBoundarySummary(): string {
  return [
    '# Product boundaries',
    '- Carina is the platform engine and the in-product help assistant (Ask Carina).',
    '- Aiva is the customer-facing AI Employee workspace (hire workers, channels, approvals, calendar, tools).',
    '- Scout is a separate governance product. It can audit, suspend, or govern Aiva and Carina actions, but it is not the hired worker.',
    '- Ask Carina helps with product how-to. Hired workers (Selorm, and so on) do the work in Telegram, email, and Work chat.',
    '- When a user asks for help, prefer the current app surface and current settings over stale historical notes.',
  ].join('\n');
}

function renderStuckPointsSummary(): string {
  return [
    '# When users get stuck',
    'Use this section first when someone is confused, blocked, or says a worker lied or went quiet.',
    '',
    '## Schedules vs Automations vs personal tasks',
    '- Schedules (nav label Schedules, route /tasks or /scheduled) is workspace housekeeping only: Calendar sync, Memory tidy, Session tidy. It is NOT a personal todo list.',
    '- Worker Automations (open AI Workers → pick a worker → Automations tab) is for that employee\'s routines: morning digests, recurring prompts, check-ins.',
    '- Personal reminders and task-list items from Telegram or Work chat should appear as Calendar note reminders and/or Notes. Ask the worker for the Task ID or Reminder ID (a stable UUID).',
    '- If a worker said DONE but there is no ID and nothing on Calendar/Notes, the item was not saved. Tell the user to ask again and require an ID, or create a Calendar reminder themselves.',
    '',
    '## Reminders and Notes',
    '- Timed reminders show on Calendar (source note_reminder). Open Calendar and use the Local only filter.',
    '- Notes page: /notes (and admin.hireaiva.co.uk/notes) lists workspace notes, tasks, and reminders. These are real sidebar pages, not chat-only storage.',
    '- Calendar page: /calendar (and admin.hireaiva.co.uk/calendar). Same product on app.carinaai.uk and admin.hireaiva.co.uk.',
    '- Notes panel shortcut Ctrl+Shift+N still opens the quick side panel.',
    '- Follow-up: quote Task ID / Reminder ID back to the worker ("update reminder <uuid>"). Session todo lists are temporary scratchpads and are not the workspace task list.',
    '',
    '## Telegram quiet or not replying',
    '- Check worker → Channels → Telegram is connected with a BotFather token.',
    '- Message the bot from the linked Telegram account; group chats usually need an @mention.',
    '- If inbound is received but there is no reply, the LLM path may be failing (platform issue). Escalate if reconnecting the token does not help.',
    '- Ask Carina cannot send Telegram messages as the hired worker.',
    '',
    '## Channels and Tools',
    '- Per-worker Channels tab: Telegram, email, WhatsApp, Slack, social for that employee.',
    '- Workspace Channels and Tools pages: shared product connectors (Gmail, Drive, Calendar, Trello, and so on) that workers can be granted.',
    '- Training tab on a worker: FAQ and document knowledge for that employee only (not Ask Carina knowledge).',
    '- Look for Guide me next to Connect buttons on Tools, Channels, Drive, Gmail, Calendar, and social connect screens. It opens a right-side drawer with numbered steps, tips, and Copy buttons. Token tools (HubSpot, Notion, Trello, Stripe, GitHub, and others) walk through creating the key, which fields to paste, and Grant after a green probe.',
    '- Google (normal path): do not create a Google Cloud project. Shared callback URLs already live on the company Verlox platform Google app. Click Connect with Google, pick your account, Allow, then Grant to the Aiva. Unique part is which Google account you approve.',
    '- Google (advanced BYOK only): if an org must use its own Google Cloud OAuth client, Guide me Advanced lists the shared redirect URIs to paste on THAT client, plus Client ID/secret. Calendar settings can accept a workspace Client ID and secret (Larissa-style isolation).',
    '- If Connect with Google shows Error 403 access_denied or "has not completed the Google verification process": the OAuth consent screen for the client in use is in Testing. Platform path: Verlox ops Publishes or adds operator Test users on the company project. BYOK path: that org adds Test users or Publishes on their own Google Cloud project. Redirect URI mistakes look different (redirect_uri_mismatch), not this 403.',
    '',
    '## Approvals, Email, Calendar, Documents',
    '- Approvals: drafts waiting for human review before send (email, social, and Soft Wall outreach contact).',
    '- Email: connect on the Email Handler worker Channels flow (Gmail OAuth preferred). Nothing client-facing is sent until approved unless the owner explicitly asked to send now.',
    '- Calendar: Google sync plus local/Aiva events and note reminders. Filters: Aiva, Google, Local only.',
    '- Documents: Document Vault at /documents (folders, files, revisions, trash, Soft Wall approvals). Agents use vault-* tools from Work chat; Telegram /vault commands and file captions (save to vault / /vault import) use the same vault with quarantine and webhook dedupe. Public customer sessions cannot access the private vault. Google Drive sync is optional via vault-sync-status / vault-sync-request.',
    '',
    '## CRM Leads vs Contacts',
    '- Outreach (sidebar) → CRM Leads (/aiva/outreach/leads or /aiva/crm/leads): sales lead table, CSV import/export, linked lead files (create, sync, rename, delete file).',
    '- Contacts (/contacts): people directory and dossier. Different surface from CRM Leads.',
    '- To contact leads safely: ask the hired worker (Work or Telegram). Soft Wall drafts land in Approvals.',
    '- Accidental Create leads sheet copies: use Rename or Delete on Linked lead files. Delete does not wipe CRM rows.',
    '- Chat CSV upload: attach in worker Work chat and ask Aiva to import into CRM.',
    '',
    '## Billing and Scout',
    '- Billing: /billing/aiva for plan, invoices, and portal. Plans include Starter, Growth, and Business (seat and channel limits differ).',
    '- Scout Govern is included on paid Aiva plans for audit trail and kill switch. Scout is not the same product as the hired Aiva.',
    '',
    '## Escalate',
    '- If steps fail (billing dispute, account lockout, data loss, OAuth still broken, worker silent after reconnect), invite Escalate to human support in Ask Carina.',
  ].join('\n');
}

function renderMemoryAndKnowledgeSummary(): string {
  return [
    '# Memory, RAG, and shared knowledge',
    '- Session history is not durable memory. It is the working conversation for the current thread.',
    '- Curated memory is for stable facts, preferences, contacts, and instructions that should survive across sessions.',
    '- Workspace Knowledge (/knowledge) is searchable uploaded docs for the workspace (pack user-resources).',
    '- Worker Training tab is that employee\'s FAQ/docs only.',
    '- Platform pack carina-rag teaches Carina about the product for agent sessions; Ask Carina also uses this help knowledge base.',
    '- The GitHub memory bridge links durable notes to a private GitHub repo in Settings → Brain → GitHub memory. You can scope it per workspace or per user, and choose whether the mount behaves as Carina, Aiva, or shared.',
    '- Never store secrets, tokens, passwords, or raw private transcripts in GitHub or curated memory.',
  ].join('\n');
}

function renderGitHubBridgeSummary(): string {
  return [
    '# GitHub memory (durable notes)',
    '- Users link their own private GitHub repo in Settings → Brain → GitHub memory.',
    '- Scope can be workspace, user, or shared; product mount can be Carina, Aiva, or shared.',
    '- Good content: preferences, decisions, runbooks, project notes, checklists.',
    '- Bad content: secrets, access tokens, passwords, raw chat dumps.',
    '- Sync pattern: pull on schedule, search when answering, push only approved durable updates.',
  ].join('\n');
}

function renderCommonFlowsSummary(): string {
  return [
    '# Common support flows',
    '- Hiring a worker: open Hire, pick a role template, finish setup, then open the worker under AI Workers to connect channels and Training.',
    '- Connect Telegram: worker → Channels → Telegram → paste BotFather token (or Connect Telegram in Work chat). Then message the bot on Telegram.',
    '- See CRM leads: sidebar Outreach (opens CRM Leads). Alias /aiva/crm/leads.',
    '- Import leads: CRM Leads → Upload CSV or paste CSV, or ask the worker in chat with an attached CSV.',
    '- Create or clean up lead sheets: CRM Leads → Create leads sheet; Rename or Delete under Linked lead files.',
    '- Contact leads safely: ask the hired worker to contact new leads; approve Soft Wall drafts in Approvals.',
    '- SPSS / data analysis: not Ask Carina. Open the worker → Work → paperclip → attach .sav/.csv/.xlsx → ask the hired Aiva.',
    '- Email setup: Email Handler worker → connect Gmail, Microsoft, IMAP, or forwarding.',
    '- Social channels: Social Media Manager (or enabled worker) → Channels → LinkedIn, Instagram, Messenger, X, or TikTok. Drafts go to Approvals → Social.',
    '- Book a call: Bookings (/vical) or Outreach discovery booking flows.',
    '- Personal reminder from chat: ask the worker to save a reminder and return Reminder ID; then check Calendar/Notes.',
    '- Morning digest / recurring routine: worker → Automations (not Schedules /tasks).',
    '- Workspace calendar sync job: Schedules (/tasks) → Calendar sync.',
    '- Support chat: Ask Carina (bottom-right) is product help only; it cannot act as the hired worker.',
  ].join('\n');
}

export const CARINA_HELP_KNOWLEDGE_BASE = [
  `# Product overview\n\nAiva (Hire Aiva) is a workspace where you hire AI employees (workers) for roles like email handling, outreach, social DMs, research, and ops. Powered by Carina. Users work at app.carinaai.uk and admin.hireaiva.co.uk (same product).\n\nAsk Carina is the in-product help assistant. It explains the product when users get stuck. Hired workers do operational work on Telegram, email, and Work chat.`,
  renderSafeDisclosureRules(),
  renderStuckPointsSummary(),
  renderHowAivaWorks(),
  renderWorkersAndOrg(),
  renderSoftWallEmailCalendar(),
  renderOutreachProgram(),
  renderResearchBookingsFiles(),
  renderToolsContactsBilling(),
  renderCarinaProductGuide(),
  renderCommonFlowsSummary(),
  renderProductBoundarySummary(),
  renderMemoryAndKnowledgeSummary(),
  renderGitHubBridgeSummary(),
  `# Troubleshooting principles\n\n- Never invent buttons or screens that do not exist.\n- When unsure, say so and offer the next best path or escalation.\n- Prefer live nav and these stuck-point rules over older docs.\n- If the user asks about Scout, keep Scout separate from Aiva workers.\n- Never tell users that Schedules (/tasks) is their personal task list.\n- Never disclose secrets, credentials, infra, or source paths.`,
  renderNavSummary(),
].join('\n\n');

export const CARINA_HELP_GREETING =
  "Hi, I'm Carina. I help you use the whole Aiva workspace: workers, Approvals and Soft Wall, CRM leads and outreach, bookings, calendar, tools, billing, and Scout Govern. Ask how something works and I will walk you through it safely.";
