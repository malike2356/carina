import type { PackSkillInput } from '../../pack-types.js';

export const legalUkSkills: PackSkillInput[] = [
  {
    name: 'contract-review-basics',
    description: 'Review UK property purchase contracts for key clauses and risks',
    trigger: ['contract review', 'property contract', 'sale contract', 'completion date', 'fixtures and fittings'],
    steps: `1. Identify parties, property address, purchase price, and completion date.
2. Check deposit amount, forfeiture terms, and conditions precedent (searches, mortgage, survey).
3. Review title guarantees, restrictive covenants, easements, and fixtures/chattels schedule.
4. Flag unusual indemnities, penalties, or seller-favouring clauses.
5. Output a plain-language risk summary; recommend solicitor review before exchange.`,
    toolsUsed: ['file-read', 'file-write'],
  },
  {
    name: 'section-21-notice',
    description: 'Assess Section 21 no-fault eviction notice validity for England ASTs',
    trigger: ['section 21', 'no-fault eviction', 'notice to quit', 'AST eviction', 'possession notice'],
    steps: `1. Confirm tenancy is an assured shorthold tenancy in England (not Wales without separate rules).
2. Check prescribed form, notice period (generally at least two months), and service method.
3. Verify deposit protection and prescribed information were served in time (if deposit taken).
4. Check retaliatory eviction and HMO/licensing constraints that can block Section 21.
5. State whether notice appears valid on facts given; recommend legal advice before court proceedings.`,
    toolsUsed: ['file-read', 'web-search'],
  },
  {
    name: 'lease-extension',
    description: 'Explain UK leasehold extension routes and eligibility',
    trigger: ['lease extension', 'leasehold reform', 'statutory extension', 'marriage value', 'peppercorn rent'],
    steps: `1. Confirm ownership period (generally two years for statutory route on flats).
2. Compare statutory lease extension vs informal negotiation with freeholder.
3. Outline premium factors: unexpired term, ground rent, property value (use surveyor for figures).
4. Note deadlines, notice steps, and counter-notice risks.
5. Recommend chartered surveyor and solicitor for formal claims; do not quote binding premiums.`,
    toolsUsed: ['web-search', 'file-write'],
  },
  {
    name: 'right-to-rent',
    description: 'Guide UK Right to Rent document checks and record keeping',
    trigger: ['right to rent', 'share code', 'tenant immigration check', 'RTR check', 'Home Office check'],
    steps: `1. Determine if checks apply (England private landlords; follow current Home Office guidance).
2. List acceptable documents or online share-code route for eligible tenants.
3. Record check date, document details, and checker identity; retain copies securely.
4. Set follow-up dates for time-limited permission.
5. Flag civil penalty exposure if checks are missed; recommend gov.uk guidance for edge cases.`,
    toolsUsed: ['web-search', 'file-write'],
  },
  {
    name: 'stamp-duty-land-tax',
    description: 'Estimate UK SDLT considerations for residential purchases (high level)',
    trigger: ['SDLT', 'stamp duty', 'stamp duty land tax', 'first-time buyer relief', 'additional property SDLT'],
    steps: `1. Capture purchase price, buyer status (first-time buyer, additional dwelling, corporate).
2. Apply current HMRC residential SDLT bands at a high level; note surcharges for additional properties.
3. Mention reliefs only when criteria clearly met (first-time buyer thresholds, etc.).
4. State figures are indicative; HMRC calculator and solicitor confirmation required.
5. Flag linked transactions and non-resident surcharges if relevant.`,
    toolsUsed: ['web-search', 'code-exec'],
  },
  {
    name: 'deposit-protection',
    description: 'Check UK tenancy deposit protection compliance steps',
    trigger: ['deposit protection', 'DPS', 'TDS', 'mydeposits', 'prescribed information', 'tenancy deposit'],
    steps: `1. Confirm deposit amount and tenancy start date.
2. Verify deposit protected within 30 days with an approved scheme (DPS, TDS, or MyDeposits).
3. Check prescribed information served to tenant and anyone who paid the deposit.
4. Note Section 21 and deposit claim implications if protection or information is late.
5. Provide remediation steps (protect late, serve information, seek legal advice if disputed).`,
    toolsUsed: ['file-read', 'web-search', 'file-write'],
  },
];
