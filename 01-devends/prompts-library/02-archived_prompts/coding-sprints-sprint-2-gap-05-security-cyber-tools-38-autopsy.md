# Tool: autopsy | #38 | Digital Forensics Platform


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Metadata
- **Priority:** CRITICAL; **Source:** Kali/CSI; **Binary:** `autopsy`; **Package:** `autopsy`
- **Risk:** low; **Approval:** no; **OS:** kali, csi

## Purpose
Digital forensics platform built on The Sleuth Kit. Provides case management, timeline analysis, keyword search, hash filtering, web artifacts analysis, and reporting. Carina uses Autopsy's CLI/API for automated forensic case processing; creating cases, ingesting disk images, running ingest modules, and generating reports.

## Carina CLI Command
```
carina forensic autopsy <image> [--case <name>] [--modules ingest1,ingest2,...] [--report html|pdf]
```

## TypeScript Wrapper

```typescript
export const autopsyTool: ToolDefinition = {
  name: 'autopsy_case',
  description: 'Digital forensics platform; case management, ingest, timeline, reporting.',
  parameters: {
    image: { type: 'string', description: 'Disk image path (dd, E01, AFF)', required: true },
    caseName: { type: 'string', description: 'Case name' },
    caseNumber: { type: 'string', description: 'Case/reference number' },
    examiner: { type: 'string', description: 'Examiner name' },
    ingestModules: { type: 'array', items: 'string', default: ['RecentActivity','HashLookup','FileTypeId','EmbeddedFileExtractor','ExifParser','KeywordSearch','EmailParser','WebArtifacts'] },
    keywords: { type: 'array', items: 'string' },
    report: { type: 'enum', values: ['html', 'pdf', 'none'], default: 'html' },
    outputDir: { type: 'string', required: true },
  },
  requires: ['autopsy'],
  risk: 'low',
  category: 'forensic',
  handler: async (params, ctx) => {
    const caseDir = `${params.outputDir}/${params.caseName || 'case_' + Date.now()}`;
    await execSecure(`mkdir -p ${caseDir}`);
    // Autopsy CLI: create case, add image, run ingest, generate report
    const cmd = `autopsy --createCase --caseName="${params.caseName}" --caseDir="${caseDir}" ` +
      `--caseNum="${params.caseNumber || ''}" --examiner="${params.examiner || 'Carina Forensic Agent'}" ` +
      `--dataSource="${params.image}" --ingestModules="${params.ingestModules.join(',')}" ` +
      `--generateReport --reportFormats=${params.report}`;
    const result = await execSecure(cmd, { timeout: 3600000 });
    return { caseDir, output: result.stdout };
  },
};
```

## Ingest Modules
| Module | Purpose |
|--------|---------|
| RecentActivity | Recent files, web, USB |
| HashLookup | NSRL/Known file hashes |
| FileTypeId | MIME type detection |
| EmbeddedFileExtractor | Extract embedded files |
| ExifParser | Metadata extraction |
| KeywordSearch | Keyword/indexed search |
| EmailParser | PST/OST/MBOX parsing |
| WebArtifacts | Browser history/cookies |
| PhotoRecCarver | File carving |
| AndroidAnalyzer | Android artifacts |
| PlasoConverter | log2timeline integration |

## Workflow Chains
```
UPSTREAM:   40-dc3dd (forensic image)
DOWNSTREAM: 39-volatility3 (memory), 51-regripper (registry), 69-log2timeline (timeline)
```

## Pitfalls
1. **Java dependency**; requires Java 11+ with sufficient heap
2. **Image size**; multi-TB images can take days to ingest
3. **Memory hungry**; SQLite/PostgreSQL backend grows with case size
4. **CLI limitations**; CLI is less featureful than GUI; some modules GUI-only
5. **Ingest order**; modules run sequentially; prioritize fast ones first

## Verification
```bash
which autopsy && autopsy --version
```
