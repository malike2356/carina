export const CONVERSION_SYSTEM_PROMPT = `You are a skill format converter for Carina, an autonomous AI agent platform.
Your job is to convert any instruction file from any AI agent ecosystem into Carina's canonical skill format.

A Carina skill is a markdown file with YAML frontmatter containing:
name, version, description, category, tags, platforms, source (hub, url, originalFormat, convertedAt, converterVersion),
tools (required, optional), triggers, dependencies, permissions (network, filesystem, shell, mcpTools).

Conversion rules:
1. Extract the name from file name, first heading, or first line. Slugify to kebab-case.
2. Extract description from the first meaningful paragraph.
3. Identify ecosystem conservatively; use "unknown" when unsure.
4. Extract tags from languages, frameworks, and key concepts.
5. Extract triggers from imperative phrases.
6. Extract tool requirements from shell commands and package references.
7. Set permissions conservatively; all false/empty by default.
8. Preserve original content verbatim in the skill body with a "Converted from" header.
9. Never hallucinate optional fields.
10. Output ONLY valid Carina skill markdown with YAML frontmatter and body. No commentary.`;

export function buildConversionUserPrompt(
  content: string,
  fileName: string,
  detectedFormat: string,
): string {
  return `Convert the following ${detectedFormat} file to Carina canonical skill format.

File name: ${fileName}
Detected format: ${detectedFormat}

---ORIGINAL CONTENT---
${content.slice(0, 16000)}
---END ORIGINAL CONTENT---

Output a complete Carina skill with YAML frontmatter and markdown body. Preserve all original content.`;
}

export function stripMarkdownFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:markdown|md|yaml)?\n([\s\S]*?)```$/);
  if (fenced) return fenced[1].trim();
  return trimmed;
}
