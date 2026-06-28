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
   For .csv, use the standard `file-read` tool.

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
