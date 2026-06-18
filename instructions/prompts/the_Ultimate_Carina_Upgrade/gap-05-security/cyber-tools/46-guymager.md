# Tool: guymager | #46 | Forensic Imager

## Metadata
- **Priority:** HIGH; **Source:** CSI; **Binary:** `guymager`; **Package:** `guymager`
- **Risk:** low; **Approval:** no; **OS:** csi, kali

## Purpose
GUI forensic imager with CLI automation. Creates forensically sound disk images (DD, E01, AFF) with integrated hash verification and logging. Complements dc3dd with E01 support and case-management integration.

## Carina CLI Command
```
carina forensic image <device> --engine guymager [--format e01|dd|aff] [--compress]
```

## TypeScript Wrapper

```typescript
export const guymagerTool: ToolDefinition = {
  name: 'guymager_image',
  description: 'Forensic imager; DD, E01, AFF formats with hash verification.',
  parameters: {
    device: { type: 'string', required: true },
    output: { type: 'string', required: true },
    format: { type: 'enum', values: ['dd', 'e01', 'aff'], default: 'e01' },
    caseName: { type: 'string' },
    examiner: { type: 'string', default: 'Carina Forensic Agent' },
    compress: { type: 'boolean', default: true },
  },
  requires: ['guymager'],
  risk: 'low',
  category: 'forensic',
  handler: async (params, ctx) => {
    const cmd = `guymager --cli --device=${params.device} --output=${params.output} ` +
      `--format=${params.format} --case="${params.caseName || ''}" --examiner="${params.examiner}" ` +
      `--hash=sha256 ${params.compress ? '--compress' : ''}`;
    const result = await execSecure(cmd, { timeout: 86400000 });
    return parseGuymagerLog(result.stdout);
  },
};
```

## Pitfalls
1. **GUI primary**; CLI mode is less documented; test thoroughly
2. **E01 format**; standard for law enforcement; DD is universal
3. **Compression**; E01 compression slows imaging but saves space

## Verification
```bash
which guymager && guymager --version
```
