import express, { type Router as ExpressRouter } from 'express';
import { consumeDeliveryToken } from '../document-vault/channel/export-delivery.js';
import { getOrCreateLocalVaultService } from '../document-vault/runtime.js';

export const documentVaultDeliveryRouter: ExpressRouter = express.Router();

documentVaultDeliveryRouter.get('/delivery/:token', async (req, res) => {
  try {
    const token = String(req.params.token || '').trim();
    if (!token) {
      res.status(400).json({ error: 'token required' });
      return;
    }
    const svc = getOrCreateLocalVaultService();
    const claim = consumeDeliveryToken(token, { service: svc });
    const item = svc.getItem(claim.workspaceId, claim.itemId);
    const bytes = await svc.readContent(claim.workspaceId, claim.itemId);
    const filename = item.name.replace(/[^\w.\-]+/g, '_') || 'download.bin';
    res.setHeader('Content-Type', item.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(bytes);
  } catch (err) {
    res.status(403).json({
      error: err instanceof Error ? err.message : 'delivery forbidden',
    });
  }
});
