# Sprint 6: Research app integration (COMPLETED)

**Archived:** 2026-06-25  
**Verified on:** tsalach (7/7 smoke tests)

| Host | PSPP | R + packages | Python stats | Vitest smoke | Notes |
|------|------|--------------|--------------|--------------|-------|
| tsalach | 1.4.1 | 4.1.2, all TRUE | all TRUE | 7/7 pass | Dev LAMPP tree |
| aman (`server.propreneur.uk`) | 2.0.0 | 4.3.3, all TRUE | all TRUE (user pip) | 9/9 host smoke pass | Docker `carina-web` image not yet rebuilt with research tools |

SPSS/PSPP/Jamovi/Python/R statistical analysis for academics. Implementation lives in
`02-backends/core.carinaai.uk/src/tools/research/` and pack
`packages/packs/research-analysis/` (hub `research-analysis@1.1.0`).

## Prompts

| File | Topic |
|------|-------|
| `sprint-6-Research_app_Integration-spss_and_more.md` | Master index |
| `sprint-6-research-01-pspp-cli-pipeline.md` | PSPP CLI |
| `sprint-6-research-02-jamovi-api-integration.md` | Jamovi / jmv |
| `sprint-6-research-03-file-format-support.md` | .sav / .sps / .spv |
| `sprint-6-research-04-analysis-skill-pack.md` | Skill pack + Python stats |
| `sprint-6-research-05-r-pipeline.md` | R + haven |

## Host verify (copy-paste)

**Dev (tsalach):**

```bash
cd /opt/lampp/htdocs/verlox/carina/02-backends/core.carinaai.uk
```

**Production VPS (after deploy to `/home/malike/apps/core.carinaai.uk`):**

```bash
cd /home/malike/apps/core.carinaai.uk
```

Then on either host:

pspp --version
Rscript --version
python3 src/tools/research/stats-analysis.py deps
python3 src/tools/research/sav-io.py deps

pnpm exec vitest run src/tools/research/research-smoke.test.ts
```

R packages (user library, no sudo):

```bash
R_USER_LIB="$HOME/R/$(Rscript -e 'cat(R.version$platform)')-library/$(Rscript -e 'cat(R.version$major, ".", strsplit(R.version$minor, ".", fixed=TRUE)[[1]][1], sep="")')"
mkdir -p "$R_USER_LIB"
Rscript -e "install.packages(c('haven','dplyr','broom','jsonlite','psych'), repos='https://cloud.r-project.org', lib='$R_USER_LIB')"
```
