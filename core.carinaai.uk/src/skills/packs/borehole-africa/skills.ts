import type { PackSkillInput } from '../../pack-types.js';

export const boreholeAfricaSkills: PackSkillInput[] = [
  {
    name: 'borehole-siting',
    description: 'Assess borehole siting criteria for sub-Saharan Africa contexts',
    trigger: ['borehole siting', 'drilling location', 'hydrogeology', 'water point siting', 'fracture zone'],
    steps: `1. Review topography, geology maps, and known aquifer types (weathered basement, sedimentary basin).
2. Avoid contamination sources (latrines, cemeteries, livestock pens, waste dumps) upslope or nearby.
3. Prefer higher-yield fracture zones or paleochannels where local knowledge supports them.
4. Confirm access for rig mobilisation and community agreement for the site.
5. Recommend geophysical survey or supervised test drilling when budget allows.`,
    toolsUsed: ['file-read', 'web-search', 'file-write'],
  },
  {
    name: 'drilling-cost-estimation',
    description: 'Estimate borehole drilling cost drivers by depth, casing, and region',
    trigger: ['drilling cost', 'borehole budget', 'casing cost', 'mobilisation cost', 'meter rate drilling'],
    steps: `1. Capture target depth, geology (soft vs hard formation), and region/mobilisation distance.
2. List cost components: mobilisation, drilling per metre, casing (PVC vs steel), screens, gravel pack.
3. Add contingency for over-runs, tool loss in hard rock, and dry holes.
4. Separate capital costs from pump, power, and headworks.
5. Present a transparent BOQ-style estimate; flag that local contractor quotes are required.`,
    toolsUsed: ['file-write', 'code-exec'],
  },
  {
    name: 'water-quality-testing',
    description: 'Define minimum potable water quality tests and WHO-aligned thresholds',
    trigger: ['water quality test', 'E.coli', 'turbidity', 'nitrate', 'potable water testing'],
    steps: `1. Specify field tests (turbidity, pH, conductivity) and lab tests (E.coli/coliforms, nitrates, fluoride).
2. Reference WHO Guidelines for Drinking-water Quality for interpretation (do not invent limits).
3. Include sampling protocol: sterile bottles, flush time, chain of custody.
4. Classify results as acceptable, treat before use, or unfit.
5. Recommend retest after rainy season or new contamination risk.`,
    toolsUsed: ['web-search', 'file-write'],
  },
  {
    name: 'community-handover',
    description: 'Community WASH handover checklist for borehole schemes',
    trigger: ['community handover', 'WASH handover', 'water committee', 'O&M plan', 'maintenance fund'],
    steps: `1. Confirm water user committee, bylaws, and tariff or maintenance fund model.
2. Train caretakers on pump operation, basic troubleshooting, and spare parts.
3. Document who pays for repairs and how breakdowns are reported.
4. Agree water point rules (hours, livestock access, hygiene).
5. Schedule post-handover visit at 3 and 12 months where possible.`,
    toolsUsed: ['file-write'],
  },
  {
    name: 'pump-selection',
    description: 'Select hand pump or solar submersible for African boreholes by depth and users',
    trigger: ['pump selection', 'Afridev', 'India Mark II', 'solar submersible', 'hand pump'],
    steps: `1. Capture static water level, pumping depth, daily demand, and user count.
2. Shallow/low-yield: consider Afridev or India Mark II community hand pumps where spare parts exist locally.
3. Deeper or higher demand: size submersible pump and solar array with qualified installer input.
4. Check local supply chain for spares and trained mechanics.
5. Document duty point (flow and head) for procurement; avoid oversizing solar systems without load assessment.`,
    toolsUsed: ['file-write', 'web-search'],
  },
];
