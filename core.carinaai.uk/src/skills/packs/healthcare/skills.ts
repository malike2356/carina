import type { PackSkillInput } from '../property-uk/skills.js';

export const healthcareSkills: PackSkillInput[] = [
  {
    name: 'clinical-note-summary',
    description: 'Summarise clinical notes and referral letters into structured briefs',
    trigger: ['clinical note', 'referral letter', 'patient summary', 'medical record', 'discharge summary'],
    steps: `1. Read the document via file-read from user resources.
2. Extract: patient context, presenting complaint, history, medications, allergies, plan.
3. Flag missing critical fields (allergies, contraindications).
4. Output a structured brief; never diagnose or prescribe.
5. Remind user this is administrative support, not medical advice.`,
    toolsUsed: ['file-read', 'file-write'],
  },
  {
    name: 'appointment-scheduling',
    description: 'Draft appointment schedules and patient communication templates',
    trigger: ['appointment', 'schedule clinic', 'patient reminder', 'booking slot'],
    steps: `1. Clarify appointment type, duration, and availability windows.
2. Draft schedule options and patient-facing reminder text.
3. Use calendar integration if configured (google-workspace skill).
4. Confirm before sending any patient communication.`,
    toolsUsed: ['file-write', 'email-send'],
  },
  {
    name: 'compliance-checklist',
    description: 'Healthcare regulatory and safety compliance checklists',
    trigger: ['CQC', 'clinical governance', 'infection control', 'healthcare compliance', 'safeguarding'],
    steps: `1. Identify the compliance domain (CQC, GDPR health data, safeguarding).
2. Run through relevant checklist items from domain knowledge.
3. Flag overdue reviews and missing documentation.
4. Recommend specialist review for legal/clinical decisions.`,
    toolsUsed: ['web-search', 'file-read', 'session-search'],
  },
  {
    name: 'medication-reconciliation',
    description: 'Compare medication lists across documents for discrepancies',
    trigger: ['medication list', 'drug reconciliation', 'prescription check', 'medication review'],
    steps: `1. Extract medication names, doses, and frequencies from each source document.
2. Build a comparison table highlighting additions, omissions, and dose changes.
3. Flag high-risk interactions for pharmacist/GP review.
4. Never recommend starting, stopping, or changing medications.`,
    toolsUsed: ['file-read'],
  },
  {
    name: 'patient-communication',
    description: 'Draft clear, accessible patient-facing communications',
    trigger: ['patient letter', 'explain to patient', 'patient information', 'consent form'],
    steps: `1. Use plain language (reading age 12-14 target).
2. Avoid jargon; define necessary medical terms.
3. Include what happens next, contact details, and urgency signals.
4. Review for tone: respectful, clear, non-alarming unless warranted.`,
    toolsUsed: ['file-write'],
  },
];
