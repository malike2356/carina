export {
  reportEvent,
  reportToolCall,
  reportHeartbeat,
  recordToolCall,
  flushMetricsToScout,
  stopMetricsFlush,
  sanitiseParams,
  _resetMetricsTimers,
  _resetScoutWarnFlag,
  type ScoutEvent,
  type ToolCallReport,
} from './scout-client.js';

export const SCOUT_INSTALL_HINT =
  'Scout client not installed. Run: npm install @verlox/carina-scout';
