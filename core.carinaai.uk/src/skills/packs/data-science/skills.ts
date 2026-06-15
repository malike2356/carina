import type { PackSkillInput } from '../../pack-types.js';

export const dataScienceSkills: PackSkillInput[] = [
  {
    name: 'pandas-analysis',
    description: 'Load CSV/Parquet and run pandas analysis',
    trigger: ['pandas', 'dataframe', 'csv analysis', 'data analysis'],
    steps: '1. Use file-read or shell-exec to locate dataset.\n2. Use code-exec with pandas.\n3. Summarize shape, dtypes, nulls, and key stats.\n4. Return findings as a table.',
    toolsUsed: ['code-exec', 'file-read', 'shell-exec'],
  },
  {
    name: 'matplotlib-charts',
    description: 'Generate matplotlib/seaborn charts from data',
    trigger: ['matplotlib', 'seaborn', 'plot chart', 'visualize data'],
    steps: '1. Load data via code-exec.\n2. Create chart and save to /tmp or user resources.\n3. Use vision-analyze if user needs interpretation.',
    toolsUsed: ['code-exec', 'vision-analyze'],
  },
  {
    name: 'jupyter-notebook',
    description: 'Create or update Jupyter notebooks for exploratory analysis',
    trigger: ['jupyter', 'notebook', 'ipynb', 'exploratory analysis'],
    steps: '1. Use file-write to create .ipynb JSON structure.\n2. Add markdown and code cells.\n3. Optionally run via shell-exec with jupyter execute.',
    toolsUsed: ['file-write', 'file-read', 'shell-exec'],
  },
  {
    name: 'sql-analytics',
    description: 'Run SQL queries against Postgres or SQLite datasets',
    trigger: ['sql query', 'postgres query', 'analytics sql', 'aggregate data'],
    steps: '1. Confirm connection string or local DB path.\n2. Use shell-exec with psql/sqlite3 or code-exec.\n3. Present results clearly.',
    toolsUsed: ['shell-exec', 'code-exec'],
  },
  {
    name: 'feature-engineering',
    description: 'Build features from raw tabular data',
    trigger: ['feature engineering', 'encode categorical', 'normalize features'],
    steps: '1. Profile dataset.\n2. Propose transforms.\n3. Implement in code-exec.\n4. Validate output schema.',
    toolsUsed: ['code-exec'],
  },
  {
    name: 'stats-hypothesis',
    description: 'Run statistical tests and interpret p-values',
    trigger: ['hypothesis test', 't-test', 'chi square', 'p-value', 'statistics'],
    steps: '1. State null/alternative hypotheses.\n2. Run scipy/statsmodels via code-exec.\n3. Report test statistic, p-value, and plain-language conclusion.',
    toolsUsed: ['code-exec'],
  },
  {
    name: 'data-cleaning',
    description: 'Clean messy CSVs: dedupe, impute, normalize',
    trigger: ['clean data', 'dedupe', 'impute missing', 'normalize columns'],
    steps: '1. Inspect sample rows.\n2. Apply cleaning pipeline in code-exec.\n3. Write cleaned output with file-write.',
    toolsUsed: ['code-exec', 'file-read', 'file-write'],
  },
  {
    name: 'geospatial-basics',
    description: 'Basic geospatial analysis with geopandas',
    trigger: ['geospatial', 'geopandas', 'map data', 'geojson'],
    steps: '1. Load GeoJSON/Shapefile.\n2. Reproject and compute aggregates.\n3. Export summary stats.',
    toolsUsed: ['code-exec', 'file-read'],
  },
];
