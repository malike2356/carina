import { initDb } from '../src/memory/db.js';
import { saveMemory, getSessionHistory, searchMemory } from '../src/memory/store.js';

async function main(): Promise<void> {
  await initDb();
  console.log('Memory store ready');

  await saveMemory('test-session', 'user', 'What is stamp duty on a second home?');
  await saveMemory('test-session', 'assistant', 'Stamp duty on second homes uses higher rates.');

  const hist = await getSessionHistory('test-session', 5);
  console.log('History rows:', hist.length);

  const similar = await searchMemory('stamp duty second home', 3);
  console.log('Semantic hits:', similar.length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
