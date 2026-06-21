export {
  scoreEpisode,
  distillEpisodeContent,
  inferPromotionTarget,
  buildPromotionRationale,
  type MemoryTier,
} from './rem-scorer.js';
export {
  approvePromotion,
  enqueuePromotion,
  isRemAvailable,
  listPromotionQueue,
  maybeRunRemCycle,
  recordMemoryAccess,
  rejectPromotion,
  runRemPromotionCycle,
  setEpisodeTier,
  type PromotionQueueRow,
  type RemCycleResult,
} from './rem-promotion.js';
export { dreamsFilePath, renderDreamsMarkdown, syncDreamsFile } from './dreams.js';
export { reindexAllMemory, reindexEpisodicMemories, reindexPersistentFacts } from './memory-reindex.js';
