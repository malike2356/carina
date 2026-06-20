import path from 'path';
import type { FormatDefinition } from './registry-schema.js';

export const BUNDLED_FORMAT_DEFINITIONS: FormatDefinition[] = [
  {
    id: 'cursor-rules',
    name: 'Cursor Rules',
    version: '1.0.0',
    description: 'Cursor IDE .cursorrules and .cursor/rules/*.mdc instruction files',
    ecosystem: 'cursor',
    detection: {
      fileNames: ['.cursorrules', '.mdc'],
      filePaths: ['.cursor/rules/'],
      contentPatterns: ['^You are an expert', 'description:\\s*".+"', 'globs:\\s*\\['],
    },
    mapping: { category: { source: 'static', value: 'imported-cursor' } },
    permissions: { defaults: { network: false, filesystem: [], shell: false } },
  },
  {
    id: 'claude-md',
    name: 'Claude Code CLAUDE.md',
    version: '1.0.0',
    description: 'Claude Code project instruction files',
    ecosystem: 'claude-code',
    detection: {
      fileNames: ['CLAUDE.md', 'claude.md'],
      contentPatterns: ['^# CLAUDE\\.MD', 'CLAUDE\\.MD', 'When asked to.*always'],
    },
    mapping: { category: { source: 'static', value: 'imported-claude-code' } },
    permissions: { defaults: { network: false, filesystem: [], shell: false } },
  },
  {
    id: 'windsurf-rules',
    name: 'Windsurf Rules',
    version: '1.0.0',
    description: 'Windsurf .windsurfrules files',
    ecosystem: 'windsurf',
    detection: {
      fileNames: ['.windsurfrules'],
      contentPatterns: ['\\.windsurfrules', 'Windsurf Rules'],
    },
    mapping: { category: { source: 'static', value: 'imported-windsurf' } },
    permissions: { defaults: { network: false, filesystem: [], shell: false } },
  },
  {
    id: 'copilot-instructions',
    name: 'GitHub Copilot Instructions',
    version: '1.0.0',
    description: 'GitHub Copilot custom instructions',
    ecosystem: 'copilot',
    detection: {
      fileNames: ['copilot-instructions.md'],
      filePaths: ['.github/'],
      contentPatterns: ['GitHub Copilot Instructions', 'copilot-instructions:'],
    },
    mapping: { category: { source: 'static', value: 'imported-copilot' } },
    permissions: { defaults: { network: false, filesystem: [], shell: false } },
  },
  {
    id: 'cline-rules',
    name: 'Cline Rules',
    version: '1.0.0',
    description: 'Cline .clinerules files',
    ecosystem: 'cline',
    detection: {
      fileNames: ['.clinerules'],
      contentPatterns: ['\\.clinerules', 'Cline Rules'],
    },
    mapping: { category: { source: 'static', value: 'imported-cline' } },
    permissions: { defaults: { network: false, filesystem: [], shell: false } },
  },
  {
    id: 'aider-conventions',
    name: 'Aider Conventions',
    version: '1.0.0',
    description: 'Aider configuration and conventions',
    ecosystem: 'aider',
    detection: {
      fileNames: ['.aider.conf.yml', 'CONVENTIONS.md'],
      contentPatterns: ['# Aider Conventions', '\\.aider\\.conf'],
    },
    mapping: { category: { source: 'static', value: 'imported-aider' } },
    permissions: { defaults: { network: false, filesystem: [], shell: false } },
  },
  {
    id: 'continue-config',
    name: 'Continue.dev Config',
    version: '1.0.0',
    description: 'Continue.dev config.json',
    ecosystem: 'continue',
    detection: {
      fileNames: ['config.json'],
      contentPatterns: ['"slashCommands"', '"tabAutocompleteModel"'],
    },
    mapping: { category: { source: 'static', value: 'imported-continue' } },
    permissions: { defaults: { network: false, filesystem: [], shell: false } },
  },
  {
    id: 'crewai-agent',
    name: 'CrewAI Agent',
    version: '1.0.0',
    description: 'CrewAI agents.yaml definitions',
    ecosystem: 'crewai',
    detection: {
      fileNames: ['agents.yaml', 'agents.yml'],
      contentPatterns: ['role:\\s*"', 'goal:\\s*"', 'backstory:\\s*"'],
    },
    mapping: { category: { source: 'static', value: 'imported-crewai' } },
    permissions: { defaults: { network: false, filesystem: [], shell: false } },
  },
  {
    id: 'langchain-config',
    name: 'LangChain Config',
    version: '1.0.0',
    description: 'LangChain chain and runnable configs',
    ecosystem: 'langchain',
    detection: {
      contentPatterns: ['from langchain', 'llm:\\s*(ChatOpenAI|ChatAnthropic)'],
    },
    mapping: { category: { source: 'static', value: 'imported-langchain' } },
    permissions: { defaults: { network: false, filesystem: [], shell: false } },
  },
  {
    id: 'autogpt-agent',
    name: 'AutoGPT Agent',
    version: '1.0.0',
    description: 'AutoGPT ai_settings.yaml',
    ecosystem: 'autogpt',
    detection: {
      fileNames: ['ai_settings.yaml'],
      contentPatterns: ['ai_name:\\s*["\']', 'ai_goals:\\s*\\['],
    },
    mapping: { category: { source: 'static', value: 'imported-autogpt' } },
    permissions: { defaults: { network: false, filesystem: [], shell: false } },
  },
  {
    id: 'devin-task',
    name: 'Devin Task',
    version: '1.0.0',
    description: 'Devin task YAML configs',
    ecosystem: 'devin',
    detection: {
      fileNames: ['devin.yaml', 'devin.yml'],
      contentPatterns: ['devin\\.yaml', 'tasks:\\s*\\n\\s*-'],
    },
    mapping: { category: { source: 'static', value: 'imported-devin' } },
    permissions: { defaults: { network: false, filesystem: [], shell: false } },
  },
  {
    id: 'generic-skill-md',
    name: 'Generic Skill MD',
    version: '1.0.0',
    description: 'YAML frontmatter plus markdown skill files',
    ecosystem: 'generic',
    detection: {
      fileNames: ['SKILL.md', 'skill.md'],
      contentPatterns: ['^---\\s*\\nname:\\s*', '^---\\s*\\ndescription:'],
    },
    mapping: { category: { source: 'static', value: 'imported-generic' } },
    permissions: { defaults: { network: false, filesystem: [], shell: false } },
  },
  {
    id: 'plain-instructions',
    name: 'Plain Instructions',
    version: '1.0.0',
    description: 'Plain markdown instruction files',
    ecosystem: 'unknown',
    detection: {
      contentPatterns: ['^#+\\s', '^\\*\\*[^*]+\\*\\*'],
    },
    mapping: { category: { source: 'static', value: 'imported-unknown' } },
    permissions: { defaults: { network: false, filesystem: [], shell: false } },
  },
  {
    id: 'mcp-server',
    name: 'MCP Server Config',
    version: '1.0.0',
    description: 'Model Context Protocol server configuration',
    ecosystem: 'mcp',
    detection: {
      contentPatterns: ['"mcpServers"\\s*:', '"transport"\\s*:\\s*"(stdio|sse|http)"'],
    },
    mapping: { category: { source: 'static', value: 'mcp-native' } },
    permissions: { defaults: { network: false, filesystem: [], shell: false } },
  },
];

export const DEFAULT_REGISTRY_URL =
  process.env.CARINA_FORMAT_REGISTRY_URL
  ?? 'https://raw.githubusercontent.com/carinaai/format-registry/main/formats';

export function formatDefinitionPath(id: string): string {
  return path.posix.join(DEFAULT_REGISTRY_URL, `${id}.json`);
}
