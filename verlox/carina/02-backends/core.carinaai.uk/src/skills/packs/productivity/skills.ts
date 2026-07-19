import type { PackSkillInput } from '../../pack-types.js';

export const productivitySkills: PackSkillInput[] = [
  {
    name: 'google-workspace',
    description: 'Gmail, Calendar, and Drive via connected product tools',
    trigger: ['gmail', 'google calendar', 'google drive', 'schedule meeting', 'send email', 'boreholes', 'BDAG'],
    steps: `1. Prefer native product tools when Gmail/Drive are connected for this worker.
2. For inbox: use gmail-list (then gmail-get for full body). Never use email-list for Gmail.
3. For Drive docs (BDAG, boreholes, etc.): use google-drive-search, then google-drive-read.
4. Do not call http-request with OAuth tokens. Do not use search-files for Google Drive.
5. Draft emails and calendar events; confirm before sending.`,
    toolsUsed: ['gmail-list', 'gmail-get', 'google-drive-search', 'google-drive-read', 'email-send'],
  },
  {
    name: 'notion-workspace',
    description: 'Query and update Notion pages and databases',
    trigger: ['notion', 'notion page', 'notion database', 'update notion'],
    steps: `1. Ask user for Notion integration token if not configured.
2. Use http-request against api.notion.com/v1/.
3. Query databases with filters; create or update pages.
4. Never ask user to paste tokens in chat; point to CARINA_RESOURCES_DIR/.env.`,
    toolsUsed: ['http-request'],
  },
  {
    name: 'airtable-records',
    description: 'List, create, and update Airtable records',
    trigger: ['airtable', 'airtable record', 'update airtable', 'crm record'],
    steps: `1. Confirm Airtable PAT and base ID are configured.
2. Use http-request against api.airtable.com/v0/.
3. List, filter, create, or patch records.
4. Present results as a clear table summary.`,
    toolsUsed: ['http-request'],
  },
  {
    name: 'ocr-and-documents',
    description: 'Extract text from tenancy agreements, certificates, and scans',
    trigger: ['ocr', 'scan document', 'read pdf', 'extract text', 'certificate', 'tenancy agreement'],
    steps: `1. Locate the document via file-read or user resources directory.
2. For images, describe content and extract visible text.
3. For PDFs, use shell-exec with pdftotext if available.
4. Structure extracted fields: dates, parties, obligations, expiry.`,
    toolsUsed: ['file-read', 'shell-exec'],
  },
  {
    name: 'uk-postcode-lookup',
    description: 'Resolve UK postcodes and local authority areas',
    trigger: ['postcode', 'local authority', 'geocode', 'what council', 'address lookup'],
    steps: `1. Use http-request against api.postcodes.io/postcodes/{postcode}.
2. Return parish, district, county, and coordinates.
3. For full addresses, use web-search as fallback.`,
    toolsUsed: ['http-request', 'web-search'],
  },
  {
    name: 'obsidian-notes',
    description: 'Create and link markdown notes in an Obsidian vault',
    trigger: ['obsidian', 'vault note', 'markdown note', 'linked notes'],
    steps: `1. Confirm vault path (default: CARINA_RESOURCES_DIR/knowledge).
2. Create markdown files with wikilinks [[note-name]].
3. Use file-write; respect existing folder structure.
4. Return paths of created or updated notes.`,
    toolsUsed: ['file-read', 'file-write'],
  },
  {
    name: 'weather-briefing',
    description: 'Current weather and short forecast via Open-Meteo',
    trigger: ['weather', 'forecast', 'rain today', 'temperature'],
    steps: `1. Resolve location from user message or configured default.
2. Use http-request against api.open-meteo.com (no API key needed).
3. Present current conditions and next 24-48h summary.`,
    toolsUsed: ['http-request'],
  },
  {
    name: 'news-digest',
    description: 'Summarise RSS feeds and news sources',
    trigger: ['news', 'RSS', 'headlines', 'news digest', 'what happened'],
    steps: `1. Fetch RSS/Atom feed via http-request.
2. Parse titles, dates, and links.
3. Summarise top stories relevant to the user's query.
4. Respect rate limits; cache recent fetches.`,
    toolsUsed: ['http-request', 'web-search'],
  },
];
