import { Router } from 'express';
import { fetchChannelStatusReports } from '../lib/channel-status.js';
import { deleteChannelNote, loadChannelNotes, upsertChannelNote } from '../lib/channel-notes.js';
import { CARINA_BASE } from '../lib/carina.js';

export const channelsRouter = Router();

channelsRouter.get('/', async (req, res) => {
  try {
    const [{ channels, policyFlags, source }, notes] = await Promise.all([
      fetchChannelStatusReports(),
      loadChannelNotes(),
    ]);
    const enriched = channels.map((ch) => {
      const note = notes[ch.channel];
      return {
        ...ch,
        operatorNotes: note?.notes || '',
        operatorOwner: note?.owner || '',
        operatorPriority: note?.priority || 'normal',
        operatorUpdatedAt: note?.updatedAt || null,
      };
    });
    const flash = typeof req.query.ok === 'string'
      ? { type: 'success', text: 'Channel operator note saved.' }
      : typeof req.query.err === 'string'
        ? { type: 'error', text: String(req.query.err) }
        : null;
    res.render('channels', {
      title: 'Channels',
      channels: enriched,
      policyFlags,
      source,
      carinaApiUrl: CARINA_BASE,
      flash,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).render('error', { message });
  }
});

channelsRouter.post('/:channel/notes', async (req, res) => {
  try {
    const channel = String(req.params.channel || '').trim().toLowerCase();
    if (!channel) {
      res.redirect('/channels?err=' + encodeURIComponent('Channel is required'));
      return;
    }
    const priorityRaw = String(req.body?.priority ?? 'normal');
    const priority = priorityRaw === 'high' || priorityRaw === 'low' ? priorityRaw : 'normal';
    await upsertChannelNote({
      channel,
      notes: String(req.body?.notes ?? ''),
      owner: String(req.body?.owner ?? ''),
      priority,
    });
    res.redirect('/channels?ok=1');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.redirect('/channels?err=' + encodeURIComponent(message));
  }
});

channelsRouter.post('/:channel/notes/delete', async (req, res) => {
  try {
    await deleteChannelNote(String(req.params.channel || ''));
    res.redirect('/channels?ok=1');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.redirect('/channels?err=' + encodeURIComponent(message));
  }
});
