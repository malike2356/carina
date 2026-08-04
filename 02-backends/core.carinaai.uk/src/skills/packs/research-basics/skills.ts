import type { PackSkillInput } from '../../pack-types.js';

export const researchBasicsSkills: PackSkillInput[] = [
  {
    name: 'arxiv-search',
    description: 'Search arXiv for academic papers by keyword, author, or category',
    trigger: ['arxiv', 'research paper', 'academic paper', 'scientific paper'],
    steps: `1. Build query for export.arxiv.org/api/query.
2. Use http-request (max 1 request per 3 seconds per arXiv policy).
3. Parse Atom feed: title, authors, abstract, link.
4. Present top results with summaries.`,
    toolsUsed: ['http-request'],
  },
  {
    name: 'blog-monitoring',
    description: 'Monitor RSS/Atom feeds for new posts',
    trigger: ['RSS', 'blog feed', 'monitor feed', 'new posts', 'atom feed'],
    steps: `1. Fetch feed URL via http-request.
2. Extract titles, dates, and links from XML.
3. Filter to posts since last check if timestamp available.
4. Summarise new content relevant to user query.`,
    toolsUsed: ['http-request'],
  },
  {
    name: 'comprehensive-investigation',
    description: 'Systematic deep-dive research methodology with sub-question decomposition',
    trigger: ['investigate', 'deep dive', 'research thoroughly', 'comprehensive analysis', 'deep research'],
    steps: `1. Define the question and success criteria with the user.
2. Decompose the query into 3-5 concrete sub-questions that together cover the full scope.
3. For each sub-question: run targeted web-search or http-request. Prefer primary sources (official docs, academic papers, primary news) over aggregators and summaries.
4. Read each source in full; do not rely solely on preview snippets.
5. Enumerate any additional sources: local files via file-read, past session context via session-search, and relevant third-party APIs.
6. Synthesise a structured report organised by sub-question, with inline citations ([Source: <url or title>]) for every factual claim.
7. Close with a "Confidence and gaps" section: note where sources disagreed, where coverage was thin, and any claims that could not be independently verified.`,
    toolsUsed: ['web-search', 'http-request', 'session-search', 'file-read'],
  },
  {
    name: 'interlinked-notes',
    description: 'Build cross-referenced markdown knowledge notes during research',
    trigger: ['research notes', 'knowledge base', 'linked notes', 'wiki notes'],
    steps: `1. Create markdown files in CARINA_RESOURCES_DIR/knowledge/.
2. Use relative links [[topic-name]] between related notes.
3. Add a root index note linking all subtopics.
4. Update existing notes when new information arrives.`,
    toolsUsed: ['file-write', 'file-read'],
  },
  {
    name: 'archive-exploration',
    description: 'Explore document archives within user-defined scope',
    trigger: ['explore archive', 'search files', 'find documents', 'catalogue files'],
    steps: `1. Confirm target path is within user-stated scope or CARINA_RESOURCES_DIR.
2. Use file-read and shell-exec find within boundaries only.
3. Do not follow symlinks outside the search root.
4. Stop and ask before accessing paths outside the workspace.`,
    toolsUsed: ['file-read', 'shell-exec'],
  },
];
