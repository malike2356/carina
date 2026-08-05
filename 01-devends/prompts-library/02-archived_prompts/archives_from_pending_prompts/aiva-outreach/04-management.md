# Phase 04: Management -- Kanban Pipeline, Follow-Ups, Analytics

**Status:** Build after Phase 03 (meetings happening, pipeline filling up)
**Target:** 4 prompts, 1 week.

---

## Prompt 04-01: Kanban Pipeline (Trello Integration)

**Depends on:** Phase 03 (leads moving through stages)
**Target time:** 6 hours

### What This Builds

A visual kanban pipeline that tracks every lead through the outreach funnel. Papa Lord sees at a glance: who's been contacted, who responded, who's booked, who's won, who's lost.

### Implementation

Use Aiva's existing Trello integration (already wired for Salim). Create a dedicated Trello board for outreach. Each column is a pipeline stage. Each card is a lead.

**Pipeline columns:**
1. **Found** -- leads scraped, not yet contacted
2. **Contacted** -- email sent, waiting for response
3. **Responded** -- lead replied
4. **Booked** -- meeting scheduled
5. **Meeting Done** -- meeting happened, awaiting outcome
6. **Won** -- client signed
7. **Lost** -- not interested / no response after follow-up

When a lead moves between stages, the Trello card moves to the corresponding column. Card details include: lead name, company, email, last contact date, notes, meeting date (if booked).

### Key Deliverables

- Trello board auto-created on campaign start (or configured once)
- Lead -> Trello card creation (with lead details)
- Card movement synced with lead status changes
- Card labels: positive (green), neutral (yellow), negative (red)
- Card checklist: key actions completed (email sent, response received, meeting booked)
- Papa Lord can add notes to cards directly in Trello (Aiva reads them)
- Telegram: `/pipeline` -> shows summary: "Found: 45 | Contacted: 30 | Responded: 5 | Booked: 2 | Won: 0"

### Files to Create

- `src/workers/product-tools/outreach/kanban/trello-sync.ts`
- Update lead status change handler to trigger Trello sync

### Acceptance Criteria

- Campaign created -> Trello board with 7 columns created
- Lead scraped -> Trello card in "Found" column
- Email sent -> card moves to "Contacted"
- Lead responds -> card moves to "Responded" with green label
- Meeting booked -> card moves to "Booked" with meeting date
- Papa Lord adds note in Trello -> Aiva reads and stores on lead record

---

## Prompt 04-02: Native Kanban (Aiva Dashboard)

**Depends on:** 04-01 (Trello integration working, as reference)
**Target time:** 8 hours

### What This Builds

A native kanban view inside Aiva's dashboard. No Trello required. Papa Lord can see and manage the entire pipeline from Aiva's workspace.

### Implementation

A drag-and-drop kanban board rendered in Aiva's worker dashboard (web UI). Columns match the pipeline stages. Cards are leads. Click a card to see lead details, conversation history, notes, and actions.

Built with vanilla HTML/CSS/JS or a lightweight library. No React if avoidable. Served from Aiva's existing dashboard routes.

### Key Deliverables

- Kanban board at `/worker/outreach/pipeline`
- 7 columns: Found, Contacted, Responded, Booked, Meeting Done, Won, Lost
- Cards show: lead name, company, last activity, status indicator
- Click card -> detail panel: full lead info, email history, meeting details, notes
- Drag card to move between columns (manual override of automated status)
- Quick actions per card: "Send Email", "Schedule Meeting", "Add Note", "Mark Won/Lost"
- Filter by campaign
- Search leads by name, company, email
- Kanban view also accessible via Telegram: `/pipeline` shows text summary, `/pipeline <campaignId>` shows that campaign's board

### Files to Create

- `src/workers/product-tools/outreach/kanban/dashboard.ts` -- API endpoints
- `src/workers/product-tools/outreach/kanban/ui.html` -- kanban board HTML/CSS/JS
- `src/workers/product-tools/outreach/kanban/ui.js` -- kanban interaction logic

### Acceptance Criteria

- Kanban board loads with all pipeline columns
- Cards appear in correct columns based on lead status
- Drag a card from "Responded" to "Booked" -> lead status updates
- Click card -> detail panel shows full lead info
- Quick action "Send Email" opens compose with lead pre-filled
- Filter by campaign shows only that campaign's leads

---

## Prompt 04-03: Follow-Up Engine

**Depends on:** Phase 03 (meetings happening, some leads going cold)
**Target time:** 6 hours

### What This Builds

Automated follow-up sequences for leads that go cold. If a lead responds positively then goes silent, or a meeting happens and they say "I'll get back to you" and then nothing, Aiva follows up automatically on a schedule.

### Implementation

**Follow-up triggers:**
1. Lead responded positively but hasn't booked a meeting in 3 days -> follow-up email
2. Meeting happened, outcome was "follow-up", no further contact in 5 days -> follow-up email
3. Meeting booked but lead no-showed -> follow-up email 1 hour after missed meeting
4. Lead opened email but didn't respond in 7 days -> gentle nudge

**Follow-up sequences (configurable):**
- Sequence 1 (gentle): "Just checking in..." (day 3) -> "Wanted to make sure you saw my last email..." (day 7) -> "Last attempt -- if you're not interested, no worries..." (day 14). Then mark as lost.
- Sequence 2 (post-meeting): "Great speaking with you..." (day 1) -> "Following up on our conversation..." (day 5) -> "Any questions I can answer?" (day 10). Then mark as follow-up needed, prompt Papa Lord.

### Key Deliverables

- Follow-up trigger detection: cron job checks for leads needing follow-up
- Sequence engine: configurable sequences with delays and templates
- Per-lead follow-up counter: max 3 follow-ups per lead
- Telegram notification: "3 leads due for follow-up today. Send?"
- Papa Lord approves or customizes before send: "Send follow-ups" or "Skip John, send the rest"
- Follow-up logging: every follow-up recorded on lead
- Auto-mark as lost: after final follow-up in sequence, if no response, mark lead as lost

### Files to Create

- `src/workers/product-tools/outreach/follow-up/engine.ts`
- `src/workers/product-tools/outreach/follow-up/sequences.ts`
- `src/workers/product-tools/outreach/follow-up/triggers.ts`

### Acceptance Criteria

- Lead 3 days post-positive-response with no booking -> follow-up email sent
- Lead 5 days post-meeting with no outcome -> follow-up email sent
- Papa Lord notified on Telegram: "3 follow-ups ready. Reply 'send' to dispatch."
- After 3 follow-ups with no response -> lead marked as lost
- Follow-up history visible on lead detail

---

## Prompt 04-04: Analytics and Reporting

**Depends on:** Phase 03 (pipeline has data flowing through it)
**Target time:** 6 hours

### What This Builds

Analytics dashboard showing outreach performance. Papa Lord sees what's working, what's not, and where to improve. This closes the loop: scrape -> outreach -> convert -> analyze -> improve.

### Key Metrics

- **Funnel conversion rates:** Found -> Contacted -> Responded -> Booked -> Won
- **Response rate:** % of contacted leads who respond
- **Booking rate:** % of responded leads who book a meeting
- **Win rate:** % of meetings that convert to clients
- **Time to response:** average hours from email send to lead response
- **Best performing template:** which email template gets highest response rate
- **Best performing source:** Google Maps vs Web Search vs LinkedIn
- **Campaign comparison:** side-by-side campaign performance

### Key Deliverables

- Analytics dashboard at `/worker/outreach/analytics`
- Funnel visualization: bar chart showing count at each stage
- Conversion rate card: "Response rate: 12% | Booking rate: 40% | Win rate: 25%"
- Template performance comparison
- Campaign comparison table
- Weekly summary: auto-generated report sent to Papa Lord on Telegram every Monday
  - "This week: 50 new leads, 45 contacted, 6 responses, 2 meetings booked, 1 won. Best template: 'Property Investor Intro' (18% response rate)."
- Export: CSV download of campaign data

### Files to Create

- `src/workers/product-tools/outreach/analytics.ts`
- `src/workers/product-tools/outreach/analytics-ui.html`
- Weekly report cron job

### Acceptance Criteria

- Funnel chart shows accurate counts at each stage
- Conversion rates calculated correctly
- Template comparison shows which template performs best
- Weekly Telegram summary accurate and useful
- CSV export includes all lead data
