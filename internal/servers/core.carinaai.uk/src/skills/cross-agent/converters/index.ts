import type { Converter } from '../types.js';
import {
  buildImportedSkill,
  extractFirstHeading,
  extractFirstParagraph,
  extractTags,
  extractToolRequirements,
  extractTriggers,
  nameFromFileName,
  parseSimpleFrontmatter,
} from '../utils.js';

function markdownRulesConverter(
  hub: string,
  originalFormat: string,
  category: string,
): Converter {
  return (content, metadata) => {
    const { meta, body } = parseSimpleFrontmatter(content);
    const heading = extractFirstHeading(body) ?? extractFirstHeading(content);
    const name = meta.name ?? heading ?? nameFromFileName(metadata.fileName);
    const description = meta.description ?? extractFirstParagraph(body || content);
    const preserved = body || content;
    return buildImportedSkill({
      name,
      description,
      category,
      hub,
      originalFormat,
      sourceUrl: metadata.sourceUrl,
      converterVersion: '1.0.0',
      tags: extractTags(content),
      triggers: extractTriggers(content),
      toolsRequired: extractToolRequirements(content),
      content: `# ${name}\n\n${description}\n\n---\n\n${preserved}`,
    });
  };
}

export const cursorRulesConverter = markdownRulesConverter('cursor', 'cursor-rules', 'imported-cursor');
export const windsurfRulesConverter = markdownRulesConverter('windsurf', 'windsurf-rules', 'imported-windsurf');
export const clineRulesConverter = markdownRulesConverter('cline', 'cline-rules', 'imported-cline');
export const copilotInstructionsConverter = markdownRulesConverter(
  'copilot',
  'copilot-instructions',
  'imported-copilot',
);
export const supermavenRulesConverter = markdownRulesConverter('supermaven', 'supermaven-rules', 'imported-supermaven');

export const claudeMdConverter: Converter = (content, metadata) => {
  const heading = extractFirstHeading(content) ?? nameFromFileName(metadata.fileName);
  const roleMatch = content.match(/## Role\s*\n([\s\S]*?)(?=\n## |\n---|\Z)/i);
  const rulesMatch = content.match(/## Rules\s*\n([\s\S]*?)(?=\n## |\n---|\Z)/i);
  const description = roleMatch?.[1]?.trim().split('\n')[0]
    ?? extractFirstParagraph(content)
    ?? `Imported from Claude Code: ${heading}`;
  return buildImportedSkill({
    name: heading,
    description,
    category: 'imported-claude-code',
    hub: 'claude-code',
    originalFormat: 'claude-md',
    sourceUrl: metadata.sourceUrl,
    converterVersion: '1.0.0',
    tags: extractTags(content),
    triggers: rulesMatch ? extractTriggers(rulesMatch[1]) : extractTriggers(content),
    toolsRequired: extractToolRequirements(content),
    content: `# ${heading}\n\n${description}\n\n---\n\n${content}`,
  });
};

export const genericSkillMdConverter: Converter = (content, metadata) => {
  const { meta, body } = parseSimpleFrontmatter(content);
  const name = meta.name ?? nameFromFileName(metadata.fileName);
  const hub = meta.source ?? meta.hub ?? 'generic';
  return buildImportedSkill({
    name,
    description: meta.description ?? extractFirstParagraph(body),
    category: meta.category ?? `imported-${hub}`,
    hub,
    originalFormat: 'generic-skill-md',
    sourceUrl: metadata.sourceUrl,
    converterVersion: '1.0.0',
    tags: meta.tags ? meta.tags.split(',').map((t) => t.trim()) : extractTags(body),
    triggers: meta.triggers ? meta.triggers.split(',').map((t) => t.trim()) : extractTriggers(body),
    toolsRequired: meta.tools ? meta.tools.split(',').map((t) => t.trim()) : extractToolRequirements(body),
    content: body || content,
  });
};

export const plainInstructionsConverter: Converter = (content, metadata) => {
  const heading = extractFirstHeading(content) ?? nameFromFileName(metadata.fileName);
  const description = extractFirstParagraph(content) || `Imported instructions: ${heading}`;
  return buildImportedSkill({
    name: heading,
    description,
    category: 'imported-unknown',
    hub: 'unknown',
    originalFormat: 'plain-instructions',
    sourceUrl: metadata.sourceUrl,
    converterVersion: '1.0.0',
    tags: extractTags(content),
    triggers: extractTriggers(content),
    content: `# ${heading}\n\n${content}`,
  });
};

function yamlLikeConverter(
  hub: string,
  originalFormat: string,
  category: string,
  nameKeys: string[],
  descKeys: string[],
): Converter {
  return (content, metadata) => {
    const nameLine = nameKeys.map((k) => content.match(new RegExp(`${k}:\\s*["']?([^"'\\n]+)`))?.[1]).find(Boolean);
    const descParts = descKeys
      .map((k) => content.match(new RegExp(`${k}:\\s*["']?([^"'\\n]+)`))?.[1])
      .filter(Boolean);
    const name = nameLine ?? nameFromFileName(metadata.fileName);
    const description = descParts.join('. ') || extractFirstParagraph(content);
    return buildImportedSkill({
      name,
      description,
      category,
      hub,
      originalFormat,
      sourceUrl: metadata.sourceUrl,
      converterVersion: '1.0.0',
      tags: extractTags(content),
      triggers: extractTriggers(content),
      toolsRequired: extractToolRequirements(content),
      content: `# ${name}\n\n${description}\n\n---\n\n\`\`\`yaml\n${content}\n\`\`\``,
    });
  };
}

export const aiderConventionsConverter = yamlLikeConverter(
  'aider',
  'aider-conventions',
  'imported-aider',
  ['name'],
  ['description', 'test-cmd', 'lint-cmd'],
);

export const crewaiAgentConverter = yamlLikeConverter(
  'crewai',
  'crewai-agent',
  'imported-crewai',
  ['role'],
  ['goal', 'backstory'],
);

export const autogptAgentConverter = yamlLikeConverter(
  'autogpt',
  'autogpt-agent',
  'imported-autogpt',
  ['ai_name'],
  ['ai_role'],
);

export const devinTaskConverter = yamlLikeConverter(
  'devin',
  'devin-task',
  'imported-devin',
  ['name'],
  ['description'],
);

export const continueConfigConverter: Converter = (content, metadata) => {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(content) as Record<string, unknown>;
  } catch {
    // keep empty
  }
  const slash = Array.isArray(parsed.slashCommands)
    ? (parsed.slashCommands as Array<{ name?: string }>).map((c) => c.name).filter(Boolean) as string[]
    : [];
  const name = nameFromFileName(metadata.fileName);
  return buildImportedSkill({
    name,
    description: 'Imported Continue.dev configuration',
    category: 'imported-continue',
    hub: 'continue',
    originalFormat: 'continue-config',
    sourceUrl: metadata.sourceUrl,
    converterVersion: '1.0.0',
    tags: ['continue', 'config'],
    triggers: slash,
    content: `# Continue.dev Config\n\n\`\`\`json\n${content}\n\`\`\``,
  });
};

export const langchainConfigConverter: Converter = (content, metadata) => {
  const name = nameFromFileName(metadata.fileName);
  return buildImportedSkill({
    name,
    description: extractFirstParagraph(content) || 'Imported LangChain configuration',
    category: 'imported-langchain',
    hub: 'langchain',
    originalFormat: 'langchain-config',
    sourceUrl: metadata.sourceUrl,
    converterVersion: '1.0.0',
    tags: extractTags(content),
    toolsRequired: extractToolRequirements(content),
    content: `# LangChain Config\n\n\`\`\`\n${content}\n\`\`\``,
  });
};

export const jsonConfigConverter = (hub: string, originalFormat: string, category: string): Converter => {
  return (content, metadata) => {
    const name = nameFromFileName(metadata.fileName);
    return buildImportedSkill({
      name,
      description: `Imported ${hub} configuration`,
      category,
      hub,
      originalFormat,
      sourceUrl: metadata.sourceUrl,
      converterVersion: '1.0.0',
      tags: [hub, 'config'],
      content: `# ${name}\n\n\`\`\`json\n${content}\n\`\`\``,
    });
  };
};

export const replitConfigConverter = jsonConfigConverter('replit', 'replit-config', 'imported-replit');
export const codyConfigConverter = jsonConfigConverter('cody', 'cody-config', 'imported-cody');
export const tabnineConfigConverter = jsonConfigConverter('tabnine', 'tabnine-config', 'imported-tabnine');
export const amazonqConfigConverter = jsonConfigConverter('amazonq', 'amazonq-config', 'imported-amazonq');
export const piecesSnippetsConverter = plainInstructionsConverter;
export const taskadeAgentConverter = yamlLikeConverter(
  'taskade',
  'taskade-agent',
  'imported-taskade',
  ['name'],
  ['description', 'goal'],
);
