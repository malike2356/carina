import chalk from 'chalk';
import { initDb } from '../../memory/db.js';
import { embeddingProviderStatus } from '../../memory/embeddings.js';
import { searchRag } from '../../memory/store.js';

export async function runRagCommand(args: string[]): Promise<void> {
  const action = args[0] ?? 'search';

  if (action === 'status') {
    const backend = process.env.CARINA_MEMORY_BACKEND ?? 'builtin';
    const embed = embeddingProviderStatus();
    console.log(chalk.bold('\nRAG status\n'));
    console.log(`  backend:     ${backend}`);
    console.log(`  dimensions:  ${embed.dimensions}`);
    console.log(`  active:      ${embed.active ?? 'not configured'}`);
    console.log(`  configured:  ${embed.configured.join(', ') || 'none'}`);
    console.log(`  chain:       ${embed.chain.join(' -> ') || 'none'}`);
    if (embed.override) {
      console.log(`  override:    CARINA_EMBEDDING_PROVIDER=${embed.override}`);
    }
    console.log('');
    return;
  }

  if (action === 'search') {
    const query = args.slice(1).join(' ');
    if (!query) {
      console.error('Usage: carina rag search <query>');
      process.exit(1);
    }
    await initDb();
    const hits = await searchRag(query, 10);
    for (const h of hits) {
      console.log(`  ${h.pack.padEnd(14)}  ${h.content.slice(0, 100)}`);
    }
    return;
  }

  if (action === 'ingest') {
    const pack = args[1] ?? 'property-uk';
    console.log(`Run: carina ingest ${pack}`);
    return;
  }

  console.error('Usage: carina rag <search|status|ingest> [args]');
  process.exit(1);
}