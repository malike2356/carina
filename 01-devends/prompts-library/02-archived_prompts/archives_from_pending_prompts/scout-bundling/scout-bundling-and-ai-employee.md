# Carina Aiva - Scout Bundling and AI Employee Specification

**Status: COMPLETED 2026-07-19**

**What was built:** Scout provision, governance UI, kill switch, AI workers, email MVP, and UpgradeModal seat checkout path shipped. Seat Stripe price id must be added to SoT by owner (not created from code).


**Implementation note (2026-06-30):** Product UI uses the term **AI Employee**. Code and APIs retain
`ai_workers`, `/api/aiva/workers`, and `/aiva/workers` paths for backward compatibility.
See `scout-bundling-gap-analysis.md` for criterion-to-file mapping.

## Two Things in One Prompt

This prompt covers two tightly related things:

1. **Scout bundling**: every Aiva subscription includes Scout free. This is not a
   marketing gesture - it is a product necessity. AI Employees (see below) take
   real-world actions on behalf of businesses. Without governance, this is a
   liability. Scout governance is what makes AI Employees safe to sell.

2. **AI Employee specification**: the concrete definition of what an Aiva AI Employee
   is, what it can do, how it is billed, and how it connects to Scout.

---

## Part 1: Scout Bundling in Aiva

### What "free Scout" means

Every Aiva subscriber (Basic and above) gets:
- One Scout workspace included at no additional charge.
- All AI Employees in that workspace automatically enrolled in Scout governance.
- Scout audit trail visible from within the Aiva dashboard.
- Kill switches accessible to the workspace owner and designated admins.

Free Scout is scoped to Aiva-generated activity only. It is NOT a general-purpose
Scout licence. The subscriber cannot enrol non-Aiva systems in their free Scout
workspace (that would require a separate Scout subscription).

### Delivery

When an Aiva subscription is activated at `keys.carinaai.uk`:
1. Keys server calls the Scout provisioning API: `POST https://api.labyrinthscout.com/v1/workspaces/provision`
   with payload: `{product: "carina-aiva", account_email, tier, aiva_workspace_id}`.
2. Scout creates a governed workspace and returns `{workspace_id, api_key, dashboard_url}`.
3. Keys server stores the Scout workspace credentials against the Aiva account.
4. Aiva is configured at provisioning time with the Scout API key.
5. Email to subscriber: "Your Scout governance workspace is ready. All AI Employees
   are automatically protected."

If Scout provisioning fails (Scout API down): retry with exponential backoff for
24 hours. Flag the account as "Scout pending" in the Aiva admin panel. Do not
block Aiva access while Scout is pending.

### Scout in the Aiva UI

In the Aiva workspace sidebar:
- "Governance" section (not buried in settings).
- Scout status indicator: green "Protected" when connected, amber "Pending" during
  provisioning, red "Disconnected" if the Scout heartbeat fails.
- "Open Scout dashboard" link.
- Summary: AI Employees monitored, events last 24h, any active kill switches.

When a kill switch is active on an AI Employee from Scout:
- The Employee shows "Suspended by governance policy" in the Aiva UI.
- No tasks are executed. Incoming triggers are queued, not dropped.
- Workspace owner is notified immediately via email and in-app alert.

---

## Part 2: AI Employee Specification

### What an AI Employee is

An AI Employee is a persistent, named agent with a defined role, access to specific
tools and integrations, its own memory, and the ability to act autonomously on
scheduled triggers or event-based triggers.

It is NOT a chatbot. It is NOT a one-shot task runner. It is a persistent identity
that operates on behalf of the business over days, weeks, and months.

Examples:
- "Aria - Sales Assistant": monitors new CRM leads, drafts personalised outreach
  emails, schedules follow-up reminders, escalates hot leads to human reps.
- "James - Accounts Coordinator": receives invoice emails, extracts figures, logs
  to accounting software, flags anomalies for human review.
- "Nova - Customer Support": monitors support inbox, categorises tickets, drafts
  responses for human approval, escalates urgent issues immediately.
- "Rex - Content Publisher": receives content briefs, researches topics, drafts
  articles, formats for CMS, queues for human review before publish.

### What Makes an Employee Different From a Chat Session

| Feature | Chat session | AI Employee |
| --- | --- | --- |
| Identity | Anonymous or user-named | Named, persistent persona |
| Memory | Session only | Long-term, role-specific memory |
| Triggers | User sends a message | Schedules, webhooks, email arrival, CRM events |
| Tools | Whatever the user enables | Fixed toolset defined at creation |
| Scout governance | Optional | Mandatory (all Employees enrolled) |
| Billing | Included in base Aiva plan | Per Employee seat per month |
| Human in the loop | Every interaction | Configurable per action type |

### Employee Definition Schema

```json
{
  "employee_id": "uuid",
  "name": "Aria",
  "role": "Sales Assistant",
  "persona": "Professional, concise, never uses jargon.",
  "tools": ["email_read", "email_draft", "email_send_with_approval",
            "crm_read", "crm_update", "calendar_schedule"],
  "memory_scope": "role",
  "triggers": [
    {"type": "cron", "schedule": "0 9 * * 1-5", "task": "Review new CRM leads"},
    {"type": "email", "filter": {"from_domain": "prospects.com"}, "task": "Draft response"}
  ],
  "approval_required": {
    "email_send": true,
    "crm_update": false
  },
  "scout_enrolled": true,
  "scout_risk_level": "medium",
  "created_by": "workspace_admin_user_id",
  "created_at": "2026-06-30T00:00:00Z"
}
```

### Database Schema

```sql
CREATE TABLE ai_employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    persona TEXT,
    tools JSONB NOT NULL DEFAULT '[]',
    triggers JSONB NOT NULL DEFAULT '[]',
    approval_config JSONB NOT NULL DEFAULT '{}',
    memory_scope TEXT NOT NULL DEFAULT 'role',
    -- 'role': memories are scoped to this employee's role
    -- 'workspace': shares memory with workspace (read-only for Employee)
    scout_enrolled BOOLEAN NOT NULL DEFAULT TRUE,
    scout_risk_level TEXT NOT NULL DEFAULT 'medium',
    -- 'low', 'medium', 'high' - affects Scout event verbosity
    status TEXT NOT NULL DEFAULT 'active',
    -- 'active', 'suspended', 'suspended_by_scout', 'archived'
    last_active_at TIMESTAMPTZ,
    task_count INT NOT NULL DEFAULT 0,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE employee_task_log (
    id BIGSERIAL PRIMARY KEY,
    employee_id UUID REFERENCES ai_employees(id),
    trigger_type TEXT NOT NULL,
    trigger_detail JSONB,
    task_description TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'running',
    -- 'running', 'awaiting_approval', 'approved', 'rejected', 'completed', 'failed'
    output_summary TEXT,
    scout_event_id TEXT
    -- ID of the corresponding Scout audit event, if enrolled
);

CREATE TABLE employee_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_log_id BIGINT REFERENCES employee_task_log(id),
    employee_id UUID REFERENCES ai_employees(id),
    action_type TEXT NOT NULL,
    -- 'email_send', 'crm_update', 'calendar_create', etc.
    action_payload JSONB NOT NULL,
    -- the proposed action, shown to the approver
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    decision TEXT,
    -- 'approved', 'rejected', 'modified'
    modified_payload JSONB
    -- if the approver modified the action before approving
);
```

### Billing Model

- Aiva Starter: includes 1 AI Employee. Growth: includes 5 AI Employees.
- Each additional Employee beyond the tier limit: £49/month per seat (Stripe add-on;
  price ID `STRIPE_PRICE_AIVA_SEAT_MONTHLY`).
- Employee seats are counted by active employees. Archived employees do not count.
- When a subscription is cancelled: Employees are archived, not deleted. Data retained
  per Privacy Policy retention schedule.

### Human-in-the-Loop Controls

The `approval_config` field defines which actions require human sign-off:

```json
{
  "email_send": true,      // show draft, wait for approval
  "crm_update": false,     // execute immediately
  "calendar_create": true, // show proposed event, wait for approval
  "invoice_log": false
}
```

When an action requires approval:
1. Employee creates an `employee_approvals` record with the proposed action payload.
2. Workspace owner receives an in-app notification and email.
3. Approver sees: "Aria wants to send this email. Approve / Reject / Edit."
4. If approved: action executes. Task log updated. Scout event streamed.
5. If rejected: task log updated, Employee continues to next task.
6. If not reviewed within the timeout (default 4 hours): action is NOT taken.
   Employee logs "approval timeout" and moves on. No silent auto-approve.

### Scout Enrollment for Employees

Every AI Employee is enrolled in Scout governance at creation. This is not optional.
Scout receives:
- Employee creation event: name, role, tools, risk level.
- Every task start and completion.
- Every approval request and decision.
- Every tool execution by the Employee.
- Every kill switch receipt and status change.

If Scout is disconnected (temporary outage), Employee tasks queue Scout events locally
and flush when Scout reconnects. Employees do NOT pause tasks due to Scout disconnection
(that would cause business disruption). They continue and back-fill the audit trail.

### Employee Creation UI

`frontend/src/app/(workspace)/employees/`

- List view: Employee cards with name, role, status (active/suspended), last active,
  task count this week.
- "New Employee" button: step-by-step wizard.
  - Step 1: Name and role (text fields, examples shown).
  - Step 2: Persona description.
  - Step 3: Tool selection (checkboxes from available workspace tools).
  - Step 4: Trigger setup (add triggers: cron/email/webhook).
  - Step 5: Approval config (toggle each action type).
  - Step 6: Review and activate. Show "Scout governance: included and enabled."

- Employee detail view: last 20 tasks, pending approvals, tool usage, Scout events link.
- "Suspend" and "Archive" buttons on each Employee.

**Implemented paths (workers naming):** list `/aiva/workers`, approvals `/aiva/approvals`, governance `/aiva/governance`.

---

## Acceptance Criteria

- New Aiva Pro/Enterprise subscription triggers Scout workspace provisioning at keys server.
- Scout workspace credentials stored against the Aiva account within 60 seconds of activation.
- All AI Employees in the workspace are enrolled in Scout at creation, with no opt-out.
- Employee task execution streams a Scout event within 30 seconds of task completion.
- An approval-required action creates an approval record and notifies the workspace owner.
- If the approval timeout (4 hours) is reached, the action is NOT taken and the task log
  records "approval timeout."
- Scout kill switch on an Employee sets its status to "suspended_by_scout" and queues
  all incoming triggers without executing them.
- Workspace owner is notified within 60 seconds of a kill switch being applied.
- Employee billing: base plan includes 2 Employees. 3rd Employee triggers a billing
  modal showing the per-seat price.
- "Aria" (an Employee) can receive a new email trigger, draft a response, present it
  for approval, and send it after the approver clicks "Approve" - end to end in one
  session test.
- Scout dashboard link in Aiva sidebar opens the correct Scout workspace.
