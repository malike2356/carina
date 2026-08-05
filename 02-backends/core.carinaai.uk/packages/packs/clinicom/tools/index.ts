import type { Tool } from '#core/types/index.js';
import { clinicomSimplifyTool } from './clinicom-simplify.js';
import { clinicomSpeakTool } from './clinicom-speak.js';
import { clinicomTranscribeTool } from './clinicom-transcribe.js';
import { clinicomTranslateTool } from './clinicom-translate.js';
import { clinicomConfidenceExplainTool } from './clinicom-confidence-explain.js';
import { clinicomCulturalAdaptTool } from './clinicom-cultural-adapt.js';
import { clinicomProductHelpTool } from './clinicom-product-help.js';
import { clinicomSafetyTriageAssistTool } from './clinicom-safety-triage-assist.js';
import { clinicomSessionDigestTool } from './clinicom-session-digest.js';
import { clinicomSpecialtySimplifyTool } from './clinicom-specialty-simplify.js';
import { clinicomTeachbackScoreTool } from './clinicom-teachback-score.js';

export const clinicomTools: Tool[] = [
  clinicomTranscribeTool,
  clinicomTranslateTool,
  clinicomSimplifyTool,
  clinicomSpeakTool,
  clinicomCulturalAdaptTool,
  clinicomTeachbackScoreTool,
  clinicomSafetyTriageAssistTool,
  clinicomSessionDigestTool,
  clinicomSpecialtySimplifyTool,
  clinicomConfidenceExplainTool,
  clinicomProductHelpTool,
];

export {
  clinicomSimplifyTool,
  clinicomSpeakTool,
  clinicomTranscribeTool,
  clinicomTranslateTool,
  clinicomConfidenceExplainTool,
  clinicomCulturalAdaptTool,
  clinicomProductHelpTool,
  clinicomSafetyTriageAssistTool,
  clinicomSessionDigestTool,
  clinicomSpecialtySimplifyTool,
  clinicomTeachbackScoreTool,
};

export {
  dispatchClinicomTool,
  executeClinicomConfidenceExplain,
  executeClinicomCulturalAdapt,
  executeClinicomProductHelp,
  executeClinicomSimplify,
  executeClinicomSpeak,
  executeClinicomSafetyTriageAssist,
  executeClinicomSessionDigest,
  executeClinicomSpecialtySimplify,
  executeClinicomTeachbackScore,
  executeClinicomTranscribe,
  executeClinicomTranslate,
} from './handlers.js';
