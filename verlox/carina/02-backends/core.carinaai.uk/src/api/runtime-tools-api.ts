import { Router, type Router as ExpressRouter } from 'express';
import { RuntimeToolStore } from '../tools/dynamic/tool-store.js';
import { registerRuntimeTool } from '../tools/dynamic/tool-definition.js';
import { getQualityHistory } from '../mutation/quality-recorder.js';
import { pool } from '../memory/db.js';
import { logSelfModEvent } from '../security/self-mod-logger.js';

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
    registerRuntimeTool({ ...tool, status: 'active' });
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

runtimeToolsRouter.get('/runtime/:id/quality', async (req, res) => {
  try {
    const { id } = req.params;
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const samples = await getQualityHistory(id, limit);
    res.json({ samples });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

runtimeToolsRouter.post('/runtime/:id/reinstate', async (req, res) => {
  try {
    const tools = await store.list({ status: 'disabled' });
    const tool = tools.find((t) => t.id === req.params.id || t.name === req.params.id);
    if (!tool) {
      res.status(404).json({ error: 'No disabled tool found' });
      return;
    }
    await pool.query(
      `UPDATE runtime_tools SET status = 'active', quarantined_at = NULL, quarantine_reason = NULL, quality_score = NULL, updated_at = NOW() WHERE id = $1`,
      [tool.id],
    );
    registerRuntimeTool({ ...tool, status: 'active' });
    void logSelfModEvent('TOOL_MANUALLY_REINSTATED', { tool_name: tool.name });
    res.json({ success: true, message: `Tool "${tool.name}" reinstated. Quality score reset.` });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});
