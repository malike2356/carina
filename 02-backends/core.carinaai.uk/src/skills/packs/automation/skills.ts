import type { PackSkillInput } from '../../pack-types.js';

export const automationSkills: PackSkillInput[] = [
  {
    name: 'n8n-workflow-designer',
    description: 'Turn a natural-language automation request into a production-ready n8n workflow JSON that can be imported directly',
    trigger: ['n8n workflow', 'n8n automation', 'workflow json', 'automate with n8n', 'n8n import', 'workflow designer'],
    steps: `1. Ask 1-3 clarifying questions about the automation if the request is ambiguous: trigger type, services involved, error-handling preferences, and which n8n connections (credentials) the user has configured.
2. Map the request to concrete n8n node types. Only reference node types that are standard in n8n or that the user confirms exist in their instance. Never invent node types.
3. Draft a complete n8n workflow JSON (version 2 format) with correct nodes, connections, settings, and empty pinData. Set sensible defaults for retry, timeout, and error workflows. Auto-lay out node positions (x increments of 250, y increments of 160 per branch).
4. Validate internally before presenting: no duplicate node names, all connection source/target IDs match existing nodes, trigger node present, no orphan nodes.
5. Present a plain-language summary of the workflow (nodes to edges), then the full JSON in a code block.
6. Use credential ID placeholders and tell the user to map them. Never fabricate API keys or secrets.
7. If the user asks for a service with no matching n8n node, say so and suggest an HTTP Request node fallback or community node alternatives.
8. On modification requests for an existing workflow the user pastes, preserve all node IDs and positions unless explicitly asked to reorganize.`,
    toolsUsed: ['file-write', 'http-request'],
  },
  {
    name: 'knowledge-vault-rag',
    description: 'Answer questions by searching and synthesizing a local notes vault or document directory, citing every source',
    trigger: ['search my notes', 'check my vault', 'knowledge base query', 'find in notes', 'vault search', 'obsidian', 'note search'],
    steps: `1. Identify the vault or notes directory path from the user or from CARINA_RESOURCES_DIR.
2. Analyze the query for key concepts, entities, and likely filenames or tags.
3. Search the vault using file-read and shell-exec find. Issue multiple searches with varied keywords if the first pass returns few results.
4. For each candidate file, read full content and locate the paragraphs or lines that address the query.
5. Synthesize a clear, structured answer. For every factual claim, cite the exact filename and the relevant heading or line excerpt using the format: [filename > heading or line excerpt].
6. If the vault contains conflicting information across files, surface the conflict and cite both sides.
7. If no relevant information is found, say so plainly. Do NOT fabricate an answer. Suggest what the user might add or how to rephrase the query.
8. Never present outside knowledge as vault content. Label any general knowledge clearly as "outside the vault" and only if the user asks.
9. Respect file structure: use filenames, headings, and tags as relevance signals.`,
    toolsUsed: ['file-read', 'shell-exec', 'file-write'],
  },
];
