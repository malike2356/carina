export {
  ROOT_INHERIT_DEFAULT,
  resolveEffectiveIndexPolicy,
  shouldIndexItem,
} from './policy.js';
export { VaultContentIndexer, chunkText, extractIndexableText } from './indexer.js';
export { onItemWritten, onItemTrashedOrDeleted, onItemRestored } from './hooks.js';
export { contentSearch } from './retriever.js';
export { makeSourceId, citationAsDict, type VaultCitation } from './citations.js';
export type { VaultSearchHost } from './host.js';
