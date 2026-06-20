import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));

export const skills = JSON.parse(fs.readFileSync(path.join(dir, 'skills.json'), 'utf8'));
export const systemSuffix = fs.readFileSync(path.join(dir, 'prompts/system.txt'), 'utf8').trim();
