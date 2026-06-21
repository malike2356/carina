# Prompt 01: Digital Forensics Pipeline


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Context

Carina has 71 tools in its registry. The forensics pipeline adds a coordinated workflow
that chains multiple forensics tools to go from a raw disk image to a Timesketch timeline
in one command. This is a Carina orchestration capability, not a tool collection.

The individual tools (dc3dd, volatility, bulk-extractor, plaso, timesketch) are assumed
installed on the host system. Carina orchestrates them via its shell execution tool.

## What to Build

### 1. Forensics workflow tool

Create `src/tools/forensics/pipeline.ts`:
```typescript
export const forensicsPipelineTool = {
  name: 'forensics-pipeline',
  description: 'Run a complete digital forensics workflow from disk image to Timesketch timeline',
  parameters: {
    imageUri: { type: 'string', description: 'Path to disk image (E01, DD, raw)' },
    outputDir: { type: 'string', description: 'Directory for all output artifacts' },
    profileName: { type: 'string', optional: true, description: 'Volatility memory profile (e.g. Win10x64)' },
    uploadToTimesketch: { type: 'boolean', default: true },
  },
  async execute({ imageUri, outputDir, profileName, uploadToTimesketch }: PipelineArgs) {
    // Step 1: Verify image integrity
    await runShell(`dc3dd if="${imageUri}" hash=sha256 log="${outputDir}/dc3dd.log"`);

    // Step 2: Memory analysis (if volatility profile provided)
    if (profileName) {
      await runShell(`vol.py -f "${imageUri}" --profile ${profileName} pslist > "${outputDir}/pslist.txt"`);
      await runShell(`vol.py -f "${imageUri}" --profile ${profileName} netscan > "${outputDir}/netscan.txt"`);
    }

    // Step 3: Data carving
    await runShell(`bulk_extractor -o "${outputDir}/bulk" "${imageUri}"`);

    // Step 4: Generate super timeline
    await runShell(`log2timeline.py --storage-file "${outputDir}/timeline.plaso" "${imageUri}"`);
    await runShell(`psort.py -o dynamic -w "${outputDir}/timeline.csv" "${outputDir}/timeline.plaso"`);

    // Step 5: Upload to Timesketch
    if (uploadToTimesketch) {
      const timeSketchUrl = process.env.TIMESKETCH_URL ?? 'http://localhost:5000';
      await runShell(`timesketch_importer --host "${timeSketchUrl}" --username admin "${outputDir}/timeline.plaso"`);
    }

    return {
      imageHash: extractHash(`${outputDir}/dc3dd.log`),
      timelineEvents: countLines(`${outputDir}/timeline.csv`),
      outputDir,
    };
  },
};
```

### 2. Evidence collection tool

Create `src/tools/forensics/evidence.ts`:
```typescript
export const collectEvidenceTool = {
  name: 'collect-evidence',
  description: 'Collect and hash evidence files for chain-of-custody documentation',
  parameters: {
    sourcePaths: { type: 'array', items: { type: 'string' }, description: 'Paths to collect' },
    outputDir: { type: 'string' },
    caseId: { type: 'string' },
  },
  async execute({ sourcePaths, outputDir, caseId }: EvidenceArgs) {
    const manifest: EvidenceEntry[] = [];
    for (const path of sourcePaths) {
      const hash = await hashFile(path);
      const dest = `${outputDir}/${basename(path)}`;
      await copyFile(path, dest);
      manifest.push({ path, dest, sha256: hash, timestamp: new Date().toISOString(), caseId });
    }
    await writeJson(`${outputDir}/manifest.json`, manifest);
    return { collected: manifest.length, manifest };
  },
};
```

### 3. Register forensics tools

In `src/tools/registry.ts`, add forensics toolset:
```typescript
forensics: [
  forensicsPipelineTool,
  collectEvidenceTool,
  volatilityTool,
  bulkExtractorTool,
  plasoTool,
  stringsAnalysisTool,
  hexdumpTool,
],
```

### 4. Forensics skill pack

Create `src/skills/packs/forensics/index.ts` with skills:
- `forensic-image-analysis` - full pipeline from image to timeline
- `memory-forensics` - volatility-focused memory analysis
- `timeline-generation` - plaso/log2timeline workflow
- `evidence-collection` - chain-of-custody evidence harvesting
- `malware-carving` - extract suspicious files from disk images

### 5. Scout integration

All forensics tool runs emit Scout events:
```typescript
scout.emit({
  type: 'forensics-tool-run',
  tool: toolName,
  target: imageUri,
  caseId,
  riskLevel: 'medium',
  timestamp: new Date(),
});
```

## Verification Checklist

- [ ] `carina tools run forensics-pipeline --args imageUri=/evidence/disk.dd outputDir=/cases/001`
      runs all pipeline steps and reports completion
- [ ] Evidence manifest contains SHA-256 hash for each collected file
- [ ] Scout shows `forensics-tool-run` event in the event log
- [ ] Forensics toolset appears in `carina tools list --category forensics`

## Files to Create or Modify

- CREATE `src/tools/forensics/pipeline.ts`
- CREATE `src/tools/forensics/evidence.ts`
- CREATE `src/tools/forensics/volatility.ts`
- CREATE `src/skills/packs/forensics/index.ts`
- MODIFY `src/tools/registry.ts` - register forensics toolset
