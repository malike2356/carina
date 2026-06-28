# Sprint 6 -- Prompt 04: Research Analysis Skill Pack

**Sprint:** 6 -- Research App Integration
**Prompt number:** 04 of 05
**Name:** Research analysis skill pack -- tools, skills, APA formatting
**Primary agent:** Claude Code
**Estimated hours:** 3-4 h
**Depends on:** 03 (file formats), 01 (PSPP), 02 (Jamovi)
**Status:** DONE (2026-06-25)

---

## Read first

1. Master index: `sprint-6-Research_app_Integration-spss_and_more.md`
2. Existing skill pack structure: `02-backends/core.carinaai.uk/packages/packs/`
3. Tool registry: `02-backends/core.carinaai.uk/src/tools/toolset.ts`
4. pyreadstat, scipy, statsmodels docs

---

## Context

The research analysis skill pack bundles all the tools from prompts 01-03 plus
pure-Python analysis tools for when neither PSPP nor Jamovi is available. It
also includes the skill instructions so Carina knows when and how to use each
tool.

The pack configuration:

- **Name:** `research-analysis`
- **Category:** `academic`
- **Dependencies:** Python 3.10+, pyreadstat, pandas, scipy, statsmodels, numpy
- **Optional deps:** PSPP (system), Jamovi (running instance)
- **Tier:** Free (all paths use free tools)

---

## Goal

### Step 1: Pack Structure

```
02-backends/core.carinaai.uk/packages/packs/research-analysis/
  pack.json                  # pack manifest
  SKILL.md                   # skill instructions for Carina
  tools.py                   # pure-Python analysis tools
  tools.ts                   # TypeScript tool wrappers + registrations
  requirements.txt            # Python deps
```

### Step 2: pack.json

```json
{
  "name": "research-analysis",
  "version": "1.0.0",
  "description": "Statistical analysis for research - descriptive and inferential statistics with APA formatting. Supports SPSS, PSPP, Jamovi, and Python-based analysis.",
  "author": "VERLOX",
  "category": "academic",
  "tags": ["statistics", "research", "spss", "analysis", "academic"],
  "tier": "free",
  "requires": {
    "python": ">=3.10",
    "pip": ["pyreadstat>=1.2", "pandas>=2.0", "scipy>=1.11", "statsmodels>=0.14", "numpy>=1.24"]
  },
  "optional": {
    "commands": ["pspp"],
    "services": ["jamovi (jmvconnect)"]
  },
  "tools": [
    "stats_describe",
    "stats_compare_groups",
    "stats_correlation",
    "stats_regression",
    "stats_chi_square",
    "stats_normality",
    "stats_posthoc",
    "pspp_analyze",
    "jamovi_analyze",
    "sav_read",
    "sav_write",
    "spss_syntax_generate",
    "spv_read",
    "apa_format"
  ],
  "homepage": "https://carinaai.uk/docs/user/skill-packs/research-analysis"
}
```

### Step 3: SKILL.md

```markdown
---
name: research-analysis
description: Statistical analysis for academic research - SPSS, PSPP, Jamovi, and Python-based
---

# Research Analysis Skill Pack

## When to use

The user is doing academic or scientific research involving quantitative data
analysis. They mention SPSS, statistics, data analysis, thesis, dissertation,
or research methods. They may have .sav, .csv, or .sps files.

## How to choose the analysis path

1. **If the user just wants to explore their data:**
   Use `sav_read` to show variable list, labels, and data preview.
   Then use `stats_describe` for summary statistics.

2. **If the user asks for PSPP or SPSS syntax:**
   Use `pspp_analyze` (if PSPP installed) or `spss_syntax_generate`
   to produce a .sps file they can run in SPSS.

3. **If the user runs Jamovi:**
   Use `jamovi_analyze` for API-driven analysis with structured JSON results.

4. **Fallback (always available):**
   Use `stats_describe`, `stats_compare_groups`, `stats_correlation`,
   `stats_regression`, `stats_chi_square`, `stats_normality`.
   These run purely in Python with no external dependencies beyond pip packages.

## Analysis workflow

1. **Load the data:** `sav_read` or `sav_write` to handle .sav files.
   For .csv, use the standard `file_read` tool.

2. **Explore:** `stats_describe` for frequencies, descriptives, normality tests.

3. **Test:** `stats_compare_groups` for t-tests/ANOVA, `stats_correlation` for
   relationships, `stats_regression` for prediction, `stats_chi_square` for
   categorical association.

4. **Post-hoc:** `stats_posthoc` after significant ANOVA.

5. **Format:** Results are always returned in APA 7th edition format with
   tables, test statistics, degrees of freedom, p-values, and effect sizes.

## Important rules

- Always show the variable list from `sav_read` before running analysis so the
  user can confirm which variables to use.
- If the user's supervisor requires SPSS-specific output, use `pspp_analyze`
  or `spss_syntax_generate`. PSPP syntax is identical to SPSS syntax.
- Report effect sizes (Cohen's d, eta-squared, Cramer's V) alongside p-values.
- Flag violations of test assumptions (normality, homogeneity of variance)
  and suggest alternatives (non-parametric equivalents).
- For missing data, report how many cases were excluded and why.
```

### Step 4: Pure-Python Analysis Tools

Create `tools.py` with all the Python-side analysis implementations:

```python
#!/usr/bin/env python3
"""Pure-Python statistical analysis tools. No PSPP or Jamovi needed."""

import json
import sys
import argparse
import numpy as np
import pandas as pd
from scipy import stats
import statsmodels.api as sm
from statsmodels.stats.multicomp import pairwise_tukeyhsd


def load_data(filepath):
    """Load .sav or .csv into DataFrame."""
    if filepath.endswith('.sav'):
        import pyreadstat
        df, _ = pyreadstat.read_sav(filepath)
    else:
        df = pd.read_csv(filepath)
    return df


def descriptive_stats(df, variables):
    """Run descriptive statistics: mean, SD, median, min, max, skew, kurtosis."""
    results = []
    for var in variables:
        if var not in df.columns:
            continue
        series = df[var].dropna()
        results.append({
            "variable": var,
            "n": int(len(series)),
            "missing": int(df[var].isna().sum()),
            "mean": round(float(series.mean()), 3),
            "std": round(float(series.std()), 3),
            "median": round(float(series.median()), 3),
            "min": round(float(series.min()), 3),
            "max": round(float(series.max()), 3),
            "skewness": round(float(series.skew()), 3),
            "kurtosis": round(float(series.kurtosis()), 3),
        })
    return results


def normality_test(df, variables):
    """Shapiro-Wilk test for each variable."""
    results = []
    for var in variables:
        if var not in df.columns:
            continue
        series = df[var].dropna()
        if len(series) > 5000:
            # Shapiro-Wilk max is 5000; use KS for large samples
            stat, p = stats.kstest(series, 'norm', args=(series.mean(), series.std()))
            test_type = "Kolmogorov-Smirnov"
        else:
            stat, p = stats.shapiro(series)
            test_type = "Shapiro-Wilk"
        results.append({
            "variable": var,
            "test": test_type,
            "statistic": round(float(stat), 4),
            "p_value": round(float(p), 4),
            "normal": p > 0.05,
        })
    return results


def ttest(df, variables, group_by):
    """Independent samples t-test."""
    groups = df[group_by].dropna().unique()
    if len(groups) != 2:
        return {"error": f"t-test requires exactly 2 groups. Found: {list(groups)}"}

    g1 = df[df[group_by] == groups[0]]
    g2 = df[df[group_by] == groups[1]]

    results = []
    for var in variables:
        if var == group_by or var not in df.columns:
            continue
        t_stat, p_val = stats.ttest_ind(
            g1[var].dropna(), g2[var].dropna(), equal_var=False
        )
        # Cohen's d
        d = (g1[var].mean() - g2[var].mean()) / np.sqrt(
            (g1[var].std()**2 + g2[var].std()**2) / 2
        )
        results.append({
            "variable": var,
            "group1": str(groups[0]), "group1_mean": round(float(g1[var].mean()), 3),
            "group2": str(groups[1]), "group2_mean": round(float(g2[var].mean()), 3),
            "t_statistic": round(float(t_stat), 3),
            "df": int(len(g1) + len(g2) - 2),
            "p_value": round(float(p_val), 4),
            "significant": p_val < 0.05,
            "cohens_d": round(float(d), 3),
        })
    return results


def anova(df, variables, group_by):
    """One-way ANOVA."""
    results = []
    for var in variables:
        if var == group_by or var not in df.columns:
            continue
        groups_data = [
            group[var].dropna().values
            for name, group in df.groupby(group_by)
            if var in group.columns
        ]
        f_stat, p_val = stats.f_oneway(*groups_data)
        # Eta-squared
        grand_mean = df[var].mean()
        ss_between = sum(
            len(g) * (g.mean() - grand_mean)**2 for g in groups_data
        )
        ss_total = sum((df[var].dropna() - grand_mean)**2)
        eta_sq = ss_between / ss_total if ss_total > 0 else 0

        results.append({
            "variable": var,
            "f_statistic": round(float(f_stat), 3),
            "df_between": len(groups_data) - 1,
            "df_within": sum(len(g) for g in groups_data) - len(groups_data),
            "p_value": round(float(p_val), 4),
            "significant": p_val < 0.05,
            "eta_squared": round(float(eta_sq), 3),
        })
    return results


def correlation_matrix(df, variables, method='pearson'):
    """Correlation matrix."""
    corr_df = df[variables].corr(method=method)
    p_values = pd.DataFrame(np.ones_like(corr_df), columns=variables, index=variables)

    for i, v1 in enumerate(variables):
        for j, v2 in enumerate(variables):
            if i < j:
                _, p = stats.pearsonr(df[v1].dropna(), df[v2].dropna())
                p_values.loc[v1, v2] = p
                p_values.loc[v2, v1] = p

    results = []
    for i, v1 in enumerate(variables):
        for j, v2 in enumerate(variables):
            if i < j:
                results.append({
                    "var1": v1, "var2": v2,
                    "correlation": round(float(corr_df.loc[v1, v2]), 3),
                    "p_value": round(float(p_values.loc[v1, v2]), 4),
                    "significant": p_values.loc[v1, v2] < 0.05,
                })
    return results


def linear_regression(df, dependent, independents):
    """Multiple linear regression."""
    X = df[independents].dropna()
    y = df.loc[X.index, dependent].dropna()
    X = X.loc[y.index]
    X = sm.add_constant(X)

    model = sm.OLS(y, X).fit()

    return {
        "r_squared": round(float(model.rsquared), 3),
        "adj_r_squared": round(float(model.rsquared_adj), 3),
        "f_statistic": round(float(model.fvalue), 3),
        "f_p_value": round(float(model.f_pvalue), 4),
        "coefficients": [
            {
                "variable": name,
                "coefficient": round(float(coef), 4),
                "std_error": round(float(model.bse[name]), 4),
                "t_statistic": round(float(model.tvalues[name]), 3),
                "p_value": round(float(model.pvalues[name]), 4),
                "significant": model.pvalues[name] < 0.05,
            }
            for name, coef in model.params.items()
        ],
        "n": int(len(y)),
    }


# CLI dispatch
COMMANDS = {
    "descriptive": descriptive_stats,
    "normality": normality_test,
    "ttest": ttest,
    "anova": anova,
    "correlation": lambda df, vars, **kw: correlation_matrix(df, vars, kw.get('method', 'pearson')),
    "regression": lambda df, vars, **kw: linear_regression(df, kw['dependent'], vars),
}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--command", required=True, choices=COMMANDS.keys())
    parser.add_argument("--file", required=True)
    parser.add_argument("--variables", required=True)
    parser.add_argument("--group-by")
    parser.add_argument("--dependent")
    parser.add_argument("--method", default="pearson")
    args = parser.parse_args()

    df = load_data(args.file)
    variables = args.variables.split(",")

    kwargs = {}
    if args.group_by:
        kwargs["group_by"] = args.group_by
    if args.dependent:
        kwargs["dependent"] = args.dependent
    if args.method:
        kwargs["method"] = args.method

    func = COMMANDS[args.command]
    result = func(df, variables, **kwargs)
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    main()
```

### Step 5: TypeScript Tool Wrappers + APA Formatter

```typescript
// Generic Python analysis tool wrapper
async function pythonAnalysis(params: {
  command: string;
  file: string;
  variables: string[];
  groupBy?: string;
  dependent?: string;
  method?: string;
}): Promise<ToolResult> {
  const args = [
    `--command "${params.command}"`,
    `--file "${params.file}"`,
    `--variables "${params.variables.join(',')}"`,
  ];
  if (params.groupBy) args.push(`--group-by "${params.groupBy}"`);
  if (params.dependent) args.push(`--dependent "${params.dependent}"`);
  if (params.method) args.push(`--method "${params.method}"`);

  const result = execSync(
    `python3 ${__dirname}/tools.py ${args.join(' ')}`,
    { encoding: 'utf-8', timeout: 60000, maxBuffer: 5 * 1024 * 1024 }
  );
  const data = JSON.parse(result);

  if (data.error) {
    return { content: [{ type: 'text', text: `Analysis error: ${data.error}` }], isError: true };
  }

  return {
    content: [{ type: 'text', text: formatResultsAsAPA(params.command, data) }],
  };
}

// Tool registrations
const analysisTools = [
  { name: 'stats_describe', handler: (p) => pythonAnalysis({ ...p, command: 'descriptive' }) },
  { name: 'stats_compare_groups', handler: (p) => pythonAnalysis({ ...p, command: p.analysisType === 'anova' ? 'anova' : 'ttest' }) },
  { name: 'stats_correlation', handler: (p) => pythonAnalysis({ ...p, command: 'correlation' }) },
  { name: 'stats_regression', handler: (p) => pythonAnalysis({ ...p, command: 'regression' }) },
  { name: 'stats_normality', handler: (p) => pythonAnalysis({ ...p, command: 'normality' }) },
];
```

---

## Testing

```bash
pip install pyreadstat pandas scipy statsmodels numpy

# Test Python analysis tools directly
python3 packages/packs/research-analysis/tools.py \
  --command descriptive \
  --file testdata.sav \
  --variables "age,income,education"

# Test TypeScript wrappers
pnpm test -- --run tests/tools/research/python-analysis.test.ts
```

---

## Existing Carina code to integrate with

- `02-backends/core.carinaai.uk/packages/packs/research-analysis/` -- new pack
- `02-backends/core.carinaai.uk/src/tools/toolset.ts` -- register pack tools
- `02-backends/core.carinaai.uk/requirements.txt` -- Python deps
