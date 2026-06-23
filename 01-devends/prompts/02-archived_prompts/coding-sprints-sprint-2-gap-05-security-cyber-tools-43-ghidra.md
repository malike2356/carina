# Tool: ghidra | #43 | NSA Reverse Engineering Framework


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Metadata
- **Priority:** HIGH; **Source:** Kali/Parrot; **Binary:** `ghidra` (headless: `analyzeHeadless`); **Package:** `ghidra`
- **Risk:** low; **Approval:** no; **OS:** kali, parrot (needs Java 17+)

## Purpose
NSA-developed reverse engineering framework. Decompiles binaries to C, analyzes control flow, identifies functions, and supports scripting for automated analysis. Carina uses Ghidra's headless mode for automated binary analysis; decompilation, string extraction, and vulnerability pattern detection.

## Carina CLI Command
```
carina forensic reverse <binary> --engine ghidra [--script <script>] [--decompile]
```

## TypeScript Wrapper

```typescript
export const ghidraTool: ToolDefinition = {
  name: 'ghidra_analyze',
  description: 'NSA RE framework; decompile binaries, string analysis, automated scripting.',
  parameters: {
    binary: { type: 'string', required: true },
    projectDir: { type: 'string', description: 'Ghidra project directory' },
    projectName: { type: 'string', default: 'carina_analysis' },
    script: { type: 'string', description: 'Ghidra script path (.java/.py)' },
    decompile: { type: 'boolean', default: true },
    extractStrings: { type: 'boolean', default: true },
    findFunctions: { type: 'boolean', default: true },
  },
  requires: ['ghidra'],
  risk: 'low',
  category: 'forensic',
  handler: async (params, ctx) => {
    const projDir = params.projectDir || `/tmp/ghidra_${Date.now()}`;
    await execSecure(`mkdir -p ${projDir}`);
    const scriptPath = params.script || '/opt/ghidra_scripts/carina_analyze.py';
    const cmd = `${process.env.GHIDRA_HOME || '/opt/ghidra'}/support/analyzeHeadless ` +
      `${projDir} ${params.projectName} -import ${params.binary} ` +
      `-scriptPath /opt/ghidra_scripts -postScript ${scriptPath}`;
    const result = await execSecure(cmd, { timeout: 3600000 });
    return { binary: params.binary, analysis: result.stdout };
  },
};
```

## Headless Analysis Capabilities
- Decompile all functions to C
- Extract all strings (ASCII + Unicode)
- Identify imports/exports
- Find crypto constants (AES, RSA, etc.)
- Detect common API patterns
- Cross-reference analysis
- Generate call graphs

## Pitfalls
1. **Java heap**; large binaries need 4-8GB heap; set in `ghidra/support/analyzeHeadless`
2. **Analysis time**; 100MB+ binaries can take hours to fully analyze
3. **Script errors**; headless scripts fail silently; check return code
4. **Obfuscated code**; decompilation quality degrades with packing/obfuscation

## Verification
```bash
test -d /opt/ghidra && /opt/ghidra/support/analyzeHeadless -help 2>&1 | head -5
```
