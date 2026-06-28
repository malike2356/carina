import fs from 'fs/promises';
import path from 'path';
import { parseKnowledgeMarkdownMeta } from './brain-knowledge-meta.js';
import { writeGeneratedBrainSkills } from './brain-knowledge-skills.js';

const MANIFEST_NAME = '.brain-skill-manifest.json';

async function walkMarkdownFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '.generated-skills' || entry.name.startsWith('.')) continue;
      files.push(...await walkMarkdownFiles(full));
    } else if (entry.name.endsWith('.md')) {
      files.push(full);
    }
  }
  return files;
}

export async function writeBrainSkillManifest(knowledgeDir: string): Promise<number> {
  const files = await walkMarkdownFiles(knowledgeDir);
  const entries = [];

  for (const file of files) {
    const content = await fs.readFile(file, 'utf-8');
    const filename = path.basename(file);
    entries.push(parseKnowledgeMarkdownMeta(content, filename));
  }

  entries.sort((a, b) => a.sourceFile.localeCompare(b.sourceFile));
  const manifestPath = path.join(knowledgeDir, MANIFEST_NAME);
  await fs.writeFile(manifestPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), entries }, null, 2)}\n`);

  const skillCount = await writeGeneratedBrainSkills(knowledgeDir);
  console.log(`Generated ${skillCount} brain knowledge SKILL.md files in ${path.join(knowledgeDir, '.generated-skills')}`);

  return entries.length;
}

const knowledgeDir = process.argv[2];
if (knowledgeDir) {
  writeBrainSkillManifest(knowledgeDir)
    .then((count) => {
      console.log(`Wrote ${MANIFEST_NAME} (${count} entries) -> ${path.join(knowledgeDir, MANIFEST_NAME)}`);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
