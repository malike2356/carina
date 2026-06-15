import { Router, type NextFunction, type Request, type Response, type Router as ExpressRouter } from 'express';
import { getWebReminderInbox, acknowledgeWebReminder } from '../agents/reminder-delivery.js';
import { isControlAuthorized } from '../infrastructure/control-auth.js';
import { suggestDocumentEdit } from './documents-assist.js';
import {
  createNote,
  deleteNote,
  getNote,
  listNotes,
  updateNote,
  type NoteFormat,
} from './notes-store.js';

export const notesApiRouter: ExpressRouter = Router();

type NotesRequest = Request & { tenantId?: string };

function resolveTenantId(req: NotesRequest): string {
  if (req.session?.hostedAccountId) return req.session.hostedAccountId;
  return '__operator__';
}

function notesAuth(req: NotesRequest, res: Response, next: NextFunction): void {
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

notesApiRouter.use(notesAuth);

notesApiRouter.get('/inbox', (req: NotesRequest, res: Response) => {
  res.json({ messages: getWebReminderInbox() });
});

notesApiRouter.post('/inbox/:noteId/ack', (req: NotesRequest, res: Response) => {
  acknowledgeWebReminder(String(req.params.noteId));
  res.status(204).send();
});

notesApiRouter.get('/', (req: NotesRequest, res: Response) => {
  const tenantId = req.tenantId ?? '__operator__';
  const format = String(req.query.format ?? '').trim() as NoteFormat | '';
  const notes = listNotes(tenantId, format || undefined);
  res.json({ notes });
});

notesApiRouter.post('/', (req: NotesRequest, res: Response) => {
  const tenantId = req.tenantId ?? '__operator__';
  const note = createNote(tenantId, {
    title: String(req.body?.title ?? ''),
    body: String(req.body?.body ?? ''),
    format: String(req.body?.format ?? 'note') as NoteFormat,
    done: Boolean(req.body?.done),
    remindAt: req.body?.remindAt ? String(req.body.remindAt) : null,
    deliverySessionId: req.body?.deliverySessionId ? String(req.body.deliverySessionId) : null,
  });
  res.status(201).json(note);
});

notesApiRouter.get('/:id', (req: NotesRequest, res: Response) => {
  const tenantId = req.tenantId ?? '__operator__';
  const note = getNote(tenantId, String(req.params.id));
  if (!note) {
    res.status(404).json({ error: 'Note not found' });
    return;
  }
  res.json(note);
});

notesApiRouter.put('/:id', (req: NotesRequest, res: Response) => {
  const tenantId = req.tenantId ?? '__operator__';
  const id = String(req.params.id);
  const patch: {
    title?: string;
    body?: string;
    format?: NoteFormat;
    done?: boolean;
    remindAt?: string | null;
    deliverySessionId?: string | null;
  } = {};

  if (req.body?.title !== undefined) patch.title = String(req.body.title);
  if (req.body?.body !== undefined) patch.body = String(req.body.body);
  if (req.body?.format !== undefined) patch.format = String(req.body.format) as NoteFormat;
  if (req.body?.done !== undefined) patch.done = Boolean(req.body.done);
  if (req.body?.remindAt !== undefined) {
    patch.remindAt = req.body.remindAt ? String(req.body.remindAt) : null;
  }
  if (req.body?.deliverySessionId !== undefined) {
    patch.deliverySessionId = req.body.deliverySessionId
      ? String(req.body.deliverySessionId)
      : null;
  }

  const note = updateNote(tenantId, id, patch);
  if (!note) {
    res.status(404).json({ error: 'Note not found' });
    return;
  }
  res.json(note);
});

notesApiRouter.delete('/:id', (req: NotesRequest, res: Response) => {
  const tenantId = req.tenantId ?? '__operator__';
  const deleted = deleteNote(tenantId, String(req.params.id));
  if (!deleted) {
    res.status(404).json({ error: 'Note not found' });
    return;
  }
  res.status(204).send();
});

notesApiRouter.post('/:id/ai-assist', async (req: NotesRequest, res: Response) => {
  const tenantId = req.tenantId ?? '__operator__';
  const note = getNote(tenantId, String(req.params.id));
  if (!note) {
    res.status(404).json({ error: 'Note not found' });
    return;
  }

  const instruction = String(req.body?.instruction ?? '').trim();
  if (!instruction) {
    res.status(400).json({ error: 'instruction is required' });
    return;
  }

  const selection = req.body?.selection !== undefined ? String(req.body.selection) : undefined;
  const body = req.body?.body !== undefined ? String(req.body.body) : note.body;

  try {
    const result = await suggestDocumentEdit({
      content: body,
      format: note.format === 'note' ? 'markdown' : 'plain',
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
