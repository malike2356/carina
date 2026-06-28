import type { PackSkillInput } from '#core/skills/pack-types.js';

export const researchAnalysisSkills: PackSkillInput[] = [
  {
    name: 'research-data-explore',
    description: 'Explore SPSS datasets with variable metadata, descriptives, and normality checks',
    trigger: [
      'describe my data',
      'variable list',
      'summary statistics',
      'explore dataset',
      'normality test',
      '.sav file',
      'spss data',
    ],
    steps: `1. Use sav_read on the user's .sav file (metadataOnly first if the file is large).
2. Present variable names, labels, value labels, missing counts, and measure levels.
3. Confirm which variables the user wants to analyse.
4. Run stats_describe for numeric summaries.
5. Run stats_normality when inferential tests are planned.
6. Flag missing data counts and suggest listwise vs pairwise handling.`,
    toolsUsed: ['sav_read', 'stats_describe', 'stats_normality', 'file-read'],
  },
  {
    name: 'research-group-comparison',
    description: 'Compare groups with t-tests, ANOVA, and Tukey post-hoc tests',
    trigger: [
      'compare groups',
      't-test',
      'anova',
      'group difference',
      'post-hoc',
      'tukey',
      'independent samples',
    ],
    steps: `1. Confirm the grouping variable and dependent variable(s) from sav_read output.
2. Check stats_normality and note assumption violations.
3. Use stats_compare_groups with analysisType ttest for two groups or anova for 3+ groups.
4. Report test statistic, df, p-value, and effect size (Cohen's d or eta-squared).
5. If ANOVA is significant, run stats_posthoc for pairwise comparisons.
6. If assumptions fail, suggest non-parametric alternatives or pspp_analyze/jamovi_analyze.`,
    toolsUsed: ['stats_compare_groups', 'stats_posthoc', 'stats_normality', 'pspp_analyze'],
  },
  {
    name: 'research-relationships',
    description: 'Correlation, regression, and chi-square analysis for academic research',
    trigger: [
      'correlation',
      'regression',
      'predict',
      'chi-square',
      'association',
      'relationship between',
      'linear regression',
    ],
    steps: `1. Confirm variable types and analysis goal (association vs prediction).
2. For numeric pairs: stats_correlation (pearson or spearman).
3. For prediction: stats_regression with dependentVar and independent variables.
4. For categorical association: stats_chi_square with exactly two variables.
5. Report effect sizes and APA-formatted tables via apa_format when needed.
6. Note excluded cases due to missing data.`,
    toolsUsed: [
      'stats_correlation',
      'stats_regression',
      'stats_chi_square',
      'apa_format',
    ],
  },
  {
    name: 'research-spss-workflow',
    description: 'SPSS/PSPP syntax generation and execution for supervisor-compatible output',
    trigger: [
      'spss syntax',
      'pspp',
      '.sps file',
      'spss output',
      'supervisor wants spss',
      'run in spss',
    ],
    steps: `1. Confirm analysis type, variables, and data file path.
2. Use spss_syntax_generate to create a .sps file the user can run in SPSS.
3. If PSPP is installed, run pspp_analyze for automated execution and APA output.
4. Parse SPSS viewer output with spv_read when the user provides .spv files.
5. Fall back to Python stats tools if PSPP is unavailable.`,
    toolsUsed: ['spss_syntax_generate', 'pspp_analyze', 'spv_read', 'sav_read'],
  },
  {
    name: 'research-jamovi-analysis',
    description: 'Run Jamovi/jmv statistical analyses with structured APA output',
    trigger: [
      'jamovi',
      'jmv',
      'run in jamovi',
      'jamovi analysis',
    ],
    steps: `1. Confirm the data file path and analysis type supported by jamovi_analyze.
2. List variables and grouping/dependent variables with the user.
3. Run jamovi_analyze and present APA markdown results.
4. If jmv is unavailable, fall back to stats_describe or pspp_analyze.
5. Mention when a local Jamovi session is open for dataset sync via jmvconnect.`,
    toolsUsed: ['jamovi_analyze', 'sav_read', 'stats_describe'],
  },
];
