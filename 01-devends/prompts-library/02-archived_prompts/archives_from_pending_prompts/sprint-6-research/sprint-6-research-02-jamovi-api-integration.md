# Sprint 6 -- Prompt 02: Jamovi REST API Integration

**Status: COMPLETED 2026-07-26**

**What was built:**
- Implemented and archived

**Sprint:** 6 -- Research App Integration
**Prompt number:** 02 of 05
**Name:** Jamovi REST API client via jmvconnect
**Primary agent:** Claude Code
**Estimated hours:** 2-3 h
**Depends on:** 03-file-format-support.md (.sav reader needed)
**Status:** DONE (2026-06-25)

---

## Read first

1. Master index: `sprint-6-Research_app_Integration-spss_and_more.md`
2. Jamovi API docs: https://dev.jamovi.org (jmvconnect package)
3. Python jmvconnect: `pip install jmvconnect`

---

## Context

Jamovi is a free, open-source statistical GUI built on R. It has a proper REST
API (`jmvconnect`) that allows external tools to send analysis commands and
receive structured results. Unlike PSPP (CLI parsing), Jamovi returns JSON
directly -- no text parsing needed. Cleanest integration path for modern
research workflows.

---

## Goal

Build a Jamovi REST API client that lets Carina:

1. Check if a Jamovi instance is running and reachable
2. Send analysis commands (descriptive, t-test, ANOVA, regression, etc.)
3. Receive structured JSON results
4. Format results in APA style

### Step 1: Jamovi Client (Python)

Create `02-backends/core.carinaai.uk/src/tools/research/jamovi-client.py`:

```python
#!/usr/bin/env python3
"""Jamovi REST API client for Carina research integration."""

import json
import sys
import argparse
import requests

DEFAULT_JAMOVI_URL = "http://localhost:41337"  # default jmvconnect port


def check_jamovi(url):
    """Check if Jamovi is running and reachable."""
    try:
        r = requests.get(f"{url}/api/status", timeout=5)
        return r.status_code == 200
    except requests.RequestException:
        return False


def list_analyses(url):
    """List available analysis types from Jamovi."""
    try:
        r = requests.get(f"{url}/api/analyses", timeout=5)
        return r.json()
    except requests.RequestException as e:
        return {"error": str(e)}


def run_analysis(url, data_path, analysis_type, variables, **kwargs):
    """Run an analysis via Jamovi REST API."""

    payload = {
        "data": data_path,
        "analysis": analysis_type,
        "variables": variables,
    }

    # Add optional parameters
    if "group_by" in kwargs:
        payload["groupBy"] = kwargs["group_by"]
    if "dependent" in kwargs:
        payload["dependent"] = kwargs["dependent"]
    if "covariates" in kwargs:
        payload["covariates"] = kwargs["covariates"]
    if "options" in kwargs:
        payload["options"] = kwargs["options"]

    try:
        r = requests.post(
            f"{url}/api/analysis/run",
            json=payload,
            timeout=60,
        )
        r.raise_for_status()
        return r.json()
    except requests.RequestException as e:
        return {"error": str(e)}


# Analysis type mapping from Carina names to Jamovi module names
ANALYSIS_MAP = {
    "descriptive": "descriptives",
    "ttest_independent": "ttestIS",
    "ttest_paired": "ttestPS",
    "ttest_one_sample": "ttestOneS",
    "anova": "anova",
    "anova_repeated": "anovaRM",
    "ancova": "ancova",
    "chi_square": "contTables",
    "correlation": "corrMatrix",
    "regression_linear": "linReg",
    "regression_logistic": "logRegBin",
    "nonparametric_mann_whitney": "ttestIS",  # Jamovi handles via options
    "nonparametric_wilcoxon": "ttestPS",
    "nonparametric_kruskal_wallis": "anova",
    "factor": "efa",
    "reliability": "reliability",
}


def main():
    parser = argparse.ArgumentParser(description="Carina Jamovi client")
    sub = parser.add_subparsers(dest="command")

    check_cmd = sub.add_parser("check")
    check_cmd.add_argument("--url", default=DEFAULT_JAMOVI_URL)

    list_cmd = sub.add_parser("list")
    list_cmd.add_argument("--url", default=DEFAULT_JAMOVI_URL)

    run_cmd = sub.add_parser("run")
    run_cmd.add_argument("--url", default=DEFAULT_JAMOVI_URL)
    run_cmd.add_argument("--data", required=True)
    run_cmd.add_argument("--analysis", required=True)
    run_cmd.add_argument("--variables", required=True)
    run_cmd.add_argument("--group-by")
    run_cmd.add_argument("--dependent")
    run_cmd.add_argument("--covariates")
    run_cmd.add_argument("--options")

    args = parser.parse_args()

    if args.command == "check":
        ok = check_jamovi(args.url)
        print(json.dumps({"running": ok}))
    elif args.command == "list":
        result = list_analyses(args.url)
        print(json.dumps(result, indent=2))
    elif args.command == "run":
        variables = args.variables.split(",")
        kwargs = {}
        if args.group_by:
            kwargs["group_by"] = args.group_by
        if args.dependent:
            kwargs["dependent"] = args.dependent
        if args.covariates:
            kwargs["covariates"] = args.covariates.split(",")
        if args.options:
            kwargs["options"] = json.loads(args.options)

        # Map analysis name
        jamovi_analysis = ANALYSIS_MAP.get(args.analysis, args.analysis)
        result = run_analysis(
            args.url, args.data, jamovi_analysis, variables, **kwargs
        )
        print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
```

### Step 2: TypeScript Tool Wrapper

Create `02-backends/core.carinaai.uk/src/tools/research/jamovi-tool.ts`:

```typescript
import { execSync } from 'node:child_process';

interface JamoviResult {
  running?: boolean;
  error?: string;
  results?: JamoviAnalysisResult;
}

interface JamoviAnalysisResult {
  analysisType: string;
  tables: Array<{
    title: string;
    data: Record<string, unknown>[];
  }>;
  notes: Array<{ type: string; text: string }>;
}

export async function executeJamoviTool(params: {
  dataFile: string;
  analysisType: string;
  variables: string[];
  groupBy?: string;
  dependentVar?: string;
  options?: Record<string, unknown>;
}): Promise<ToolResult> {
  // 1. Check Jamovi is running
  const checkResult = execSync(
    `python3 ${__dirname}/jamovi-client.py check`,
    { encoding: 'utf-8', timeout: 10000 }
  );
  const { running } = JSON.parse(checkResult);

  if (!running) {
    return {
      content: [{
        type: 'text',
        text: `Jamovi is not running. Start Jamovi and ensure the jmvconnect module is installed.\n\n` +
          `Install: Open Jamovi -> Modules -> install jmvconnect\n` +
          `Or use PSPP instead: pspp_analyze tool.`
      }],
      isError: true,
    };
  }

  // 2. Run analysis
  const args = [
    `--data "${params.dataFile}"`,
    `--analysis "${params.analysisType}"`,
    `--variables "${params.variables.join(',')}"`,
  ];
  if (params.groupBy) args.push(`--group-by "${params.groupBy}"`);
  if (params.dependentVar) args.push(`--dependent "${params.dependentVar}"`);
  if (params.options) args.push(`--options '${JSON.stringify(params.options)}'`);

  try {
    const result = execSync(
      `python3 ${__dirname}/jamovi-client.py run ${args.join(' ')}`,
      { encoding: 'utf-8', timeout: 120000, maxBuffer: 10 * 1024 * 1024 }
    );
    const parsed = JSON.parse(result);

    if (parsed.error) {
      return {
        content: [{ type: 'text', text: `Jamovi analysis failed: ${parsed.error}` }],
        isError: true,
      };
    }

    // 3. Format as APA
    return {
      content: [{
        type: 'text',
        text: formatJamoviResultsAsAPA(parsed, params),
      }],
    };
  } catch (err: any) {
    return {
      content: [{ type: 'text', text: `Jamovi execution failed: ${err.message}` }],
      isError: true,
    };
  }
}
```

### Step 3: Tool Registration

```typescript
{
  name: 'jamovi_analyze',
  description: 'Run statistical analysis using Jamovi REST API. ' +
    'Requires running Jamovi instance with jmvconnect module. ' +
    'Returns APA-formatted results. Supports descriptive, t-test, ANOVA, ' +
    'chi-square, correlation, regression, factor analysis, and reliability.',
  parameters: {
    type: 'object',
    properties: {
      dataFile: { type: 'string', description: 'Path to .sav or .csv file' },
      analysisType: {
        type: 'string',
        enum: ['descriptive', 'ttest_independent', 'ttest_paired', 'anova',
               'chi_square', 'correlation', 'regression_linear', 'factor'],
      },
      variables: { type: 'array', items: { type: 'string' } },
      groupBy: { type: 'string' },
      dependentVar: { type: 'string' },
      options: { type: 'object' },
    },
    required: ['dataFile', 'analysisType', 'variables'],
  },
  requires: {
    commands: ['python3'],
    pythonPackages: ['requests'],
    services: ['jamovi (jmvconnect)'],
  },
  handler: executeJamoviTool,
}
```

---

## Testing

```bash
# Install Jamovi and jmvconnect
# Download from https://www.jamovi.org/download.html
# Open Jamovi -> Modules -> install jmvconnect

# Test connectivity
python3 src/tools/research/jamovi-client.py check

# Test analysis
python3 src/tools/research/jamovi-client.py run \
  --data testdata.sav \
  --analysis descriptive \
  --variables "age,income,education"
```

---

## Existing Carina code to integrate with

- `02-backends/core.carinaai.uk/src/tools/research/jamovi-client.py` -- new
- `02-backends/core.carinaai.uk/src/tools/research/jamovi-tool.ts` -- new
- `02-backends/core.carinaai.uk/packages/packs/research-analysis/tools.ts` -- register
