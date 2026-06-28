export async function runIngestCommand(args: string[]): Promise<void> {
  const pack = args.find((a) => !a.startsWith('--')) ?? 'property-uk';
  const skillsOnly = args.includes('--skills-only');
  const dirIdx = args.indexOf('--dir');
  const dir = dirIdx !== -1 && args[dirIdx + 1] ? args[dirIdx + 1] : null;
  const prevArgv = process.argv;
  process.argv = [
    'node',
    'ingest',
    '--pack',
    pack,
    ...(dir ? ['--dir', dir] : []),
    ...(skillsOnly ? ['--skills-only'] : []),
  ];
  try {
    const { runIngestion } = await import('../../skills/ingestion.js');
    await runIngestion();
  } finally {
    process.argv = prevArgv;
  }
}
