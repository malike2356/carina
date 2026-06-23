import { Router, type NextFunction, type Request, type Response, type Router as ExpressRouter } from 'express';
import { isControlAuthorized } from '../infrastructure/control-auth.js';
import { suggestDocumentEdit } from './documents-assist.js';
import {
  createDocument,
  deleteDocument,
  getDocument,
  listDocuments,
  updateDocument,
  type DocumentFormat,
} from './documents-store.js';

export const documentsApiRouter: ExpressRouter = Router();

type DocumentsRequest = Request & { tenantId?: string };

function resolveTenantId(req: DocumentsRequest): string {
  if (req.session?.hostedAccountId) return req.session.hostedAccountId;
  return '__operator__';
}

function documentsAuth(req: DocumentsRequest, res: Response, next: NextFunction): void {
  if (isControlAuthorized(req)) {
    req.tenantId = resolveTenantId(req);
    next();
    return;
  }
  if (req.session?.webAuthed) {
    req.tenantId = '__operator__';
    next();
    return;
  }
  if (req.session?.hostedAccountId) {
    req.tenantId = req.session.hostedAccountId;
    next();
    return;
  }
  res.status(401).json({ error: 'Unauthorized' });
}

documentsApiRouter.use(documentsAuth);

documentsApiRouter.get('/', (req: DocumentsRequest, res: Response) => {
  const tenantId = req.tenantId ?? '__operator__';
  res.json({ documents: listDocuments(tenantId) });
});

documentsApiRouter.post('/', (req: DocumentsRequest, res: Response) => {
  const tenantId = req.tenantId ?? '__operator__';
  const title = String(req.body?.title ?? 'Untitled');
  const content = String(req.body?.content ?? '');
  const format = String(req.body?.format ?? 'markdown') as DocumentFormat;
  const doc = createDocument(tenantId, { title, content, format });
  res.status(201).json(doc);
});

documentsApiRouter.get('/:id', (req: DocumentsRequest, res: Response) => {
  const tenantId = req.tenantId ?? '__operator__';
  const doc = getDocument(tenantId, String(req.params.id));
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  res.json(doc);
});

documentsApiRouter.put('/:id', (req: DocumentsRequest, res: Response) => {
  const tenantId = req.tenantId ?? '__operator__';
  const id = String(req.params.id);
  const patch: { title?: string; content?: string; format?: DocumentFormat } = {};
  if (req.body?.title !== undefined) patch.title = String(req.body.title);
  if (req.body?.content !== undefined) patch.content = String(req.body.content);
  if (req.body?.format !== undefined) patch.format = String(req.body.format) as DocumentFormat;

  const doc = updateDocument(tenantId, id, patch);
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  res.json(doc);
});

documentsApiRouter.delete('/:id', (req: DocumentsRequest, res: Response) => {
  const tenantId = req.tenantId ?? '__operator__';
  const deleted = deleteDocument(tenantId, String(req.params.id));
  if (!deleted) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  res.status(204).send();
});

documentsApiRouter.post('/:id/ai-assist', async (req: DocumentsRequest, res: Response) => {
  const tenantId = req.tenantId ?? '__operator__';
  const doc = getDocument(tenantId, String(req.params.id));
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  const instruction = String(req.body?.instruction ?? '').trim();
  if (!instruction) {
    res.status(400).json({ error: 'instruction is required' });
    return;
  }

  const selection = req.body?.selection !== undefined ? String(req.body.selection) : undefined;
  const content = req.body?.content !== undefined ? String(req.body.content) : doc.content;

  try {
    const result = await suggestDocumentEdit({
      content,
      format: doc.format,
      instruction,
      selection,
    });
    if (!result) {
      res.status(502).json({ error: 'Empty suggestion from model' });
      return;
    }
    res.json({ result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});
