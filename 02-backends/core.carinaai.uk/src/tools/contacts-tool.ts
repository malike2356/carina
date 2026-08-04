import type { Tool } from '../types/index.js';
import {
  findContact,
  loadAllContacts,
  contactsContextBlock,
  findContactById,
  updateContactInLocalStore,
  enrichContactChannels,
} from '../profiles/contacts.js';
import { getWorkerSessionContext } from '../workers/worker-session-context.js';
import {
  getContactsSyncSchedule,
  upsertContactsSyncSchedule,
} from '../contacts/contacts-sync-schedule-store.js';
import {
  getScheduleStatus,
  runWorkspaceContactsSync,
} from '../contacts/contacts-sync-runner.js';

export function createContactsTool(sessionId?: string): Tool {
  return {
    name: 'contacts',
    description:
      'Search the workspace Contacts directory (synced Google Contacts, CSV, manual). '
      + 'PRIMARY tool for finding phone numbers and people by name. '
      + 'This is the same directory as the Contacts page (thousands of Google entries). '
      + 'Prefer contacts(action="search", query="...") over google-contacts People API or Drive. '
      + 'Partial names and close spellings match (e.g. "Sam Oka" finds "Samuel Okafor"; "Apigey" can match "Appiah"). '
      + 'If several people match, list them and ask which one. Never invent a contact from examples. '
      + 'If search returns no matches, say so; do not invent a different person. '
      + 'Actions: list, search, context, send, call, email, update, sync, schedule_get, schedule_set. '
      + 'call: finds a contact phone and starts a click-to-call (rings YOUR phone, then bridges to them). '
      + 'email: finds a contact email and returns fields for workspace-email-draft-for-approval. '
      + 'update can enrich email/telegram/phone even for Google-synced contacts. '
      + 'Use sync to pull Google Contacts now. Use schedule_set for recurring resync.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: [
            'list',
            'search',
            'context',
            'send',
            'call',
            'email',
            'update',
            'sync',
            'schedule_get',
            'schedule_set',
          ],
        },
        query: { type: 'string', description: 'Contact name or email for search/send/update/call/email' },
        message: { type: 'string', description: 'Message text for send action' },
        channel: {
          type: 'string',
          enum: ['whatsapp', 'telegram', 'email', 'phone'],
          description: 'Preferred channel for send',
        },
        mode: {
          type: 'string',
          enum: ['click_to_call', 'tel_link', 'aiva'],
          description:
            'For call: click_to_call (default; ring owner phone then bridge), '
            + 'tel_link (return a dial link for the user to tap), '
            + 'aiva (Aiva places a PSTN call and talks to the contact).',
        },
        subject: { type: 'string', description: 'For email action: draft subject' },
        body: { type: 'string', description: 'For email action: draft body' },
        notes: { type: 'string', description: 'New notes for update action' },
        tags: { type: 'array', items: { type: 'string' }, description: 'New tags for update action' },
        phone: { type: 'string', description: 'New phone number for update action' },
        email: { type: 'string', description: 'New email for update action' },
        telegram: { type: 'string', description: 'Telegram @username for update action' },
        enabled: {
          type: 'boolean',
          description: 'For schedule_set: turn auto-resync on or off',
        },
        timesPerDay: {
          type: 'number',
          description: 'For schedule_set: how many Google resyncs per day (1-4)',
        },
        timezone: {
          type: 'string',
          description: 'For schedule_set: IANA timezone (default Europe/London)',
        },
      },
      required: ['action'],
    },
    execute: async (params) => {
      const action = String(params.action ?? '');
      const session = sessionId ? getWorkerSessionContext(sessionId) : undefined;
      const workspaceId = session?.worker.workspaceId;
      const workerId = session?.worker.id;

      if (action === 'list') {
        if (!workspaceId) {
          return { error: 'Contacts list requires an Aiva workspace session.', contacts: [], count: 0 };
        }
        const contacts = await loadAllContacts(workspaceId);
        return { contacts, count: contacts.length };
      }

      if (action === 'search') {
        const query = String(params.query ?? '').trim();
        if (!query) return { error: 'query is required for search' };
        if (!workspaceId) {
          return { error: 'Contacts search requires an Aiva workspace session.', query, count: 0, contacts: [] };
        }
        const contacts = await findContact(query, workspaceId);
        const top = contacts.slice(0, 25);
        return {
          query,
          count: contacts.length,
          contacts: top,
          match_names: top.map((c) => c.name),
          answer_rule:
            'Answer ONLY from these contacts for this query. '
            + 'Do not mention or reuse any other person from earlier in this chat. '
            + (top.length === 0
              ? `No Contacts match for "${query}". Say that plainly.`
              : top.length === 1
                ? `Report this person: ${top[0]?.name}.`
                : `List these ${top.length} matches and ask which one.`),
          note: contacts.length === 0
            ? 'No matches in this workspace Contacts directory. Connect Google in Tools and sync, or try a shorter name token.'
            : contacts.length > 25
              ? `Showing top 25 of ${contacts.length} matches.`
              : undefined,
        };
      }

      if (action === 'context') {
        if (!workspaceId) {
          return { error: 'Contacts context requires an Aiva workspace session.', context: '' };
        }
        const query = params.query ? String(params.query) : '';
        const contacts = query
          ? await findContact(query, workspaceId)
          : await loadAllContacts(workspaceId);
        return { context: contactsContextBlock(contacts.slice(0, 20)) };
      }

      if (action === 'send') {
        const query = String(params.query ?? '').trim();
        const message = String(params.message ?? '').trim();
        if (!query) return { error: 'query is required for send' };
        if (!message) return { error: 'message is required for send' };
        if (!workspaceId) return { error: 'Contacts send requires an Aiva workspace session.' };

        const results = await findContact(query, workspaceId);
        if (results.length === 0) return { error: `No contact found matching "${query}"` };
        const contact = results[0];

        const preferred = params.channel ? String(params.channel) : null;
        const channelOrder = preferred
          ? [preferred, 'telegram', 'whatsapp', 'email']
          : ['telegram', 'whatsapp', 'email'];

        let resolvedChannel: string | null = null;
        let resolvedIdentifier: string | null = null;

        for (const ch of channelOrder) {
          if (ch === 'whatsapp' && contact.whatsapp) {
            resolvedChannel = 'whatsapp';
            resolvedIdentifier = contact.whatsapp;
            break;
          }
          if (ch === 'telegram' && contact.telegram) {
            resolvedChannel = 'telegram';
            resolvedIdentifier = contact.telegram;
            break;
          }
          if (ch === 'email' && contact.email) {
            resolvedChannel = 'email';
            resolvedIdentifier = contact.email;
            break;
          }
          if (ch === 'phone' && contact.phone) {
            resolvedChannel = 'phone';
            resolvedIdentifier = contact.phone;
            break;
          }
        }

        if (!resolvedChannel || !resolvedIdentifier) {
          return {
            error: `Contact "${contact.name}" has no reachable channel. Available: ${JSON.stringify({
              whatsapp: contact.whatsapp,
              telegram: contact.telegram,
              email: contact.email,
              phone: contact.phone,
            })}`,
          };
        }

        return {
          action: 'send_pending',
          contact: { id: contact.id, name: contact.name },
          channel: resolvedChannel,
          identifier: resolvedIdentifier,
          message,
          instruction: `Use the send-message tool with channel="${resolvedChannel}", recipient="${resolvedIdentifier}", and the message content above.`,
        };
      }

      if (action === 'call') {
        const query = String(params.query ?? '').trim();
        if (!query) return { error: 'query is required for call' };
        if (!workspaceId) return { error: 'Contacts call requires an Aiva workspace session.' };
        const results = await findContact(query, workspaceId);
        if (results.length === 0) return { error: `No contact found matching "${query}"` };
        const contact = results[0];
        const phone = String(contact.phone || contact.whatsapp || '').trim();
        if (!phone) {
          return {
            error: `Contact "${contact.name}" has no phone number. Ask the owner to add one, or search Gmail/Drive for a number.`,
            contact: { id: contact.id, name: contact.name, email: contact.email },
          };
        }

        const digits = phone.replace(/[^\d+]/g, '');
        const telUri = `tel:${digits}`;
        const modeRaw = String(params.mode ?? 'click_to_call').trim().toLowerCase();
        const mode = modeRaw === 'tel_link' || modeRaw === 'aiva' ? modeRaw : 'click_to_call';

        if (mode === 'tel_link') {
          return {
            ok: true,
            action: 'call_tel_link',
            contact: { id: contact.id, name: contact.name, phone },
            telUri,
            instruction:
              `Tell the owner to tap this number to dial on their phone: ${phone} (${telUri}). `
              + 'Do not claim the call already connected.',
          };
        }

        if (!workspaceId || !workerId) {
          return {
            ok: true,
            action: 'call_tel_link',
            contact: { id: contact.id, name: contact.name, phone },
            telUri,
            note: 'No active Aiva session for click-to-call; returning dial link instead.',
            instruction: `Tell the owner to tap ${phone} (${telUri}) to call ${contact.name}.`,
          };
        }

        if (mode === 'aiva') {
          const { placeOutboundVoiceCall } = await import('../channels/voice-pstn.js');
          const placed = await placeOutboundVoiceCall({
            workspaceId,
            workerId,
            toNumber: phone,
          });
          if (!placed.ok) {
            return {
              ok: false,
              error: placed.error,
              fallbackTelUri: telUri,
              instruction: `Click-to-call/Aiva PSTN failed. Offer the owner this dial link instead: ${telUri}`,
            };
          }
          return {
            ok: true,
            action: 'call_aiva_pstn',
            callSid: placed.callSid,
            contact: { id: contact.id, name: contact.name, phone },
            instruction: `Aiva is calling ${contact.name} now on PSTN. Confirm briefly; do not invent call outcomes.`,
          };
        }

        const { getWorkspaceContact } = await import('../email/workspace-contact.js');
        const owner = await getWorkspaceContact(workspaceId);
        const ownerPhone = owner?.ownerPhone?.trim() ?? '';
        if (!ownerPhone) {
          return {
            ok: true,
            action: 'call_tel_link',
            contact: { id: contact.id, name: contact.name, phone },
            telUri,
            note: 'Owner phone is not set, so click-to-call cannot ring your handset.',
            instruction:
              `Ask the owner to save their phone in workspace profile, or tap ${phone} (${telUri}) now to dial ${contact.name}.`,
          };
        }

        const { placeClickToCall } = await import('../channels/voice-pstn.js');
        const placed = await placeClickToCall({
          workspaceId,
          workerId,
          ownerNumber: ownerPhone,
          contactNumber: phone,
          contactName: contact.name,
        });
        if (!placed.ok) {
          return {
            ok: false,
            error: placed.error,
            fallbackTelUri: telUri,
            instruction: `Could not start click-to-call. Offer dial link: ${telUri}`,
          };
        }

        return {
          ok: true,
          action: 'call_click_to_call',
          callSid: placed.callSid,
          contact: { id: contact.id, name: contact.name, phone },
          ownerPhone,
          instruction:
            `Your phone (${ownerPhone}) should ring now. Answer it and you will be connected to ${contact.name} (${phone}). `
            + 'Confirm that briefly; do not invent call outcomes.',
        };
      }

      if (action === 'email') {
        const query = String(params.query ?? '').trim();
        if (!query) return { error: 'query is required for email' };
        if (!workspaceId) return { error: 'Contacts email requires an Aiva workspace session.' };
        const results = await findContact(query, workspaceId);
        if (results.length === 0) return { error: `No contact found matching "${query}"` };
        const contact = results[0];
        const email = String(contact.email ?? '').trim();
        if (!email) {
          return {
            error: `Contact "${contact.name}" has no email. Search Gmail/Drive or ask the owner to add one.`,
            contact: { id: contact.id, name: contact.name, phone: contact.phone },
          };
        }

        const subject = String(params.subject ?? '').trim()
          || `Message for ${contact.name}`;
        const body = String(params.body ?? '').trim();

        return {
          ok: true,
          action: 'email_draft_pending',
          contact: { id: contact.id, name: contact.name, email },
          to: email,
          subject,
          body,
          instruction:
            (body
              ? `Immediately call workspace-email-draft-for-approval with to="${email}", subject="${subject}", and draftBody set to the body above. `
              : `Draft a short professional body, then call workspace-email-draft-for-approval with to="${email}", subject="${subject}", and that draftBody. `)
            + 'Do NOT use gmail-send unless the owner explicitly said to send now without approval. '
            + 'Tell them the draft is waiting at /aiva/approvals.',
        };
      }

      if (action === 'update') {
        const query = String(params.query ?? '').trim();
        if (!query) return { error: 'query is required for update' };
        if (!workspaceId) return { error: 'Contacts update requires an Aiva workspace session.' };

        const contact = (await findContactById(query, workspaceId))
          ?? (await findContact(query, workspaceId))[0];
        if (!contact) return { error: `No contact found matching "${query}"` };

        const patch = {
          notes: params.notes != null ? String(params.notes) : undefined,
          phone: params.phone != null ? String(params.phone) : undefined,
          email: params.email != null ? String(params.email) : undefined,
          telegram: params.telegram != null ? String(params.telegram) : undefined,
          whatsapp: params.phone != null ? String(params.phone) : undefined,
        };

        if (contact.source === 'google' || contact.source === 'csv' || contact.source === 'imported') {
          const enriched = await enrichContactChannels(contact.id, patch, workspaceId);
          if (!enriched) return { error: `Could not enrich contact "${contact.name}"` };
          return { ok: true, contact: enriched, note: 'Saved as workspace enrichment overlay (survives Google resync merge).' };
        }

        const updated = await updateContactInLocalStore(contact.id, {
          notes: patch.notes ?? contact.notes,
          tags: Array.isArray(params.tags) ? (params.tags as unknown[]).map(String) : contact.tags,
          phone: patch.phone ?? contact.phone,
          whatsapp: patch.whatsapp ?? contact.whatsapp,
          email: patch.email ?? contact.email,
          telegram: patch.telegram ?? contact.telegram,
        });
        return { ok: true, contact: updated };
      }

      if (action === 'sync') {
        if (!workspaceId) {
          return { error: 'Contacts sync requires an Aiva workspace session.' };
        }
        const outcome = await runWorkspaceContactsSync(workspaceId);
        if (!outcome.ok) {
          return { error: outcome.error ?? 'Google sync failed', imported: outcome.imported };
        }
        return {
          ok: true,
          imported: outcome.imported,
          skipped: outcome.skipped,
          schedule: await getContactsSyncSchedule(workspaceId),
        };
      }

      if (action === 'schedule_get') {
        if (!workspaceId) {
          return { error: 'Contacts schedule requires an Aiva workspace session.' };
        }
        return { schedule: await getScheduleStatus(workspaceId) };
      }

      if (action === 'schedule_set') {
        if (!workspaceId) {
          return { error: 'Contacts schedule requires an Aiva workspace session.' };
        }
        const schedule = await upsertContactsSyncSchedule(workspaceId, {
          enabled: typeof params.enabled === 'boolean' ? params.enabled : undefined,
          timesPerDay: params.timesPerDay != null ? Number(params.timesPerDay) : undefined,
          timezone: typeof params.timezone === 'string' ? params.timezone : undefined,
        });
        return {
          ok: true,
          schedule: await getScheduleStatus(workspaceId),
          message: schedule.enabled
            ? `Auto-resync is on (${schedule.timesPerDay}x per day, ${schedule.timezone}).`
            : 'Auto-resync is off.',
        };
      }

      return { error: `unknown action: ${action}` };
    },
  };
}

export const contactsTool = createContactsTool();
