import { Router, type Router as ExpressRouter } from 'express';
import { RuntimeToolStore } from '../tools/dynamic/tool-store.js';
import { createRuntimeToolDefinition } from '../tools/dynamic/tool-definition.js';
import { registry } from '../tools/registry.js';

export const runtimeToolsRouter: ExpressRouter = Router();

const store = new RuntimeToolStore();

runtimeToolsRouter.get('/runtime', async (_req, res) => {
  try {
    const tools = await store.list();
    const stats = await store.stats();
    res.json({ tools, stats });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

runtimeToolsRouter.get('/runtime/:id', async (req, res) => {
  try {
    const tools = await store.list();
    const tool = tools.find((t) => t.id === req.params.id || t.name === req.params.id);
    if (!tool) {
      res.status(404).json({ error: 'Tool not found' });
      return;
    }
    res.json(tool);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

runtimeToolsRouter.post('/runtime/:id/approve', async (req, res) => {
  try {
    const tools = await store.list({ status: 'pending' });
    const tool = tools.find((t) => t.id === req.params.id || t.name === req.params.id);
    if (!tool) {
      res.status(404).json({ error: 'No pending tool found with that id/name' });
      return;
    }
    await store.approve(tool.id, 'ops-dashboard');
    const toolDef = createRuntimeToolDefinition({ ...tool, status: 'active' });
    registry.register(toolDef);
    res.json({ success: true, message: `Tool "${tool.name}" approved and activated.` });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

runtimeToolsRouter.post('/runtime/:id/disable', async (req, res) => {
  try {
    const tools = await store.list();
    const tool = tools.find((t) => t.id === req.params.id || t.name === req.params.id);
    if (!tool) {
      res.status(404).json({ error: 'Tool not found' });
      return;
    }
    await store.disable(tool.id);
    res.json({ success: true, message: `Tool "${tool.name}" disabled.` });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

runtimeToolsRouter.get('/runtime/stats', async (_req, res) => {
  try {
    const stats = await store.stats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});
