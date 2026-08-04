# Research Analysis skill pack

Statistical analysis for academic research: SPSS file I/O, Python stats, PSPP, and Jamovi/jmv.

## Tools

Implemented in `src/tools/research/` and enabled when this pack is active:

- `sav_read`, `sav_write`, `spv_read`, `spss_syntax_generate`
- `stats_describe`, `stats_compare_groups`, `stats_correlation`, `stats_regression`
- `stats_chi_square`, `stats_normality`, `stats_posthoc`, `apa_format`
- `pspp_analyze`, `jamovi_analyze`

## Python dependencies

```bash
pip install -r requirements.txt
```

Optional system tools: `pspp`, running Jamovi with jmvconnect.

## Hub

Publish with `carina pack publish .` after `pnpm build` in this directory.
