import type { PackSkillInput } from '../property-uk/skills.js';

export const legalUkSkills: PackSkillInput[] = [
  {
    name: 'gdpr-readiness-check',
    description: 'Assess GDPR compliance gaps for a UK business handling personal data',
    trigger: ['GDPR', 'data protection', 'ICO compliance', 'privacy audit', 'lawful basis'],
    steps: `1. Identify data categories, processors, retention, and lawful bases.
2. Check rights workflows (access, erasure, portability) and breach procedures.
3. Flag missing records: RoPA, DPIA, DPA with processors, cookie/consent logs.
4. Output a prioritised remediation checklist with ICO guidance references.`,
    toolsUsed: ['file-read', 'web-search', 'file-write'],
  },
  {
    name: 'ast-generator',
    description: 'Draft a UK Assured Shorthold Tenancy agreement outline from deal terms',
    trigger: ['AST', 'tenancy agreement', 'assured shorthold', 'rental contract', 'tenant agreement'],
    steps: `1. Collect parties, property address, rent, deposit, term, and break clauses.
2. Include mandatory UK clauses: deposit protection, how to rent guide, EPC reference.
3. Flag items requiring solicitor review (guarantors, HMO licensing, company lets).
4. Output structured agreement sections; state this is a draft not legal advice.`,
    toolsUsed: ['file-write', 'web-search'],
  },
  {
    name: 'company-filing-helper',
    description: 'Prepare Companies House filing checklists and confirmation statement data',
    trigger: ['Companies House', 'confirmation statement', 'CS01', 'company filing', 'director change'],
    steps: `1. Confirm company number and last filed accounts/confirmation dates.
2. List required filings (CS01, AP01, TM01, share allotments) from user changes.
3. Gather registered office, SIC codes, PSC details for submission prep.
4. Output step-by-step filing checklist with deadlines.`,
    toolsUsed: ['web-search', 'file-write'],
  },
  {
    name: 'contract-review-uk',
    description: 'Review UK commercial contracts and highlight risk clauses',
    trigger: ['contract review', 'commercial contract', 'liability clause', 'indemnity', 'governing law'],
    steps: `1. Read contract and summarise parties, consideration, term, and termination.
2. Flag high-risk clauses: unlimited liability, auto-renewal, assignment, IP ownership, jurisdiction.
3. Compare against user-stated risk tolerance and negotiation priorities.
4. Suggest plain-language amendments; recommend solicitor sign-off for binding changes.`,
    toolsUsed: ['file-read', 'file-write'],
  },
];
