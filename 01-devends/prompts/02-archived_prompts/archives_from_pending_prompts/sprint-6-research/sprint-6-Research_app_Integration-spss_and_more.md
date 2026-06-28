# Sprint 6 -- Research App Integration: SPSS, PSPP, Jamovi & Statistical Analysis

**Sprint:** 6 -- Research App Integration & AI Employee Automation
**Prompt number:** 00 (master index)
**Status:** DONE (2026-06-25)
**Name:** Research app integration master plan
**Primary agent:** Claude Code (backend + Python) / Codex (CLI wiring + tool defs)
**Estimated hours:** 12-16 h total across all child prompts

---

## Summary

Carina needs to support research data analysis workflows. The target users are
academics, students, and researchers doing descriptive and inferential
statistical analysis. The traditional tool is SPSS -- but SPSS is old desktop
software with no API. The strategy is multi-path:

| Path | Tool | Integration method | Cost |
|------|------|-------------------|------|
| A | PSPP | CLI-driven (write syntax, execute, parse output) | Free |
| B | Jamovi | REST API (jmvconnect) | Free |
| C | Python (pyreadstat) | Direct .sav/.sps file I/O + analysis | Free |
| D | R (haven) | R script generation + headless execution | Free |

The skill pack should expose all four paths so the user (or their supervisor)
can choose based on requirements. Some supervisors require SPSS-specific output
formats; others accept any statistical output as long as it's APA-formatted.

---

## Research (from user conversation, 2026-06-25)

### What Carina can already do
- Write SPSS syntax files (.sps) from plain-language descriptions
- Read .sav files via Python (pyreadstat)
- Run descriptive analysis: frequencies, percentages, mean, median, mode, SD,
  range, quartiles, cross-tabulations, normality tests (Shapiro-Wilk, KS)
- Run inferential analysis: t-tests, ANOVA, chi-square, correlation (Pearson,
  Spearman), regression (linear, multiple, logistic), non-parametric equivalents
  (Mann-Whitney, Kruskal-Wallis, Wilcoxon), post-hoc tests with corrections
- Format results in APA style

### Modern SPSS alternatives with APIs
- **PSPP**: Free SPSS clone, CLI-driven, same syntax, zero cost. Carina writes
  .sps file, runs `pspp data.sav analysis.sps`, parses output.
- **Jamovi**: Free, open-source, R-based, REST API via jmvconnect, reads .sav
  natively. Clean modern UI. Closest drop-in replacement for SPSS.
- **JASP**: Free, open-source, R-based, API via jaspTools R package, Bayesian
  and frequentist, strong in psychology/social sciences.
- **Stata**: Paid, pystata Python integration, economics/epidemiology.
- **R + RStudio**: haven package reads/writes .sav, headless R scripting.

### Recommendation from research
PSPP for CLI integration (simplest, cheapest, full SPSS syntax compatibility).
Jamovi for API integration (modern REST API, cleaner than raw R).

---

## Build order (child prompts)

```
01-pspp-cli-pipeline.md       PSPP installation, syntax generation, CLI execution, output parsing
02-jamovi-api-integration.md  Jamovi REST API client, jmvconnect, analysis request/response
03-file-format-support.md     .sav reader/writer, .sps syntax generator, .spv parser (Python)
04-analysis-skill-pack.md     Descriptive + inferential tools, APA formatting, natural language -> analysis
05-r-pipeline.md              R + haven headless pipeline, script generation, Rscript execution
```

Run 03 first (file format support -- foundation for all other paths).
Then 01 and 02 in parallel. 04 builds on 01-03. 05 is standalone.

---

## Key architectural decisions

1. **Python runtime required.** All analysis runs via Python subprocess from
   Carina's exec tool. pyreadstat, scipy, statsmodels, and numpy are
   dependencies. Install via `pip install pyreadstat scipy statsmodels numpy pandas`.

2. **PSPP must be installed on the host.** `sudo apt install pspp` on Debian/Ubuntu.
   Carina checks for the `pspp` binary at tool invocation time and falls back
   to Python-only analysis if not present.

3. **Jamovi must be running.** The Jamovi REST API requires a running Jamovi
   instance (desktop app or headless). Carina checks connectivity at tool
   invocation time and falls back to PSPP or Python.

4. **File handling.** .sav and .csv files are uploaded via Carina's file tool.
   Output (.spv, .pdf, .html tables) is written to the workspace and returned.

5. **No SPSS license required.** All paths use free/open-source tools.
   SPSS-specific syntax output is supported for users who need to run analysis
   in SPSS manually.

---

## Tool definitions (overview)

All tools live in a new skill pack: `research-analysis`.

| Tool | Path | Description |
|------|------|-------------|
| `stats_describe` | All | Run descriptive statistics on a dataset |
| `stats_compare_groups` | All | T-test, ANOVA, Mann-Whitney, Kruskal-Wallis |
| `stats_correlation` | All | Pearson, Spearman correlation matrix |
| `stats_regression` | All | Linear, multiple, logistic regression |
| `stats_chi_square` | All | Chi-square test of independence |
| `stats_normality` | All | Shapiro-Wilk, Kolmogorov-Smirnov tests |
| `stats_posthoc` | All | Post-hoc tests with corrections |
| `spss_syntax_generate` | PSPP/SPSS | Generate .sps syntax from natural language |
| `spss_output_parse` | PSPP/SPSS | Parse .spv or text output into structured data |
| `jamovi_analyze` | Jamovi | Send analysis to Jamovi via REST API |
| `sav_read` | File format | Read .sav file into dataframe |
| `sav_write` | File format | Write dataframe to .sav file |
| `apa_format` | All | Format statistical results in APA 7th edition style |

---

## Done when

- [x] PSPP CLI pipeline works end-to-end (syntax -> execute -> parse -> APA report)
- [x] Jamovi REST API client works (connect -> send -> receive -> parse)
- [x] .sav files read/write correctly with all variable types and labels
- [x] .sps syntax generated correctly for all supported analysis types
- [x] Descriptive analysis produces formatted tables with APA-style summaries
- [x] Inferential analysis produces test statistics, p-values, effect sizes
- [x] Natural language -> analysis pipeline works ("compare group A and B on variable X")
- [x] All tools degrade gracefully when optional dependencies are missing
- [x] Skill pack published to Carina Hub as `research-analysis`
- [x] R pipeline (`r_analyze`) with haven + broom
- [x] `spss_output_parse` for .spv and text output
- [x] Non-parametric tests (Mann-Whitney, Kruskal-Wallis) and logistic regression in Python stats
