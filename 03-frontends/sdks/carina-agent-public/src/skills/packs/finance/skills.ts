import type { PackSkillInput } from '../property-uk/skills.js';

export const financeSkills: PackSkillInput[] = [
  {
    name: 'cashflow-forecast',
    description: 'Build monthly cashflow forecasts from income and expense data',
    trigger: ['cashflow', 'cash flow forecast', 'runway', 'monthly burn'],
    steps: `1. Gather income and expense line items from user or files.
2. Project 3-12 months with stated assumptions.
3. Highlight negative months and minimum cash balance.
4. Write results to a spreadsheet-friendly CSV or markdown table.`,
    toolsUsed: ['file-read', 'file-write', 'code-exec'],
  },
  {
    name: 'invoice-reconciliation',
    description: 'Match invoices to payments and flag discrepancies',
    trigger: ['reconcile invoices', 'invoice matching', 'accounts payable', 'payment discrepancy'],
    steps: `1. Load invoice and payment records from user resources.
2. Match by reference, amount, and date (fuzzy match on references).
3. Flag unmatched items on both sides.
4. Summarise totals and outstanding balance.`,
    toolsUsed: ['file-read'],
  },
  {
    name: 'vat-return-prep',
    description: 'Prepare UK VAT return data from transaction records',
    trigger: ['VAT return', 'VAT quarter', 'box 1', 'HMRC VAT', 'making tax digital'],
    steps: `1. Categorise transactions as standard rate, reduced, zero, exempt.
2. Calculate output VAT and input VAT by box.
3. Flag missing invoices or uncategorised items.
4. Output box totals; remind user to verify with accountant before filing.`,
    toolsUsed: ['file-read', 'code-exec'],
  },
  {
    name: 'investment-analysis',
    description: 'Analyse investment returns, IRR, and portfolio allocation',
    trigger: ['IRR', 'investment return', 'portfolio analysis', 'ROI calculation', 'cap rate'],
    steps: `1. Gather purchase price, income, costs, and exit assumptions.
2. Calculate gross yield, net yield, IRR, and payback period.
3. Run sensitivity on key variables (+/- 10%).
4. Present results with clear assumptions stated.`,
    toolsUsed: ['code-exec', 'file-write'],
  },
  {
    name: 'budget-variance',
    description: 'Compare actual spend against budget and explain variances',
    trigger: ['budget variance', 'over budget', 'spend vs budget', 'financial variance'],
    steps: `1. Load budget and actuals from files or user input.
2. Calculate variance by category (amount and percentage).
3. Rank largest overruns and underruns.
4. Suggest investigation priorities for material variances.`,
    toolsUsed: ['file-read', 'code-exec'],
  },
];
