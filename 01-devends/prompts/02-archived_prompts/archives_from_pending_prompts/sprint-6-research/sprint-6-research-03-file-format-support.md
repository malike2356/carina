# Sprint 6 -- Prompt 03: SPSS File Format Support (.sav, .sps, .spv)

**Sprint:** 6 -- Research App Integration
**Prompt number:** 03 of 05
**Name:** .sav reader/writer, .sps syntax generator, .spv output parser
**Primary agent:** Claude Code
**Estimated hours:** 2-3 h
**Depends on:** Nothing (foundation for 01 and 02)
**Status:** DONE (2026-06-25)

---

## Read first

1. Master index: `sprint-6-Research_app_Integration-spss_and_more.md`
2. pyreadstat docs: https://github.com/Roche/pyreadstat
3. Python dependencies: `pip install pyreadstat pandas`

---

## Context

SPSS uses three file formats that Carina must handle:

| Format | Extension | Purpose | Python library |
|--------|-----------|---------|---------------|
| Data | .sav | SPSS data file (variables, labels, values) | pyreadstat |
| Syntax | .sps | SPSS command syntax | Manual generation |
| Output | .spv | SPSS viewer output (binary) | pyreadstat (read only) |

This prompt builds the file I/O layer. Every other research tool (PSPP, Jamovi,
Python analysis, R) depends on being able to read .sav files.

---

## Goal

### Step 1: .sav Reader/Writer (Python)

Create `02-backends/core.carinaai.uk/src/tools/research/sav-io.py`:

```python
#!/usr/bin/env python3
"""SPSS .sav file I/O using pyreadstat."""

import json
import sys
import argparse
import pyreadstat


def read_sav(filepath, include_data=True, max_rows=None):
    """Read a .sav file and return metadata + data."""
    try:
        df, meta = pyreadstat.read_sav(filepath)

        result = {
            "file": filepath,
            "rows": len(df),
            "columns": len(df.columns),
            "variables": [],
        }

        # Extract variable metadata
        for col in df.columns:
            var_info = {
                "name": col,
                "type": str(df[col].dtype),
                "label": meta.column_labels.get(col, ""),
                "missing_count": int(df[col].isna().sum()),
            }

            # Value labels (e.g., 1=Male, 2=Female)
            if col in meta.value_labels:
                var_info["value_labels"] = {
                    str(k): v for k, v in meta.value_labels[col].items()
                }

            # Variable measure level
            if col in meta.variable_measure:
                measure_map = {"nominal": "nominal", "ordinal": "ordinal", "scale": "scale"}
                var_info["measure"] = measure_map.get(
                    meta.variable_measure[col], "unknown"
                )

            result["variables"].append(var_info)

        # Include data if requested
        if include_data:
            if max_rows:
                df = df.head(max_rows)
            result["data"] = df.to_dict(orient="records")
            result["data_truncated"] = max_rows is not None and len(df) >= max_rows

        return result

    except Exception as e:
        return {"error": str(e), "file": filepath}


def write_sav(filepath, data, metadata=None):
    """Write a DataFrame to a .sav file."""
    try:
        import pandas as pd

        df = pd.DataFrame(data)

        # Build pyreadstat metadata from provided metadata
        column_labels = {}
        value_labels = {}
        variable_measure = {}

        if metadata:
            for var in metadata.get("variables", []):
                name = var["name"]
                if "label" in var:
                    column_labels[name] = var["label"]
                if "value_labels" in var:
                    value_labels[name] = {
                        int(k): v for k, v in var["value_labels"].items()
                    }
                if "measure" in var:
                    measure_map = {
                        "nominal": "nominal",
                        "ordinal": "ordinal",
                        "scale": "scale",
                    }
                    variable_measure[name] = measure_map.get(var["measure"], "nominal")

        pyreadstat.write_sav(
            df,
            filepath,
            column_labels=column_labels or None,
            value_labels=value_labels or None,
            variable_measure=variable_measure or None,
        )

        return {"success": True, "file": filepath, "rows": len(df), "columns": len(df.columns)}

    except Exception as e:
        return {"error": str(e)}


def read_spv(filepath):
    """Read SPSS output (.spv) file and extract tables/text."""
    try:
        # pyreadstat can read .spv metadata
        meta = pyreadstat.read_spv_metadata(filepath)

        result = {
            "file": filepath,
            "tables": [],
            "text": [],
        }

        for item in meta:
            if item.get("type") == "table":
                result["tables"].append({
                    "title": item.get("title", ""),
                    "rows": item.get("data", []),
                })
            elif item.get("type") == "text":
                result["text"].append(item.get("text", ""))

        return result

    except Exception as e:
        return {"error": str(e), "file": filepath}


def main():
    parser = argparse.ArgumentParser(description="SPSS file I/O")
    sub = parser.add_subparsers(dest="command")

    read_cmd = sub.add_parser("read")
    read_cmd.add_argument("--file", required=True)
    read_cmd.add_argument("--max-rows", type=int)
    read_cmd.add_argument("--metadata-only", action="store_true")

    write_cmd = sub.add_parser("write")
    write_cmd.add_argument("--file", required=True)
    write_cmd.add_argument("--data", required=True)  # JSON string
    write_cmd.add_argument("--metadata")  # optional JSON string

    spv_cmd = sub.add_parser("spv")
    spv_cmd.add_argument("--file", required=True)

    args = parser.parse_args()

    if args.command == "read":
        result = read_sav(
            args.file,
            include_data=not args.metadata_only,
            max_rows=args.max_rows,
        )
        print(json.dumps(result, indent=2, default=str))
    elif args.command == "write":
        data = json.loads(args.data)
        metadata = json.loads(args.metadata) if args.metadata else None
        result = write_sav(args.file, data, metadata)
        print(json.dumps(result, indent=2))
    elif args.command == "spv":
        result = read_spv(args.file)
        print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    main()
```

### Step 2: TypeScript Tool Wrappers

Create `02-backends/core.carinaai.uk/src/tools/research/sav-tools.ts`:

```typescript
// Three tools: sav_read, sav_write, spv_read

export async function savReadTool(params: {
  file: string;
  maxRows?: number;
  metadataOnly?: boolean;
}): Promise<ToolResult> {
  const args = [`--file "${params.file}"`];
  if (params.maxRows) args.push(`--max-rows ${params.maxRows}`);
  if (params.metadataOnly) args.push('--metadata-only');

  const result = execSync(
    `python3 ${__dirname}/sav-io.py read ${args.join(' ')}`,
    { encoding: 'utf-8', timeout: 30000, maxBuffer: 10 * 1024 * 1024 }
  );
  const data = JSON.parse(result);

  if (data.error) {
    return { content: [{ type: 'text', text: `Error reading .sav: ${data.error}` }], isError: true };
  }

  return {
    content: [{
      type: 'text',
      text: `## ${data.file}\n` +
        `**Rows:** ${data.rows} | **Columns:** ${data.columns}\n\n` +
        `### Variables\n` +
        data.variables.map((v: any) =>
          `- **${v.name}** (${v.type})${v.label ? ` - ${v.label}` : ''}${v.missing_count > 0 ? ` [${v.missing_count} missing]` : ''}${v.value_labels ? `\n  Values: ${Object.entries(v.value_labels).map(([k,v]) => `${k}=${v}`).join(', ')}` : ''}`
        ).join('\n') +
        (data.data ? `\n\n### Data Preview (${data.data.length} rows)\n${formatTable(data.variables, data.data.slice(0, 10))}` : '')
    }],
  };
}

// Tool registrations in pack:
// sav_read: Read .sav (SPSS data) files. Returns variable list, metadata, and data preview.
// sav_write: Write data to .sav format with variable labels and value labels.
// spv_read: Read .spv (SPSS output viewer) files. Extracts tables and text.
```

### Step 3: .sps Syntax Generator

Already implemented in `sprint-6-research-01-pspp-cli-pipeline.md`. The
`generateSyntax()` function produces valid SPSS/PSPP syntax. Carina can
also generate syntax as a standalone output for users who need to run it
manually in SPSS:

```typescript
{
  name: 'spss_syntax_generate',
  description: 'Generate SPSS syntax (.sps) from a natural language description ' +
    'of the analysis. User can then run this in SPSS or PSPP.',
  parameters: {
    type: 'object',
    properties: {
      analysisType: { type: 'string', enum: ['descriptive', 'ttest', ...] },
      variables: { type: 'array', items: { type: 'string' } },
      // ... same as generateSyntax params
      outputPath: { type: 'string', description: 'Where to save the .sps file' },
    },
    required: ['analysisType', 'variables'],
  },
  handler: async (params) => {
    const syntax = generateSyntax(params);
    const path = params.outputPath || `/tmp/carina-analysis-${Date.now()}.sps`;
    writeFileSync(path, syntax);
    return { content: [{ type: 'text', text: `SPSS syntax saved to ${path}\n\n\`\`\`spss\n${syntax}\n\`\`\`` }] };
  },
}
```

---

## Testing

```bash
# Install pyreadstat
pip install pyreadstat pandas

# Test .sav read
python3 src/tools/research/sav-io.py read --file testdata.sav --max-rows 10

# Test .sav write
python3 src/tools/research/sav-io.py write --file output.sav --data '[{"x":1},{"x":2}]'

# Test .spv read
python3 src/tools/research/sav-io.py spv --file output.spv

# TypeScript tool tests
pnpm test -- --run tests/tools/research/sav-tools.test.ts
```

---

## Existing Carina code to integrate with

- `02-backends/core.carinaai.uk/src/tools/research/sav-io.py` -- new
- `02-backends/core.carinaai.uk/src/tools/research/sav-tools.ts` -- new
- `02-backends/core.carinaai.uk/src/tools/research/pspp-syntax.ts` -- from prompt 01
- `02-backends/core.carinaai.uk/packages/packs/research-analysis/tools.ts` -- register
- `02-backends/core.carinaai.uk/requirements.txt` -- add `pyreadstat>=1.2 pandas>=2.0`
