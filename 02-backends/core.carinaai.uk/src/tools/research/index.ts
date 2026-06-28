export { checkPspp } from './pspp-check.js';
export { generateSyntax, type SyntaxRequest, type PsppAnalysisType } from './pspp-syntax.js';
export { parsePsppOutput, formatAsApa, type ParsedPsppOutput } from './pspp-output.js';
export { executePsppAnalysis, parsePsppParams } from './pspp-executor.js';
export { psppAnalyzeTool } from './pspp-tool.js';
export { checkJamovi, executeJamoviAnalysis, parseJamoviParams } from './jamovi-executor.js';
export { formatJamoviAsApa } from './jamovi-format.js';
export { jamoviAnalyzeTool } from './jamovi-tool.js';
export {
  checkSavDependencies,
  formatSavReadMarkdown,
  formatSpvReadMarkdown,
  readSavFile,
  writeSavFile,
  readSpvFile,
} from './sav-executor.js';
export { savReadTool, savWriteTool, spvReadTool } from './sav-tools.js';
export { spssSyntaxGenerateTool } from './spss-syntax-tool.js';
export { STATS_TOOLS } from './stats-tools.js';
export { rAnalyzeTool } from './r-tool.js';
export { spssOutputParseTool } from './spss-output-parse-tool.js';

import { jamoviAnalyzeTool } from './jamovi-tool.js';
import { psppAnalyzeTool } from './pspp-tool.js';
import { rAnalyzeTool } from './r-tool.js';
import { savReadTool, savWriteTool, spvReadTool } from './sav-tools.js';
import { spssOutputParseTool } from './spss-output-parse-tool.js';
import { spssSyntaxGenerateTool } from './spss-syntax-tool.js';
import { STATS_TOOLS } from './stats-tools.js';

export const RESEARCH_TOOLS = [
  psppAnalyzeTool,
  jamoviAnalyzeTool,
  rAnalyzeTool,
  savReadTool,
  savWriteTool,
  spvReadTool,
  spssSyntaxGenerateTool,
  spssOutputParseTool,
  ...STATS_TOOLS,
] as const;
