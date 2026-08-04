import { Router } from 'express';
import {
  addProject,
  deleteProject,
  ensureSeedProjects,
  updateProject,
  type ProjectStatus,
  type ProjectType,
} from '../lib/projects.js';
import { PROJECT_STATUSES, PROJECT_TYPES } from '../lib/constants.js';

export const projectsRouter = Router();

projectsRouter.get('/', async (_req, res) => {
  const projects = await ensureSeedProjects();
  const grouped: Record<ProjectStatus, typeof projects> = {
    active: [],
    paused: [],
    complete: [],
  };
  for (const p of projects) {
    grouped[p.status].push(p);
  }
  for (const status of PROJECT_STATUSES) {
    grouped[status].sort((a, b) =>
      (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt),
    );
  }
  res.render('projects', {
    grouped,
    types: PROJECT_TYPES,
    statuses: PROJECT_STATUSES,
  });
});

projectsRouter.post('/', async (req, res) => {
  const status = String(req.body.status ?? 'active') as ProjectStatus;
  const type = String(req.body.type ?? 'Other') as ProjectType;
  await addProject({
    name: String(req.body.name ?? '').trim() || 'Untitled',
    client: String(req.body.client ?? '').trim(),
    status: PROJECT_STATUSES.includes(status) ? status : 'active',
    type: PROJECT_TYPES.includes(type) ? type : 'Other',
    address: String(req.body.address ?? '').trim(),
    notes: String(req.body.notes ?? '').trim(),
  });
  res.redirect('/projects');
});

projectsRouter.post('/:id', async (req, res) => {
  const status = String(req.body.status ?? '') as ProjectStatus;
  const type = String(req.body.type ?? '') as ProjectType;
  const patch: Parameters<typeof updateProject>[1] = {};
  if (req.body.name) patch.name = String(req.body.name).trim();
  if (req.body.client !== undefined) patch.client = String(req.body.client).trim();
  if (PROJECT_STATUSES.includes(status)) patch.status = status;
  if (PROJECT_TYPES.includes(type)) patch.type = type;
  if (req.body.address !== undefined) patch.address = String(req.body.address).trim();
  if (req.body.notes !== undefined) patch.notes = String(req.body.notes).trim();
  await updateProject(req.params.id, patch);
  const wantsJson = req.get('accept')?.includes('application/json');
  if (wantsJson) {
    res.json({ ok: true });
    return;
  }
  res.redirect('/projects');
});

projectsRouter.post('/:id/delete', async (req, res) => {
  await deleteProject(req.params.id);
  res.redirect('/projects');
});
