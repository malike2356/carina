export async function runIngestCommand(args: string[]): Promise<void> {
  const pack = args[0] ?? 'property-uk';
  const skillsOnly = args.includes('--skills-only');
  const prevArgv = process.argv;
  process.argv = ['node', 'ingest', '--pack', pack, ...(skillsOnly ? ['--skills-only'] : [])];
  try {
    const { runIngestion } = await import('../../skills/ingestion.js');
    await runIngestion();
  } finally {
    process.argv = prevArgv;
  }
}
