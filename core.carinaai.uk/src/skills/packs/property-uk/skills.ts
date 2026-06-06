import type { Skill } from '../../../types/index.js';

export type PackSkillInput = Omit<Skill, 'id' | 'createdAt' | 'usageCount'>;

export const propertyUkSkills: PackSkillInput[] = [
  {
    name: 'brr-analysis',
    description: 'Step-by-step BRR (Buy, Refurbish, Refinance) deal analysis template',
    trigger: ['BRR', 'buy refurbish refinance', 'BRRR', 'refurb', 'refinance'],
    steps: `1. Confirm purchase price, refurb budget, and end value (GDV) from comparable sales.
2. Calculate total cash in: deposit + refurb + fees + SDLT + legals.
3. Estimate monthly holding costs during refurb (void, utilities, insurance).
4. Model post-refurb valuation using 3+ sold comparables within 0.5 miles.
5. Calculate gross yield if letting: (annual rent / post-refurb value) x 100.
6. Model refinance at 75% LTV on GDV; confirm cash released covers cash in.
7. Stress-test: -10% GDV and +20% refurb cost; deal must still break even.
8. Document exit: hold BTL, sell, or recycle into next BRR.`,
    toolsUsed: ['file-read', 'web-search'],
  },
  {
    name: 'hmo-compliance-check',
    description: 'HMO licensing and compliance checklist for UK properties',
    trigger: ['HMO', 'house of multiple occupation', 'licensing', 'Article 4'],
    steps: `1. Confirm property address and local authority (council).
2. Check if Article 4 direction applies (C3 to C4 change may need planning).
3. Verify mandatory HMO licensing: 5+ occupants forming 2+ households.
4. Check additional/selective licensing schemes in the council area.
5. Room sizes: single 6.51sqm min, double 10.22sqm (Housing Act 2004).
6. Fire safety: mains-wired smoke alarms, heat detectors in kitchens, escape routes.
7. Amenities: adequate kitchen/bathroom facilities per occupant count.
8. Manager details and licence application fee if licensable HMO.
9. Recommend specialist HMO surveyor if any item fails.`,
    toolsUsed: ['web-search', 'file-read'],
  },
  {
    name: 'yield-calculator',
    description: 'Calculate gross and net yield from purchase price and rent',
    trigger: ['yield', 'gross yield', 'net yield', 'ROI', 'rental return'],
    steps: `1. Gross yield % = (annual rent / purchase price) x 100.
2. Annual rent = monthly rent x 12.
3. Net yield: subtract annual costs from rent before dividing by price.
4. Typical costs: void allowance (4-6 weeks), maintenance (10% rent), insurance, management (8-12%), ground rent/service charge if leasehold.
5. Net yield % = ((annual rent - annual costs) / purchase price) x 100.
6. Compare to area average gross yield (often 4-8% UK BTL).
7. Present both gross and net figures; note assumptions.`,
    toolsUsed: ['code-exec'],
  },
  {
    name: 'deal-sourcing-workflow',
    description: 'Workflow for sourcing UK property deals on and off market',
    trigger: ['deal sourcing', 'finding properties', 'leads', 'off-market'],
    steps: `1. Define buy box: area, price band, strategy (BTL, BRR, HMO), min yield.
2. Set Rightmove/Zoopla alerts with strict filters; review daily.
3. Register with 5+ local agents; send buy-box one-pager.
4. Auction catalogue review 2 weeks before sale (SDL, Allsop, local).
5. Off-market: direct mail to tired landlords, probate lists, company search.
6. Track pipeline in spreadsheet: address, asking, offer, status, follow-up date.
7. View only properties meeting 80% of buy box; run yield calc before offer.
8. Offer template: price, conditions, 28-day exchange target, proof of funds.`,
    toolsUsed: ['web-search', 'file-write'],
  },
  {
    name: 'area-scoring',
    description: 'Framework for scoring a UK property investment area',
    trigger: ['area', 'location', 'due diligence', 'neighbourhood', 'location score'],
    steps: `1. Transport: nearest station distance, commute time to major employment hubs.
2. Employment: major employers, unemployment rate vs national average.
3. Yield trends: average gross yield from sold prices and advertised rents.
4. Price growth: 5-year sold price trend (Land Registry / PropertyData).
5. Supply: new-build pipeline, vacancy rates, days on market average.
6. Demand: population growth, rental demand indicators, university proximity if relevant.
7. Risk: flood zone, crime stats, planned major developments (positive or negative).
8. Score each 1-5; weight yield and growth per strategy (BTL vs flip).
9. Recommend minimum total score before proceeding to deal analysis.`,
    toolsUsed: ['web-search', 'property-data-lookup'],
  },
  {
    name: 'bridging-finance-explainer',
    description: 'When and how to use UK bridging finance',
    trigger: ['bridging', 'bridge loan', 'short-term finance', 'bridge finance'],
    steps: `1. Bridging suits: auction purchase, chain break, refurb before refinance, quick completion.
2. Typical term: 6-18 months; monthly interest rolled or serviced.
3. Costs: arrangement fee (1-2%), monthly rate (0.5-1.2%+), valuation, legals, exit fee.
4. LTV: usually 70-75% of open market value or 65% GDV for refurb.
5. Exit strategy is mandatory: refinance, sale, or other defined repayment.
6. Compare total cost vs alternative (cash, JV, delayed completion).
7. Always confirm FCA-regulated broker for regulated cases; this is general guidance only.
8. Recommend professional advice for specific deals.`,
    toolsUsed: ['file-read'],
  },
];
