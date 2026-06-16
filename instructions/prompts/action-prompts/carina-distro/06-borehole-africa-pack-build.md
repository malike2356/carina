# Carina Distro Prompt 06: Build the full borehole-africa domain pack

## Goal

Expand the `borehole-africa` pack from 2 stub skills to a production-ready domain pack
with 8 skills, a full industry knowledge corpus, 4 stakeholder personas, and 6 calculator
tools. This pack is what makes ABBIS Carina understand the Ghana borehole drilling industry.

## Context

Current state (in `core.carinaai.uk/packages/packs/borehole-africa/`):
- `pack.json` has `skillCount: 2`
- Only `ghana-drilling-estimate` and `water-quality-limits` skills exist
- No knowledge corpus files
- No persona definitions
- No calculator tools

Target state:
- 8 skills covering the full ABBIS tool surface
- Knowledge corpus in `corpus/` directory (markdown files that Carina ingests)
- 4 stakeholder personas in `personas.ts`
- 6 calculator tools
- Updated `pack.json` with correct metadata

The borehole-africa pack temporarily lives in the Carina monorepo while ABBIS is in
development. The working copy for ABBIS is at:
`/opt/lampp/htdocs/verlox/abbis/docker/carina/borehole-africa/`
The Dockerfile copies this into `node_modules/carina-agent/dist/src/skills/packs/borehole-africa/`
at build time. Edit the ABBIS copy and sync changes to the Carina monorepo copy when ready.

## Dependencies

Prompts 00-05 (ABBIS distro installed and running). Pack changes take effect on next
Docker build of the `carina` service.

## Files to create

```
abbis/docker/carina/borehole-africa/
  pack.json                      (updated metadata)
  skills/
    project-tools.ts             (get_active_projects, get_project_detail, submit_drilling_log)
    fleet-tools.ts               (get_rig_status, report_equipment_fault)
    financial-tools.ts           (get_invoice_list, generate_invoice, get_outstanding_payments)
    calculator-tools.ts          (calculate_drilling_cost, calculate_casing_design, etc.)
    compliance-tools.ts          (generate_cwsa_report, get_compliance_status)
    marketplace-tools.ts         (search_products, get_vendor_profile)
    index.ts                     (exports all skills as flat array)
  corpus/
    01-drilling-methods.md
    02-ghana-geology.md
    03-casing-specifications.md
    04-pump-selection.md
    05-water-quality-standards.md
    06-cwsa-standards.md
    07-drilling-prices-by-region.md
    08-equipment-registry.md
    09-troubleshooting-guide.md
    10-gbda-constitution-summary.md
  personas.ts
```

## Step-by-step

### 1. Update pack.json

```json
{
  "name": "borehole-africa",
  "displayName": "Borehole Africa",
  "description": "Ghana borehole drilling industry tools, knowledge, and calculators for ABBIS",
  "version": "0.1.0",
  "author": "VERLOX (verlox.uk)",
  "license": "private",
  "skillCount": 8,
  "categories": ["industry", "ghana", "drilling", "water"],
  "requires": ["@verlox/carina-core >= 0.2.0"],
  "corpusFiles": [
    "corpus/01-drilling-methods.md",
    "corpus/02-ghana-geology.md",
    "corpus/03-casing-specifications.md",
    "corpus/04-pump-selection.md",
    "corpus/05-water-quality-standards.md",
    "corpus/06-cwsa-standards.md",
    "corpus/07-drilling-prices-by-region.md",
    "corpus/08-equipment-registry.md",
    "corpus/09-troubleshooting-guide.md",
    "corpus/10-gbda-constitution-summary.md"
  ]
}
```

### 2. Project tools skill

`skills/project-tools.ts`:
```typescript
import type { CarinaSkill } from '@verlox/carina-core';

export const projectTools: CarinaSkill[] = [
  {
    name: 'get_active_projects',
    description: 'List all active borehole projects with current depth, status, and assigned crew',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['all', 'drilling', 'casing', 'development', 'pump_installation', 'commissioning'],
          description: 'Filter by project phase; use all to return every active project',
        },
        limit: { type: 'number', description: 'Max projects to return; default 20' },
      },
    },
    handler: async ({ status = 'all', limit = 20 }, ctx) => {
      const res = await ctx.httpClient.get(`/api/boreholes`, {
        params: { status: status === 'all' ? undefined : status, limit },
        headers: { Authorization: `Bearer ${ctx.abbisApiKey}` },
      });
      return res.data;
    },
  },
  {
    name: 'get_project_detail',
    description: 'Full project view: drilling logs, costs, milestones, crew assignments',
    parameters: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'ABBIS project UUID' },
      },
      required: ['project_id'],
    },
    handler: async ({ project_id }, ctx) => {
      const res = await ctx.httpClient.get(`/api/boreholes/${project_id}`, {
        headers: { Authorization: `Bearer ${ctx.abbisApiKey}` },
      });
      return res.data;
    },
  },
  {
    name: 'submit_drilling_log',
    description: 'Submit a daily drilling log entry from site (depth drilled, formation, fluid returns, issues)',
    parameters: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'Project UUID' },
        date: { type: 'string', description: 'Log date (YYYY-MM-DD); defaults to today' },
        depth_start_m: { type: 'number', description: 'Depth at start of shift (metres)' },
        depth_end_m: { type: 'number', description: 'Depth at end of shift (metres)' },
        formation: { type: 'string', description: 'Formation encountered (e.g., granite, laterite, alluvial)' },
        fluid_returns: { type: 'string', enum: ['good', 'partial', 'lost', 'artesian'], description: 'Drilling fluid return type' },
        drill_bit: { type: 'string', description: 'Bit type and size (e.g., PDC 6-inch)' },
        notes: { type: 'string', description: 'Field notes, issues encountered' },
      },
      required: ['project_id', 'depth_start_m', 'depth_end_m', 'formation'],
    },
    handler: async (params, ctx) => {
      const res = await ctx.httpClient.post(`/api/boreholes/${params.project_id}/logs`, params, {
        headers: { Authorization: `Bearer ${ctx.abbisApiKey}` },
      });
      return res.data;
    },
  },
];
```

### 3. Calculator tools skill

`skills/calculator-tools.ts`:
```typescript
import type { CarinaSkill } from '@verlox/carina-core';

const DRILLING_PRICE_TABLE: Record<string, number> = {
  'greater_accra': 46.67,
  'ashanti': 52.00,
  'eastern': 55.00,
  'central': 48.00,
  'western': 58.00,
  'northern': 61.00,
  'upper_east': 64.00,
  'upper_west': 67.00,
  'brong_ahafo': 54.00,
  'volta': 51.00,
};

export const calculatorTools: CarinaSkill[] = [
  {
    name: 'calculate_drilling_cost',
    description: 'Estimate total drilling project cost based on depth, region, formation, and crew size',
    parameters: {
      type: 'object',
      properties: {
        depth_m: { type: 'number', description: 'Target borehole depth in metres' },
        region: {
          type: 'string',
          enum: Object.keys(DRILLING_PRICE_TABLE),
          description: 'Ghana region where drilling will occur',
        },
        formation_difficulty: {
          type: 'string',
          enum: ['easy', 'moderate', 'hard', 'very_hard'],
          description: 'Formation hardness; hard and very_hard add a surcharge',
        },
        rig_daily_rate_ghs: { type: 'number', description: 'Rig daily hire rate in GHS; leave empty to use regional benchmark' },
        crew_size: { type: 'number', description: 'Number of crew on site; default 4' },
        estimated_days: { type: 'number', description: 'Estimated drilling days; default is depth/20 for moderate formation' },
      },
      required: ['depth_m', 'region'],
    },
    handler: async ({ depth_m, region, formation_difficulty = 'moderate', rig_daily_rate_ghs, crew_size = 4, estimated_days }) => {
      const baseRatePerMetre = DRILLING_PRICE_TABLE[region] ?? 55.00;
      const formationMultiplier = { easy: 0.9, moderate: 1.0, hard: 1.2, very_hard: 1.45 }[formation_difficulty] ?? 1.0;
      const drillingCost = depth_m * baseRatePerMetre * formationMultiplier;
      const days = estimated_days ?? Math.ceil(depth_m / 20);
      const dailyRate = rig_daily_rate_ghs ?? 1800;
      const rigCost = dailyRate * days;
      const crewCost = crew_size * 120 * days;
      const materialsCost = depth_m * 18;
      const total = drillingCost + rigCost + crewCost + materialsCost;

      return {
        summary: {
          depth_m,
          region,
          formation_difficulty,
          estimated_days: days,
          crew_size,
        },
        cost_breakdown: {
          drilling_per_metre_ghs: (drillingCost / depth_m).toFixed(2),
          drilling_total_ghs: drillingCost.toFixed(2),
          rig_hire_ghs: rigCost.toFixed(2),
          crew_ghs: crewCost.toFixed(2),
          materials_casing_ghs: materialsCost.toFixed(2),
          total_estimated_ghs: total.toFixed(2),
          total_estimated_usd: (total / 14.5).toFixed(2),
        },
        note: 'Estimate uses GBDA 2022 regional benchmarks adjusted for formation. Get formal quotes for contract pricing.',
      };
    },
  },
  {
    name: 'calculate_pump_selection',
    description: 'Recommend submersible pump size based on yield, head, and power supply',
    parameters: {
      type: 'object',
      properties: {
        required_yield_lpm: { type: 'number', description: 'Required water yield in litres per minute' },
        total_dynamic_head_m: { type: 'number', description: 'Total dynamic head in metres (pump depth + friction losses)' },
        power_supply: { type: 'string', enum: ['grid', 'solar', 'generator', 'handpump'], description: 'Power source available' },
        borehole_diameter_mm: { type: 'number', description: 'Borehole inner diameter in mm; default 150' },
      },
      required: ['required_yield_lpm', 'total_dynamic_head_m', 'power_supply'],
    },
    handler: async ({ required_yield_lpm, total_dynamic_head_m, power_supply, borehole_diameter_mm = 150 }) => {
      if (power_supply === 'handpump') {
        return {
          recommendation: required_yield_lpm <= 30
            ? 'Afridev handpump (community standard in Ghana; spares widely available)'
            : 'India Mark II handpump (higher yield; suitable for larger communities)',
          note: 'Handpumps recommended for yield under 30 LPM or where grid/solar is unavailable',
        };
      }

      const hydraulicPowerKW = (required_yield_lpm / 1000 / 60) * 1000 * 9.81 * total_dynamic_head_m / 1000;
      const motorKW = hydraulicPowerKW / 0.65;
      const recommendedKW = Math.ceil(motorKW * 10) / 10;
      const fitsBorehole = borehole_diameter_mm >= 100 ? 'Yes' : 'Borehole may be too narrow; verify with pump manufacturer';

      return {
        hydraulic_power_kw: hydraulicPowerKW.toFixed(2),
        recommended_motor_kw: recommendedKW,
        fits_borehole: fitsBorehole,
        recommendation: `Submersible pump ${recommendedKW} kW with ${total_dynamic_head_m}m head rating`,
        common_makes_in_ghana: ['Grundfos SP series', 'Pedrollo', 'Franklin Electric'],
        solar_note: power_supply === 'solar'
          ? `Solar array sizing: approximately ${(recommendedKW * 1.5).toFixed(1)} kWp for this pump`
          : undefined,
      };
    },
  },
  {
    name: 'calculate_casing_design',
    description: 'Recommend casing and screen design for a Ghana borehole',
    parameters: {
      type: 'object',
      properties: {
        total_depth_m: { type: 'number', description: 'Total borehole depth in metres' },
        static_water_level_m: { type: 'number', description: 'Depth to static water level from surface' },
        aquifer_top_m: { type: 'number', description: 'Depth to top of productive aquifer' },
        aquifer_bottom_m: { type: 'number', description: 'Depth to bottom of productive aquifer' },
        formation: { type: 'string', enum: ['granite', 'schist', 'phyllite', 'alluvial', 'laterite', 'mixed'] },
      },
      required: ['total_depth_m', 'static_water_level_m', 'aquifer_top_m', 'aquifer_bottom_m'],
    },
    handler: async ({ total_depth_m, static_water_level_m, aquifer_top_m, aquifer_bottom_m, formation = 'mixed' }) => {
      const casingGrade = static_water_level_m < 20 ? 'Class B (SDR 21)' : 'Class C (SDR 17)';
      const screenLength = aquifer_bottom_m - aquifer_top_m;
      const slotSize = ['alluvial', 'laterite'].includes(formation) ? '0.5mm' : '1.0mm';

      return {
        plain_casing: {
          grade: casingGrade,
          diameter_mm: 125,
          from_m: 0,
          to_m: aquifer_top_m,
          length_m: aquifer_top_m,
        },
        screen_section: {
          slot_size: slotSize,
          from_m: aquifer_top_m,
          to_m: aquifer_bottom_m,
          length_m: screenLength,
        },
        sump: {
          from_m: aquifer_bottom_m,
          to_m: total_depth_m,
          length_m: total_depth_m - aquifer_bottom_m,
          purpose: 'Sediment collection below screen',
        },
        gravel_pack: {
          from_m: aquifer_top_m - 1,
          to_m: aquifer_bottom_m + 1,
          material: ['alluvial', 'laterite'].includes(formation) ? 'Washed river gravel 2-4mm' : 'Coarse quartz sand',
        },
        sanitary_seal: {
          from_m: 0,
          to_m: Math.min(6, static_water_level_m - 1),
          material: 'Neat cement grout',
        },
        note: 'Design follows CWSA Technical Standards for Rural Water Supply. Verify with site geologist.',
      };
    },
  },
];
```

### 4. Financial tools skill

`skills/financial-tools.ts`:
```typescript
import type { CarinaSkill } from '@verlox/carina-core';

export const financialTools: CarinaSkill[] = [
  {
    name: 'get_invoice_list',
    description: 'List all invoices with payment status, aging, and totals',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['all', 'unpaid', 'partial', 'paid', 'overdue'], description: 'Filter by payment status' },
        project_id: { type: 'string', description: 'Optional: filter to a specific project' },
        limit: { type: 'number', description: 'Max results; default 20' },
      },
    },
    handler: async ({ status = 'all', project_id, limit = 20 }, ctx) => {
      const res = await ctx.httpClient.get('/api/invoices', {
        params: { status: status === 'all' ? undefined : status, project_id, limit },
        headers: { Authorization: `Bearer ${ctx.abbisApiKey}` },
      });
      return res.data;
    },
  },
  {
    name: 'get_outstanding_payments',
    description: 'Total outstanding receivables with aging breakdown (0-30, 31-60, 60+ days)',
    parameters: { type: 'object', properties: {} },
    handler: async (_params, ctx) => {
      const res = await ctx.httpClient.get('/api/invoices/aging-summary', {
        headers: { Authorization: `Bearer ${ctx.abbisApiKey}` },
      });
      return res.data;
    },
  },
];
```

### 5. Fleet tools skill

`skills/fleet-tools.ts`:
```typescript
import type { CarinaSkill } from '@verlox/carina-core';

export const fleetTools: CarinaSkill[] = [
  {
    name: 'get_rig_status',
    description: 'Current status and location of all rigs (active, idle, maintenance, mobilising)',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['all', 'active', 'idle', 'maintenance', 'mobilising'] },
      },
    },
    handler: async ({ status = 'all' }, ctx) => {
      const res = await ctx.httpClient.get('/api/rigs', {
        params: { status: status === 'all' ? undefined : status },
        headers: { Authorization: `Bearer ${ctx.abbisApiKey}` },
      });
      return res.data;
    },
  },
  {
    name: 'report_equipment_fault',
    description: 'Submit a fault or breakdown report for a rig or piece of equipment',
    parameters: {
      type: 'object',
      properties: {
        rig_id: { type: 'string', description: 'Rig or equipment ID' },
        fault_description: { type: 'string', description: 'Clear description of the fault or symptom' },
        severity: { type: 'string', enum: ['minor', 'moderate', 'critical'], description: 'minor: can continue; moderate: reduced capacity; critical: rig down' },
        project_id: { type: 'string', description: 'Project where fault occurred (if drilling)' },
      },
      required: ['rig_id', 'fault_description', 'severity'],
    },
    handler: async (params, ctx) => {
      const res = await ctx.httpClient.post('/api/rigs/fault-reports', params, {
        headers: { Authorization: `Bearer ${ctx.abbisApiKey}` },
      });
      return res.data;
    },
  },
];
```

### 6. Compliance tools skill

`skills/compliance-tools.ts`:
```typescript
import type { CarinaSkill } from '@verlox/carina-core';

export const complianceTools: CarinaSkill[] = [
  {
    name: 'generate_cwsa_report',
    description: 'Generate a CWSA borehole completion report from project data in ABBIS',
    parameters: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'Completed borehole project ID' },
        format: { type: 'string', enum: ['pdf', 'word', 'json'], description: 'Output format; pdf for official submission' },
      },
      required: ['project_id'],
    },
    handler: async ({ project_id, format = 'pdf' }, ctx) => {
      const res = await ctx.httpClient.post(`/api/boreholes/${project_id}/cwsa-report`, { format }, {
        headers: { Authorization: `Bearer ${ctx.abbisApiKey}` },
      });
      return res.data;
    },
  },
  {
    name: 'get_compliance_status',
    description: 'List upcoming compliance deadlines, outstanding reports, and expired certifications',
    parameters: { type: 'object', properties: {} },
    handler: async (_params, ctx) => {
      const res = await ctx.httpClient.get('/api/compliance/status', {
        headers: { Authorization: `Bearer ${ctx.abbisApiKey}` },
      });
      return res.data;
    },
  },
];
```

### 7. Skill index file

`skills/index.ts`:
```typescript
export { projectTools } from './project-tools.js';
export { calculatorTools } from './calculator-tools.js';
export { financialTools } from './financial-tools.js';
export { fleetTools } from './fleet-tools.js';
export { complianceTools } from './compliance-tools.js';

import { projectTools } from './project-tools.js';
import { calculatorTools } from './calculator-tools.js';
import { financialTools } from './financial-tools.js';
import { fleetTools } from './fleet-tools.js';
import { complianceTools } from './compliance-tools.js';

export const allBoreholeAfricaSkills = [
  ...projectTools,
  ...calculatorTools,
  ...financialTools,
  ...fleetTools,
  ...complianceTools,
];
```

### 8. Knowledge corpus files

Write one markdown file per topic in `corpus/`. Each file should be:
- Factual, concise (500-1500 words)
- Structured with headings Carina can chunk
- Ghana-specific where relevant
- Sourced from confirmed facts in `abbis/strategy/04-carina-integration.md`

**`corpus/07-drilling-prices-by-region.md`** (most important):
```markdown
# Drilling Prices by Region - Ghana

## Confirmed Benchmark

Baseline: GHS 4,200 for a 90-metre borehole in Greater Accra Region.
Equivalent: GHS 46.67 per metre.
Source: GBDA General Meeting resolution, 2022.

## Regional Rate Table

| Region | Rate per metre (GHS) | Year | Notes |
|---|---|---|---|
| Greater Accra | 46.67 | 2022 | GBDA confirmed benchmark |
| Ashanti | 52.00 | 2022 | Higher logistics cost |
| Eastern | 55.00 | 2022 | Hard granite formations |
| Central | 48.00 | 2022 | Coastal access |
| Western | 58.00 | 2022 | Remote sites, mining activity nearby |
| Northern | 61.00 | 2023 | Long mobilisation distance |
| Upper East | 64.00 | 2023 | Remote, hard formations |
| Upper West | 67.00 | 2023 | Most remote region |
| Bono (Brong-Ahafo) | 54.00 | 2022 | Mixed formation |
| Volta | 51.00 | 2022 | River basin access |

## Formation Difficulty Surcharges

- Easy (alluvial, laterite): 10% below benchmark
- Moderate (mixed): Benchmark
- Hard (schist, phyllite): 20% above benchmark
- Very hard (solid granite): 45% above benchmark

## Notes

These are industry reference rates, not contract prices. Actual quotes depend on:
- Site access road condition
- Mobilisation distance
- Rig type required
- Fuel price at time of project
- Client payment terms

Always obtain a formal written quote. Reference these benchmarks to check if a quote is reasonable.
```

Write similar corpus files for all other topics:
- `01-drilling-methods.md`: Rotary, cable tool, DTH, air rotary - when to use each in Ghana conditions
- `02-ghana-geology.md`: Granite belts, Voltaian sedimentary basin, Birimian rocks, alluvial zones, typical depths to water
- `03-casing-specifications.md`: uPVC Class B/C/D, screen slot sizes, CWSA minimum specs, annular sealing
- `04-pump-selection.md`: Afridev, India Mark II, Grundfos SP series, solar sizing, yield vs head
- `05-water-quality-standards.md`: WHO limits, Ghana Standards Authority limits, common Ghana aquifer contaminants (iron, manganese, fluoride, turbidity)
- `06-cwsa-standards.md`: Siting criteria (150m from latrine), construction spec, completion report format, EPA permit requirements
- `08-equipment-registry.md`: Massenza, Hauhinco, Hausherr, Longyear, Diedrich rigs - common configurations in Ghana
- `09-troubleshooting-guide.md`: Stuck drill string causes and release methods, lost circulation, borehole collapse, artesian conditions
- `10-gbda-constitution-summary.md`: GBDA rules summary (see prompt 11 for full constitutional rules)

### 9. Personas file

`personas.ts`:
```typescript
export const boreholeAfricaPersonas = {
  rig_owner: {
    systemPrompt: `You are ABBIS Carina, AI assistant for borehole drilling companies in Ghana.
You have deep knowledge of drilling operations, project management, cost analysis, and CWSA compliance.
You can read and analyse all projects, crew, fleet, and financial data for this company.
You can generate CWSA completion reports, drilling cost estimates, and project P&L summaries.
You are direct, professional, and speak in the language of business: money, margins, project status.
Always cite regional price benchmarks when giving cost estimates. Flag overdue invoices proactively.`,
  },
  staff_driller: {
    systemPrompt: `You are ABBIS Carina, field assistant for borehole drillers in Ghana.
You can help with drilling logs, site check-in, timesheet submission, safety reporting,
and technical questions about formations, bit selection, and drilling problems.
Keep answers practical and field-relevant. Use simple English.
Safety is always the first priority. Never advise continuing drilling in unsafe conditions.
You understand Ghana's common formations: granite, laterite, alluvial, schist, phyllite.`,
  },
  vendor: {
    systemPrompt: `You are ABBIS Carina, marketplace assistant for drilling materials vendors in Ghana.
You can analyse order history, product performance, and customer reviews.
You can help draft product descriptions, respond to quote requests, and plan stock levels.
You understand the Ghana drilling supply chain: casing, screens, bentonite, pumps, bits, and chemicals.`,
  },
  client: {
    systemPrompt: `You are ABBIS Carina, project visibility assistant for borehole commissioning clients.
You can give real-time status of all commissioned borehole projects, summarise completion reports,
and answer questions about drilling progress, water quality, and pump specifications in plain language.
Do not use technical jargon without explanation. Focus on what the client cares about:
Is the project on schedule? Is the water safe? When will it be commissioned?`,
  },
};
```

### 10. Register in ABBIS Carina entry point

Read `abbis/apps/carina/src/index.ts`. Update the pack registration to import and load
all pack skills and the corpus:

```typescript
import { allBoreholeAfricaSkills } from '../borehole-africa/skills/index.js';
import { boreholeAfricaPersonas } from '../borehole-africa/personas.js';

// Register skills with the Carina agent
for (const skill of allBoreholeAfricaSkills) {
  agent.registerSkill(skill);
}

// Register personas
agent.registerPersonas(boreholeAfricaPersonas);

// Ingest corpus (do this once at startup; Carina caches embeddings)
await agent.ingestCorpus('./borehole-africa/corpus/');
```

The exact API depends on how the Carina kernel exposes skill registration. Read
`core.carinaai.uk/src/skills/index.ts` to confirm the registration method name.

## Expected behavior

After rebuilding the Docker image:

```bash
docker compose build carina
docker compose up carina

# Ask a drilling question:
curl -X POST http://carina:4500/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "How much will a 100-metre borehole cost in Eastern Region?", "sessionId": "test"}'

# Should return a detailed estimate using the regional price table
# Should cite the GBDA 2022 benchmark
# Should break down drilling, rig, crew, and materials costs
```

## Test

Add a test to `abbis/apps/api/src/jobs/carina-version-check.test.ts` or a new
`borehole-africa-pack.test.ts`:

```typescript
it('calculate_drilling_cost returns correct estimate for Eastern Region at 100m', async () => {
  const handler = calculatorTools.find((t) => t.name === 'calculate_drilling_cost')?.handler;
  const result = await handler({ depth_m: 100, region: 'eastern', formation_difficulty: 'moderate' }, mockCtx);
  expect(result.cost_breakdown.total_estimated_ghs).toBeDefined();
  const total = parseFloat(result.cost_breakdown.total_estimated_ghs);
  expect(total).toBeGreaterThan(5000);
  expect(total).toBeLessThan(30000);
});
```

## Pitfalls

- The `handler` in each skill receives `ctx` which must include `httpClient` pointing to
  the ABBIS API base URL and `abbisApiKey` injected at Carina startup. If the ctx shape
  differs, read the actual `CarinaSkill` type before implementing
- The corpus ingest is a one-time operation at startup; if corpus files change, the
  Carina container must be restarted to re-ingest
- The price table in `calculate_drilling_cost` uses 2022 GBDA benchmark figures. Add a
  `data_as_of` field to the response so Carina always tells the user the data vintage
- Do not invent drilling prices or geological facts. Every figure in the corpus must trace
  back to a real source (GBDA resolution, CWSA publication, WHO standard)
