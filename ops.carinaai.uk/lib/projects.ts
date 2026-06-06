import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import type { PROJECT_STATUSES, PROJECT_TYPES } from './constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '..', 'data', 'projects.json');

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type ProjectType = (typeof PROJECT_TYPES)[number];

export interface VerloxProject {
  id: string;
  name: string;
  client: string;
  status: ProjectStatus;
  type: ProjectType;
  address: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

async function ensureFile(): Promise<void> {
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, '[]', 'utf-8');
  }
}

export async function loadProjects(): Promise<VerloxProject[]> {
  await ensureFile();
  const raw = await fs.readFile(DATA_FILE, 'utf-8');
  return JSON.parse(raw) as VerloxProject[];
}

export async function saveProjects(projects: VerloxProject[]): Promise<void> {
  await ensureFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(projects, null, 2), 'utf-8');
}

export async function addProject(
  input: Omit<VerloxProject, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<VerloxProject> {
  const projects = await loadProjects();
  const now = new Date().toISOString();
  const project: VerloxProject = {
    id: uuidv4(),
    createdAt: now,
    updatedAt: now,
    ...input,
  };
  projects.push(project);
  await saveProjects(projects);
  return project;
}

export async function updateProject(
  id: string,
  patch: Partial<Omit<VerloxProject, 'id' | 'createdAt'>>,
): Promise<VerloxProject | null> {
  const projects = await loadProjects();
  const index = projects.findIndex((p) => p.id === id);
  if (index < 0) return null;
  projects[index] = {
    ...projects[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await saveProjects(projects);
  return projects[index];
}

export async function deleteProject(id: string): Promise<boolean> {
  const projects = await loadProjects();
  const next = projects.filter((p) => p.id !== id);
  if (next.length === projects.length) return false;
  await saveProjects(next);
  return true;
}
