export async function bootstrapInkTuiRuntime(): Promise<boolean> {
  let memoryReady = false;

  const localOnly = process.env.CARINA_SKIP_POSTGRES === 'true'
    || (process.env.CARINA_LOCAL_MODE === 'true'
      && ['sqlite', 'builtin'].includes((process.env.CARINA_MEMORY_BACKEND ?? 'builtin').toLowerCase()));

  try {
    if (localOnly) {
      const { initMemoryBackend } = await import('../../memory/backends/index.js');
      initMemoryBackend();
      memoryReady = true;
    } else {
      const { initDb } = await import('../../memory/db.js');
      await initDb();
      const { initMemoryBackend } = await import('../../memory/backends/index.js');
      initMemoryBackend();
      memoryReady = true;
    }
  } catch {
    memoryReady = false;
  }

  const { initRouter } = await import('../../gateway/router.js');
  initRouter(memoryReady);

  const { startProcessCleanup } = await import('../../tools/process-registry.js');
  startProcessCleanup();

  return memoryReady;
}
