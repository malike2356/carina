#!/usr/bin/env python3
"""Generate YouTube Channel domains/niches mirrored from Aiva role personas."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path("/opt/lampp/htdocs/verlox/carina/02-backends/core.carinaai.uk/src/content/script-generator")
ROLE_PATH = Path("/opt/lampp/htdocs/verlox/carina/02-backends/core.carinaai.uk/src/workers/role-templates.ts")
EXISTING = ROOT / "niches.ts"

PROPERTY_NICHE_IDS = [
    "buy-to-let-investment",
    "house-flipping-renovation",
    "commercial-property",
    "hmo-multi-let",
    "property-sourcing",
    "first-time-buyer-guides",
    "landlord-tips-legislation",
    "property-market-analysis",
    "auction-property-walkthroughs",
]

DEFAULT_SEEDS = [
    ("fundamentals", "Fundamentals", "Core concepts and beginner-friendly explainers"),
    ("playbooks", "Playbooks and workflows", "Step-by-step operating playbooks for real teams"),
    ("tools-stack", "Tools and systems", "Software, templates, and system design tips"),
    ("mistakes-fixes", "Common mistakes", "Failures, traps, and how to recover"),
    ("case-studies", "Case studies", "Worked examples with numbers and outcomes"),
]

FOCUS = {
    "property-manager": ("Location", "e.g. Manchester"),
    "mortgage-broker-assistant": ("Location", "e.g. Leeds"),
    "financial-analyst": ("Audience or focus", "e.g. UK founders"),
    "accounts-payable": ("Audience or focus", "e.g. SME finance teams"),
    "sales-assistant": ("Audience or focus", "e.g. B2B SaaS"),
    "outreach-coordinator": ("Audience or focus", "e.g. agency owners"),
    "personal-coach": ("Audience or focus", "e.g. busy professionals"),
    "student-assistant": ("Audience or focus", "e.g. GCSE / uni students"),
    "healthcare-receptionist": ("Audience or focus", "e.g. private clinics"),
    "patient-care-coordinator": ("Audience or focus", "e.g. outpatient teams"),
    "it-helpdesk": ("Audience or focus", "e.g. remote-first teams"),
    "automation-specialist": ("Audience or focus", "e.g. ops managers"),
    "travel-concierge": ("Audience or focus", "e.g. frequent travellers"),
    "restaurant-host": ("Audience or focus", "e.g. independent restaurants"),
    "admissions-officer": ("Audience or focus", "e.g. sixth form / uni"),
    "legal-intake-coordinator": ("Audience or focus", "e.g. UK law firms"),
    "compliance-assistant": ("Audience or focus", "e.g. regulated SMEs"),
    "ecommerce-order-support": ("Audience or focus", "e.g. Shopify stores"),
    "social-media-manager": ("Audience or focus", "e.g. brand builders"),
    "marketing-campaign-coordinator": ("Audience or focus", "e.g. product marketers"),
    "content-assistant": ("Audience or focus", "e.g. indie creators"),
    "grant-writer-assistant": ("Audience or focus", "e.g. charities"),
    "research-analyst": ("Audience or focus", "e.g. policy teams"),
    "field-service-dispatcher": ("Audience or focus", "e.g. trade businesses"),
    "field-monitor": ("Audience or focus", "e.g. site supervisors"),
}

# slug, label, description, keywords (4-8)
SPECIFIC: dict[str, list[tuple[str, str, str, list[str]]]] = {
    "outreach-coordinator": [
        ("cold-email-sequences", "Cold email sequences", "Building polite sequences that book replies", ["cold email", "follow up", "reply rate", "subject lines"]),
        ("lead-lists", "Lead list building", "Finding and cleaning prospect lists", ["lead list", "ICP", "enrichment", "prospecting"]),
        ("follow-up-cadence", "Follow-up cadence", "Timing rules that avoid spam perception", ["cadence", "nurture", "touchpoints", "pipeline"]),
        ("personalisation-at-scale", "Personalisation at scale", "Merge fields and research without fake intimacy", ["personalisation", "snippets", "opening lines"]),
        ("outreach-metrics", "Outreach metrics", "What to track beyond open rates", ["open rate", "reply rate", "booked calls"]),
    ],
    "financial-analyst": [
        ("expense-categorisation", "Expense categorisation", "Clean categories that finance can trust", ["expenses", "chart of accounts", "bookkeeping"]),
        ("invoice-reads", "Reading invoices", "Spotting errors and missing lines fast", ["invoice", "AP", "VAT", "matching"]),
        ("monthly-reporting", "Monthly reporting", "Dashboards that explain variance", ["variance", "P&L", "KPI"]),
        ("cashflow-basics", "Cash flow basics", "Runway and working capital explainers", ["cash flow", "runway", "forecast"]),
        ("budget-vs-actual", "Budget vs actual", "Closing the loop between plan and spend", ["budget", "actuals", "reforecast"]),
    ],
    "content-assistant": [
        ("drafting-habits", "Drafting habits", "Ship first drafts without perfectionism", ["drafting", "editing", "outline"]),
        ("repurposing", "Repurposing content", "One asset into many channel formats", ["repurposing", "clipping", "newsletter"]),
        ("research-to-script", "Research to script", "Turning sources into a clean narrative", ["research", "script", "angle"]),
        ("style-guides", "Style guides", "Voice rules teams can actually follow", ["style guide", "tone", "brand voice"]),
        ("content-calendar", "Content calendars", "Planning without drowning in tools", ["content calendar", "batching", "pillars"]),
    ],
    "calendar-manager": [
        ("time-blocking", "Time blocking", "Protect deep work without rigid days", ["time block", "focus time", "meetings"]),
        ("meeting-hygiene", "Meeting hygiene", "Agendas, owners, and default declines", ["meetings", "agenda", "async"]),
        ("scheduling-ops", "Scheduling operations", "Buffers, travel, and timezone traps", ["scheduling", "timezone", "buffers"]),
        ("reminder-systems", "Reminder systems", "Nudges that get action, not noise", ["reminders", "follow up", "alerts"]),
        ("prep-briefs", "Meeting prep briefs", "One-pagers before every important call", ["prep brief", "stakeholders", "notes"]),
    ],
    "email-handler": [
        ("inbox-systems", "Inbox systems", "Triage that survives a busy week", ["inbox", "triage", "filters"]),
        ("clear-email-writing", "Clear email writing", "Short emails that still sound human", ["email writing", "brevity", "CTA"]),
        ("delegation-by-email", "Delegation by email", "Requests people can act on", ["delegation", "deadlines", "owners"]),
        ("customer-email-replies", "Customer email replies", "Templates that do not feel canned", ["replies", "templates", "support"]),
        ("email-security-habits", "Email security habits", "Phishing and spoof basics for staff", ["phishing", "spoofing", "2FA"]),
    ],
    "customer-support": [
        ("ticket-triage", "Ticket triage", "Priority without chaos", ["triage", "SLA", "priority"]),
        ("empathy-scripts", "Empathy without overpromising", "Tone that de-escalates", ["empathy", "de-escalation", "scripts"]),
        ("knowledge-base", "Knowledge base habits", "Articles that deflect repeat tickets", ["KB", "help centre", "deflection"]),
        ("escalation-paths", "Escalation paths", "When to loop in specialists", ["escalation", "severity", "on-call"]),
        ("csat-loops", "CSAT feedback loops", "Close the loop after tough tickets", ["CSAT", "QA", "coaching"]),
    ],
    "executive-assistant": [
        ("executive-comms", "Executive communications", "Briefs, updates, and decision notes", ["briefing", "status update", "decision log"]),
        ("stakeholder-maps", "Stakeholder maps", "Who needs what, when", ["stakeholders", "RACI", "comms plan"]),
        ("travel-ops", "Travel and logistics", "Itineraries that survive change", ["travel", "itinerary", "logistics"]),
        ("priority-protection", "Protecting priorities", "Gatekeeping without politics", ["priorities", "calendar defense"]),
        ("meeting-notes", "Actionable meeting notes", "Notes that create owners", ["notes", "actions", "owners"]),
    ],
    "personal-coach": [
        ("habit-systems", "Habit systems", "Tiny habits that compound", ["habits", "streaks", "cue routine reward"]),
        ("goal-setting", "Goal setting", "Goals that survive busy months", ["goals", "milestones", "OKRs"]),
        ("accountability", "Accountability loops", "Check-ins that do not shame", ["accountability", "check-in", "coaching"]),
        ("energy-management", "Energy management", "Sleep, stress, and focus basics", ["energy", "burnout", "recovery"]),
        ("mindset-skills", "Practical mindset skills", "Reframes you can use the same day", ["mindset", "reframe", "self talk"]),
    ],
    "recruitment-coordinator": [
        ("job-briefs", "Job briefs that attract", "Writing roles candidates understand", ["job description", "scorecard"]),
        ("screening-calls", "Screening call structure", "Fair screens without wasting time", ["screen", "interview", "scorecard"]),
        ("pipeline-ops", "Recruiting pipeline ops", "Stages, SLAs, and candidate experience", ["ATS", "pipeline", "SLA"]),
        ("interview-kits", "Interview kits", "Structured questions and rubrics", ["interview kit", "rubric", "bias"]),
        ("offer-handoffs", "Offer and onboarding handoffs", "From yes to day one", ["offer", "onboarding", "handoff"]),
    ],
    "sales-assistant": [
        ("discovery-calls", "Discovery calls", "Questions that uncover real need", ["discovery", "qualification", "BANT"]),
        ("demo-structure", "Demo structure", "Teach then sell", ["demo", "storytelling", "product tour"]),
        ("objection-handling", "Objection handling", "Honest replies that keep trust", ["objections", "pricing", "competitors"]),
        ("pipeline-hygiene", "Pipeline hygiene", "Stages that match reality", ["CRM", "pipeline", "forecast"]),
        ("follow-up-selling", "Follow-up that sells", "Nudges after the meeting", ["follow up", "proposal", "next step"]),
    ],
    "legal-intake-coordinator": [
        ("intake-forms", "Intake forms that work", "Enough detail without friction", ["intake", "forms", "matter opening"]),
        ("conflict-checks", "Conflict check hygiene", "Basics teams forget", ["conflict check", "compliance"]),
        ("client-updates", "Client update cadence", "Status without jargon", ["updates", "clients", "status"]),
        ("document-requests", "Document request playbooks", "Getting files in once", ["documents", "checklist", "chase"]),
        ("referral-routing", "Referral and routing", "Right specialist, right speed", ["referral", "routing", "triage"]),
    ],
    "social-media-manager": [
        ("content-pillars", "Content pillars", "Themes that stop random posting", ["pillars", "strategy", "calendar"]),
        ("short-form-hooks", "Short-form hooks", "Openings that earn the scroll", ["hooks", "reels", "shorts"]),
        ("community-replies", "Community replies", "Comment strategy that builds trust", ["comments", "community", "engagement"]),
        ("analytics-reviews", "Social analytics reviews", "Metrics that change the next post", ["analytics", "reach", "saves"]),
        ("brand-safety", "Brand safety basics", "What not to improvise publicly", ["brand safety", "crisis", "approvals"]),
    ],
    "healthcare-receptionist": [
        ("front-desk-flow", "Front desk flow", "Arrival to seated without chaos", ["reception", "check-in", "waiting room"]),
        ("appointment-reminders", "Appointment reminders", "Reduce DNAs politely", ["DNA", "reminders", "booking"]),
        ("patient-comms", "Patient communications", "Clear, calm, compliant language", ["patient comms", "tone", "privacy"]),
        ("privacy-basics", "Privacy at reception", "What never goes on screens or chats", ["GDPR", "privacy", "confidentiality"]),
        ("busy-clinic-ops", "Busy clinic operations", "Peaks, queues, and triage cues", ["clinic ops", "triage", "queues"]),
    ],
    "patient-care-coordinator": [
        ("care-pathways", "Care pathway explainers", "What happens between visits", ["pathway", "follow-up", "coordination"]),
        ("multi-provider-updates", "Multi-provider updates", "Keeping everyone aligned", ["care team", "handoffs", "updates"]),
        ("visit-prep", "Visit prep checklists", "What patients need ready", ["prep", "checklist", "forms"]),
        ("no-show-recovery", "No-show recovery", "Restart care without blame", ["no-show", "rebook", "outreach"]),
        ("outcomes-tracking", "Light outcomes tracking", "Simple measures teams can keep", ["outcomes", "follow-up"]),
    ],
    "research-analyst": [
        ("desk-research", "Desk research method", "Source quality and notes", ["desk research", "sources", "notes"]),
        ("evidence-tables", "Evidence tables", "Compare claims side by side", ["evidence", "matrix", "synthesis"]),
        ("brief-writing", "Research briefs", "One-pagers leaders will read", ["brief", "exec summary", "findings"]),
        ("data-storytelling", "Data storytelling", "Charts that support one point", ["charts", "narrative", "insight"]),
        ("uncertainty", "Communicating uncertainty", "Confidence without hiding gaps", ["uncertainty", "limits", "caveats"]),
    ],
    "it-helpdesk": [
        ("ticket-hygiene", "IT ticket hygiene", "Repro steps that save hours", ["tickets", "repro", "priority"]),
        ("access-requests", "Access request flows", "Least privilege without friction", ["access", "IAM", "onboarding"]),
        ("device-basics", "Device setup basics", "Laptops, phones, and MFA", ["devices", "MFA", "MDM"]),
        ("incident-comms", "Incident communications", "Status updates people trust", ["incident", "status page", "comms"]),
        ("self-serve-fixes", "Self-serve fixes", "Guides that deflect easy tickets", ["KB", "self serve", "howto"]),
    ],
    "event-coordinator": [
        ("run-of-show", "Run of show planning", "Minute-by-minute that survives change", ["run of show", "timeline", "cue"]),
        ("vendor-management", "Vendor management", "Briefs, SLAs, and day-of contacts", ["vendors", "contracts", "brief"]),
        ("attendee-comms", "Attendee communications", "Reminders that raise show rates", ["attendees", "RSVP", "reminders"]),
        ("budget-control", "Event budget control", "Scopes that do not creep silently", ["budget", "change orders"]),
        ("post-event", "Post-event wrap", "Notes, thank yous, and next year seeds", ["debrief", "NPS", "follow up"]),
    ],
    "accounts-payable": [
        ("invoice-intake", "Invoice intake", "Capture to approve without piles", ["AP", "invoice", "capture"]),
        ("three-way-match", "Three-way match basics", "PO, receipt, invoice explained", ["3 way match", "PO", "receiving"]),
        ("payment-runs", "Payment runs", "Cadence, controls, and exceptions", ["payment run", "approvals", "exceptions"]),
        ("supplier-queries", "Supplier query handling", "Polite chase and dispute paths", ["suppliers", "disputes", "queries"]),
        ("close-process", "Month-end AP close", "Cutoffs teams can meet", ["close", "cutoffs", "accruals"]),
    ],
    "ecommerce-order-support": [
        ("order-status", "Order status playbooks", "Wording that reduces repeats", ["order status", "shipping", "tracking"]),
        ("returns", "Returns and refunds", "Policies that stay human", ["returns", "refunds", "RMA"]),
        ("damaged-goods", "Damaged goods handling", "Photos, replacements, and logs", ["damage", "replacement", "claims"]),
        ("stock-issues", "Stock and delay messaging", "Honesty that keeps trust", ["OOS", "delays", "backorder"]),
        ("review-recovery", "Review recovery", "Turning a fix into loyalty", ["reviews", "CSAT", "recovery"]),
    ],
    "restaurant-host": [
        ("door-flow", "Door and seating flow", "Cues that keep the room calm", ["host", "seating", "waitlist"]),
        ("reservation-ops", "Reservation operations", "No-shows, covers, and special notes", ["reservations", "covers", "allergies"]),
        ("guest-recovery", "Guest recovery", "Complaints without freezing the floor", ["complaints", "comps", "recovery"]),
        ("service-timing", "Service timing cues", "When to seat, check, and turn", ["turns", "timing", "floor"]),
        ("team-signals", "Floor team signals", "Quiet coordination under pressure", ["expo", "signals", "handoffs"]),
    ],
    "mortgage-broker-assistant": [
        ("document-chasing", "Mortgage document chasing", "Packs that complete first time", ["documents", "DIP", "affordability"]),
        ("client-updates", "Broker client updates", "Calm status when lenders move slowly", ["updates", "lender", "cases"]),
        ("product-explainers", "Mortgage product explainers", "Jargon-free rate and fee talks", ["rates", "fees", "fixed vs variable"]),
        ("application-hygiene", "Application hygiene", "Common rejects and how to avoid them", ["underwriting", "rejects", "accuracy"]),
        ("completion-day", "Completion day prep", "What clients should expect", ["completion", "exchange", "keys"]),
    ],
    "client-onboarding-specialist": [
        ("welcome-sequences", "Welcome sequences", "First week that builds confidence", ["onboarding", "welcome", "checklist"]),
        ("data-capture", "Clean data capture", "Forms that teams will fill", ["forms", "CRM", "data quality"]),
        ("handoff-briefs", "Handoff briefs", "Sales to delivery without dropouts", ["handoff", "kickoff", "brief"]),
        ("activation-milestones", "Activation milestones", "Early wins that stick", ["activation", "time to value"]),
        ("churn-signals", "Early churn signals", "Spot silence before cancellation", ["churn", "health score", "outreach"]),
    ],
    "partnership-coordinator": [
        ("partner-outreach", "Partner outreach", "Warm introductions that respect time", ["partners", "intro", "BD"]),
        ("joint-campaigns", "Joint campaigns", "Shared goals and assets", ["co-marketing", "campaign", "assets"]),
        ("partner-ops", "Partner operations", "Pipeline, tracking, and renewals", ["partner CRM", "renewals", "pipeline"]),
        ("enablement", "Partner enablement", "Kits partners can actually use", ["enablement", "deck", "FAQ"]),
        ("conflict-handling", "Partnership conflict handling", "Overlaps and credits without drama", ["conflict", "attribution", "territory"]),
    ],
    "travel-concierge": [
        ("itinerary-design", "Itinerary design", "Days that breathe, not cram", ["itinerary", "pace", "logistics"]),
        ("booking-hygiene", "Booking hygiene", "Confirmations, changes, and buffers", ["bookings", "changes", "buffers"]),
        ("travel-risk", "Travel risk basics", "Docs, insurance, and contingencies", ["insurance", "documents", "risk"]),
        ("client-preferences", "Preference capture", "Remember without creepiness", ["preferences", "CRM", "notes"]),
        ("disruption-playbooks", "Disruption playbooks", "Missed connections and Plan B", ["disruption", "rebooking", "comms"]),
    ],
    "community-manager": [
        ("community-guidelines", "Community guidelines", "Rules that people follow", ["guidelines", "moderation", "safety"]),
        ("welcome-rituals", "Welcome rituals", "First posts that invite belonging", ["welcome", "onboarding", "rituals"]),
        ("moderation", "Everyday moderation", "Tone, bans, and de-escalation", ["moderation", "escalation", "trust"]),
        ("programming", "Community programming", "Events and prompts that spark talk", ["events", "prompts", "AMAs"]),
        ("health-metrics", "Community health metrics", "Beyond vanity counts", ["retention", "active members"]),
    ],
    "project-coordinator": [
        ("project-kickoffs", "Project kickoffs", "Charters people read", ["kickoff", "charter", "scope"]),
        ("status-rhythms", "Status rhythms", "Updates that unblock", ["status", "stand-up", "RAID"]),
        ("risk-logs", "Risk and issue logs", "Living lists that matter", ["risks", "issues", "RAID"]),
        ("dependency-maps", "Dependency maps", "Who waits on whom", ["dependencies", "critical path"]),
        ("closeout", "Project closeout", "Handover and lessons without blame", ["closeout", "retro", "handover"]),
    ],
    "field-service-dispatcher": [
        ("job-scheduling", "Job scheduling", "Routes that respect travel and skills", ["dispatch", "routing", "SLA"]),
        ("tech-briefings", "Technician briefings", "Job packs that reduce revisits", ["brief", "parts", "access"]),
        ("customer-etas", "Customer ETAs", "Honest windows and updates", ["ETA", "windows", "comms"]),
        ("emergency-triage", "Emergency triage", "What jumps the queue", ["emergency", "priority", "triage"]),
        ("first-time-fix", "First-time-fix habits", "Checklists that cut come-backs", ["FTF", "checklists", "QA"]),
    ],
    "admissions-officer": [
        ("application-explainers", "Application explainers", "Steps applicants actually follow", ["admissions", "applications", "deadlines"]),
        ("interview-days", "Interview and open days", "Ops that feel welcoming", ["open day", "interviews", "hosts"]),
        ("document-checks", "Document checks", "Missing pieces without chaos", ["transcripts", "refs", "checklist"]),
        ("offer-comms", "Offer communications", "Clarity on next steps", ["offers", "conditions", "enrolment"]),
        ("yield-protection", "Yield and conversion", "From offer to enrolled without pressure tactics", ["conversion", "yield", "enrolment"]),
    ],
    "hr-benefits-coordinator": [
        ("benefits-explainers", "Benefits explainers", "Jargon-free coverage talks", ["benefits", "pension", "healthcare"]),
        ("enrolment-windows", "Enrolment windows", "Reminders that raise completion", ["open enrolment", "deadlines", "comms"]),
        ("life-events", "Life event changes", "What to update and when", ["life events", "dependants", "updates"]),
        ("faq-deflection", "Benefits FAQ deflection", "Answers that cut ticket volume", ["FAQ", "KB", "tickets"]),
        ("vendor-coordination", "Benefits vendor coordination", "Brokers and portals without drops", ["vendors", "portals", "SLA"]),
    ],
    "compliance-assistant": [
        ("policy-explainers", "Policy explainers", "Plain English without watered rules", ["policy", "controls", "compliance"]),
        ("evidence-packs", "Evidence packs", "Artefacts auditors expect", ["evidence", "audit", "controls"]),
        ("training-reminders", "Training reminders", "Completion without nagging theatre", ["training", "LMS", "reminders"]),
        ("risk-registers", "Light risk registers", "Living lists teams maintain", ["risk register", "owners", "reviews"]),
        ("incident-logging", "Incident logging", "What to capture first", ["incidents", "logs", "reporting"]),
    ],
    "grant-writer-assistant": [
        ("funders-fit", "Funder fit checks", "When not to apply", ["funders", "eligibility", "fit"]),
        ("narrative-arcs", "Grant narrative arcs", "Need, approach, impact", ["narrative", "case for support"]),
        ("budgets", "Grant budgets", "Costs that match activities", ["budget", "costings", "match funding"]),
        ("evidence", "Impact evidence", "Outcomes without hype", ["impact", "metrics", "evidence"]),
        ("submission-ops", "Submission operations", "Versions, attachments, deadlines", ["submission", "checklist", "deadline"]),
    ],
    "marketing-campaign-coordinator": [
        ("campaign-briefs", "Campaign briefs", "Goals, audience, offer, proof", ["brief", "campaign", "ICP"]),
        ("channel-mix", "Channel mix choices", "Where budget should go first", ["channels", "mix", "budget"]),
        ("launch-checklists", "Launch checklists", "Assets, QA, and owners", ["launch", "QA", "assets"]),
        ("measurement", "Campaign measurement", "One scoreboard per goal", ["measurement", "UTM", "ROI"]),
        ("retros", "Campaign retros", "What to keep next time", ["retro", "learnings", "iterate"]),
    ],
    "workspace-ops-admin": [
        ("ops-rhythms", "Ops rhythms", "Weekly systems that keep work moving", ["ops", "cadence", "rituals"]),
        ("sop-writing", "SOP writing", "Procedures people follow", ["SOP", "process", "docs"]),
        ("tool-sprawl", "Tool sprawl cleanup", "Fewer apps, clearer ownership", ["tools", "ownership", "admin"]),
        ("access-hygiene", "Access hygiene", "Starters and leavers done right", ["access", "joiner mover leaver"]),
        ("incident-lite", "Lightweight incident response", "When internal systems fail", ["incident", "comms", "rollback"]),
    ],
    "automation-specialist": [
        ("automation-candidates", "Finding automation candidates", "Work worthy of a bot", ["automation", "ROI", "pain"]),
        ("no-code-builds", "No-code builds", "Triggers, actions, and tests", ["zapier", "make", "n8n"]),
        ("error-handling", "Automation error handling", "Retries and human backups", ["errors", "retries", "alerts"]),
        ("security-in-automations", "Security in automations", "Secrets and least privilege", ["secrets", "scopes", "security"]),
        ("automation-debt", "Automation debt", "When to rebuild or retire", ["debt", "maintenance", "docs"]),
    ],
    "structured-extractor": [
        ("doc-types", "Document types", "Forms, invoices, and contracts patterns", ["OCR", "PDF", "forms"]),
        ("field-mapping", "Field mapping", "Schemas that survive OCR noise", ["schema", "fields", "mapping"]),
        ("validation", "Extraction validation", "Confidence and human review", ["validation", "confidence", "QA"]),
        ("pipelining", "Extraction pipelines", "Ingest to JSON to systems", ["pipeline", "ETL", "integrations"]),
        ("edge-cases", "Edge cases", "Handwriting, stamps, and skew", ["edge cases", "quality", "preprocessing"]),
    ],
    "field-monitor": [
        ("site-checklists", "Site checklists", "What to inspect every visit", ["checklist", "site", "inspection"]),
        ("photo-evidence", "Photo evidence habits", "Shots that prove condition", ["photos", "evidence", "timestamps"]),
        ("escalation", "Field escalation", "When to stop work and call in", ["escalation", "safety", "hold"]),
        ("daily-logs", "Daily field logs", "Notes crews will actually write", ["logs", "diary", "handover"]),
        ("remote-oversight", "Remote oversight", "Camera and sensor basics without theatre", ["sensors", "cameras", "monitoring"]),
    ],
    "personal-assistant": [
        ("daily-planning", "Daily planning", "Three priorities that survive chaos", ["planning", "priorities", "todo"]),
        ("life-admin", "Life admin batches", "Bills, bookings, and chases", ["life admin", "admin", "batching"]),
        ("decision-briefs", "Personal decision briefs", "Pros, cons, and next step", ["decisions", "brief", "options"]),
        ("household-ops", "Household operations", "Shared calendars and chores", ["household", "chores", "shared calendar"]),
        ("boundary-setting", "Boundary setting", "Protecting time and energy", ["boundaries", "no", "focus"]),
    ],
    "student-assistant": [
        ("study-systems", "Study systems", "Planning sessions that stick", ["study", "pomodoro", "revision"]),
        ("note-methods", "Note methods", "Capture that retrieves later", ["notes", "cornell", "anki"]),
        ("exam-prep", "Exam prep plans", "Timelines without panic", ["exams", "revision", "past papers"]),
        ("research-literacy", "Research literacy", "Sources and citations basics", ["research", "citations", "plagiarism"]),
        ("balance", "Study life balance", "Sleep, breaks, and burnout signs", ["balance", "sleep", "wellbeing"]),
    ],
}


def themes_for(label: str) -> list[str]:
    return [
        f"{label} fundamentals",
        f"{label} workflows",
        f"Tools for {label.lower()}",
        f"{label} mistakes",
        "Metrics that matter",
        f"{label} templates",
        "Team handoffs",
        "Client communications",
        "Quality checks",
        "Scaling the process",
        "Edge cases",
        "Monthly review",
    ]


def hooks_for(label: str) -> list[str]:
    low = label.lower()
    return [
        f"The {low} habit that saves {{location}} teams hours",
        f"Why most {{location}} beginners stall on {low}",
        f"A clear {low} plan for {{location}} this week",
    ]


def ctas_for(label: str) -> list[str]:
    low = label.lower()
    return [
        f"Subscribe for daily {low} explainers",
        f"Comment your biggest {low} blocker",
    ]


def extract_property_blocks(src: str) -> list[str]:
    blocks: list[str] = []
    for niche_id in PROPERTY_NICHE_IDS:
        pat = rf"'{re.escape(niche_id)}':\s*\{{.*?\n  \}},"
        m = re.search(pat, src, re.S)
        if not m:
            pat2 = rf"'{re.escape(niche_id)}':\s*\{{.*?\n  \}}"
            m = re.search(pat2, src, re.S)
            if not m:
                raise SystemExit(f"missing property niche {niche_id}")
            blocks.append(m.group(0).rstrip() + ",")
        else:
            blocks.append(m.group(0))
    return blocks


def main() -> None:
    text = ROLE_PATH.read_text()
    personas = re.findall(r"\{\s*id:\s*'([^']+)'\s*,\s*name:\s*'([^']+)'", text)
    descs: dict[str, str] = {}
    for m in re.finditer(r"id:\s*'([^']+)'([\s\S]*?)(?=\n  \{\s*id:|\n\];|\Z)", text):
        pid = m.group(1)
        dm = re.search(r"description:\s*'([^']*)'", m.group(2))
        descs[pid] = dm.group(1) if dm else ""

    domains: list[tuple[str, str, str, str, str]] = []
    for pid, name in personas:
        if pid == "property-manager":
            domains.append(
                (
                    "property",
                    "Property",
                    "UK property investing, letting, buying, and market analysis.",
                    "Location",
                    "e.g. Manchester",
                )
            )
        else:
            fl, fp = FOCUS.get(pid, ("Audience or focus", "e.g. beginners"))
            domains.append(
                (
                    pid,
                    name,
                    descs.get(pid) or f"Channel explainers for {name.lower()} work.",
                    fl,
                    fp,
                )
            )

    domains.append(
        (
            "language-learning",
            "Language learning",
            "Practical language practice, study systems, and conversation confidence.",
            "Audience or focus",
            "e.g. English learners",
        )
    )

    if len(domains) < 40:
        raise SystemExit(f"expected >=40 domains, got {len(domains)}")

    existing = EXISTING.read_text()
    property_blocks = extract_property_blocks(existing)

    types_path = ROOT / "channel-types.ts"
    types_path.write_text(
        """export const CHANNEL_DOMAIN_IDS = [] as string[];
// Runtime domain ids come from GENERATED_DOMAIN_IDS; type is open string for pack growth.
export type ChannelDomainId = string;

export interface ChannelDomainDefinition {
  id: ChannelDomainId;
  label: string;
  description: string;
  focusLabel: string;
  focusPlaceholder: string;
}

export type ChannelNicheId = string;

export interface ChannelNicheDefinition {
  id: ChannelNicheId;
  domainId: ChannelDomainId;
  label: string;
  description: string;
  keywords: string[];
  weeklyThemes: string[];
  hookTemplates: string[];
  ctaTemplates: string[];
}
"""
    )

    lines: list[str] = []
    lines.append("/** Generated from Aiva role personas. Regenerate with scripts/generate-channel-catalogue.py */")
    lines.append("import type { ChannelDomainDefinition, ChannelNicheDefinition } from './channel-types.js';")
    lines.append("")
    lines.append("export const GENERATED_DOMAIN_IDS = [")
    for did, *_ in domains:
        lines.append(f"  '{did}',")
    lines.append("] as const;")
    lines.append("")
    lines.append("export const GENERATED_DOMAINS: Record<string, ChannelDomainDefinition> = {")
    for did, label, description, fl, fp in domains:
        lines.append(f"  '{did}': {{")
        lines.append(f"    id: '{did}',")
        lines.append(f"    label: {json.dumps(label)},")
        lines.append(f"    description: {json.dumps(description)},")
        lines.append(f"    focusLabel: {json.dumps(fl)},")
        lines.append(f"    focusPlaceholder: {json.dumps(fp)},")
        lines.append("  },")
    lines.append("};")
    lines.append("")
    lines.append("export const GENERATED_NICHES: Record<string, ChannelNicheDefinition> = {")
    for block in property_blocks:
        lines.append("  " + block.strip())

    for did, label, *_rest in domains:
        if did == "property":
            continue
        if did == "language-learning":
            seeds = [
                ("daily-practice", "Daily practice systems", "Short sessions that compound", ["practice", "streak", "immersion", "anki"]),
                ("listening-speaking", "Listening and speaking", "Input and conversation drills", ["listening", "speaking", "shadowing"]),
                ("grammar-light", "Grammar light", "Only the rules you need now", ["grammar", "usage", "examples"]),
                ("vocab-systems", "Vocabulary systems", "Words that stick in context", ["vocabulary", "SRS", "phrases"]),
                ("confidence", "Speaking confidence", "Reduce freeze in real conversations", ["confidence", "fluency", "mistakes"]),
            ]
            # map under language-learning ids
            persona_key = None
        else:
            persona_key = did
            seeds = SPECIFIC.get(persona_key)
            if not seeds:
                seeds = [
                    (
                        slug,
                        nlabel,
                        ndesc,
                        [slug.replace("-", " "), label.lower(), "playbook", "systems"],
                    )
                    for slug, nlabel, ndesc in DEFAULT_SEEDS
                ]

        for slug, nlabel, ndesc, kws in seeds:
            nid = f"{did}-{slug}"
            lines.append(f"  '{nid}': {{")
            lines.append(f"    id: '{nid}',")
            lines.append(f"    domainId: '{did}',")
            lines.append(f"    label: {json.dumps(nlabel)},")
            lines.append(f"    description: {json.dumps(ndesc)},")
            lines.append(f"    keywords: {json.dumps(list(dict.fromkeys(kws))[:8])},")
            lines.append(f"    weeklyThemes: {json.dumps(themes_for(nlabel))},")
            lines.append(f"    hookTemplates: {json.dumps(hooks_for(nlabel))},")
            lines.append(f"    ctaTemplates: {json.dumps(ctas_for(nlabel))},")
            lines.append("  },")

    lines.append("};")
    lines.append("")
    lines.append("export const GENERATED_NICHE_IDS = Object.keys(GENERATED_NICHES);")
    lines.append("")

    out = ROOT / "channel-catalogue.generated.ts"
    out.write_text("\n".join(lines) + "\n")
    print(f"wrote {out}")
    print(f"domains={len(domains)} niches={9 + (len(domains)-1)*5}")


if __name__ == "__main__":
    main()
