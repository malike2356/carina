# Tool: metagoofil | #09 | Metadata Extractor

## Metadata
- **Priority:** MEDIUM
- **Source:** Kali Linux
- **Binary:** `metagoofil`
- **Package:** `metagoofil`
- **Risk Level:** low
- **Requires Human Approval:** no
- **OS Compatibility:** kali

## Purpose
Extract metadata from public documents (PDF, DOC, XLS, PPT) found via Google searches. Reveals usernames, software versions, email addresses, server paths, and internal hostnames embedded in documents; valuable for mapping internal infrastructure and employee structure.

## Carina CLI Command
```
carina recon metadata <domain> [--types pdf,doc,xls,ppt,all] [--limit N] [--download]
```

## TypeScript Wrapper

```typescript
export const metagoofilTool: ToolDefinition = {
  name: 'metagoofil_extract',
  description: 'Extract metadata from public documents; usernames, paths, emails, software versions.',
  parameters: {
    domain:    { type: 'string', description: 'Target domain', required: true },
    fileTypes: { type: 'array', items: 'string', description: 'Document types: pdf,doc,xls,ppt,all', default: ['all'] },
    limit:     { type: 'number', default: 50, description: 'Max documents per type' },
    download:  { type: 'boolean', default: false, description: 'Download documents for deeper analysis' },
    workDir:   { type: 'string', description: 'Directory for downloaded files', required: false },
  },
  requires: ['metagoofil'],
  risk: 'low',
  category: 'recon',
  handler: async (params, ctx) => {
    const dir = params.workDir || `/tmp/metagoofil_${Date.now()}`;
    await execSecure(`mkdir -p ${dir}`);
    const types = params.fileTypes.includes('all') ? 'pdf,doc,xls,ppt' : params.fileTypes.join(',');
    const dlFlag = params.download ? '-d' : '';
    const cmd = `metagoofil -d ${params.domain} -t ${types} -l ${params.limit || 50} -o ${dir} ${dlFlag} -f results.html`;
    const result = await execSecure(cmd, { timeout: 300000 });
    return parseMetagoofilHtml(`${dir}/results.html`);
  },
};
```

## Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| domain | string | yes |; | Target domain |
| fileTypes | array | no | [all] | pdf/doc/xls/ppt/all |
| limit | number | no | 50 | Max docs per type |
| download | boolean | no | false | Download docs |
| workDir | string | no | auto | Output directory |

## Structured Output
```json
{
  "domain": "example.com",
  "documents_found": 23,
  "metadata": {
    "usernames": ["jsmith", "admin"],
    "emails": ["john.smith@example.com"],
    "software": ["Microsoft Word 2019", "Adobe Acrobat 2022"],
    "paths": ["C:\\Users\\jsmith\\Documents\\", "\\\\server\\share\\"],
    "hostnames": ["internal-wiki.example.local"]
  }
}
```

## Workflow Chains
```
UPSTREAM:   03-theHarvester (domain context)
DOWNSTREAM: 04-recon-ng (enrich contact DB)
CHAINS:     metagoofil → username extraction → sherlock (social profile search)
```

## Pitfalls
1. **Google dorking**; queries Google; may trigger CAPTCHA for heavy use
2. **Limited to indexed docs**; only finds publicly indexed documents
3. **Python2**; may require Python 2 on some distros
4. **Large downloads**; with `--download`, can pull hundreds of MB

## Verification
```bash
which metagoofil
metagoofil -d example.com -t pdf -l 5 -o /tmp/test
```
