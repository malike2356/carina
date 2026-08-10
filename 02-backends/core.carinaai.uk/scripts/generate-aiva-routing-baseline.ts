import { buildAivaRoutingBaseline, writeAivaRoutingBaseline } from '../src/benchmark/aiva-routing-baseline.js';

const report = buildAivaRoutingBaseline({
  selected: {
    policy: process.env.AIVA_ENGINE_POLICY,
  },
});
const paths = await writeAivaRoutingBaseline(report);
console.log(JSON.stringify({ report: report.schemaVersion, observation: report.observation, ...paths }, null, 2));
