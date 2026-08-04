import type { AivaChannelName, WorkerChannelRow } from '../channels/types.js';
import type { Worker } from '../types/index.js';
import { createWorkerChannel, generateEmailSlug, readChannelCredentials, } from '../channels/channel-store.js';
import { registerTelegramWebhook } from '../channels/adapters/telegram-adapter.js';
import { normalizeSmsNumber } from '../channels/adapters/sms-adapter.js';
import { ensureDiscordGateway, resolveDiscordApplicationId, } from '../channels/adapters/discord-gateway.js';
import { registerChannel } from '../channels/worker-registry.js';
import { sendWorkerOnboardingMessage } from './workspace-onboarding.js';
import { activateTrialOnFirstChannel } from './aiva-subscription-store.js';
import { checkChannelCredentialForTrial, recordChannelCredentialTrial, } from '../security/trial-abuse-guard.js';
import { firstName, getWorkspaceContact } from '../email/workspace-contact.js';
import { generateHireOutreachContent } from './hire-outreach.js';
import { logActivity } from './worker-store.js';

export interface ChannelBinding {
  channel: string;
  identifier: string;
}
export interface OnboardingTarget {
  row: WorkerChannelRow;
  contactId: string;
  credentials: Record<string, string>;
}
const VALID_CHANNELS = new Set([
    'whatsapp',
    'email',
    'slack',
    'telegram',
    'web',
    'sms',
    'discord',
    'teams',
    'linkedin',
    'instagram',
    'messenger',
    'twitter',
    'tiktok',
]);
function asChannel(value: string) {
    return VALID_CHANNELS.has(value) ? value : null;
}
export function isTelegramBotToken(value: string) {
    return /^\d+:[A-Za-z0-9_-]+$/.test(value.trim());
}
export function isPhoneLike(value: string) {
    const digits = value.replace(/\D/g, '');
    return digits.length >= 8 && digits.length <= 15;
}
export function isEmailLike(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
export function isTelegramChatId(value: string) {
    return /^-?\d+$/.test(value.trim());
}
export function normalizePhoneContact(value: string) {
    return value.replace(/\D/g, '');
}
function whatsappEnvCredentials(): Record<string, string> {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim()
        ?? process.env.META_WHATSAPP_ACCESS_TOKEN?.trim()
        ?? '';
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()
        ?? process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim()
        ?? '';
    if (!accessToken || !phoneNumberId)
        return {};
    return { access_token: accessToken, phone_number_id: phoneNumberId };
}
export function resolveOutboundCredentials(channel: string, row: WorkerChannelRow): Record<string, string> {
    const fromRow = readChannelCredentials(row);
    if (Object.keys(fromRow).length > 0)
        return fromRow;
    if (channel === 'whatsapp')
        return whatsappEnvCredentials();
    return {};
}
export function resolveOnboardingContact(channel: string, binding: string | undefined) {
    const value = binding?.trim();
    if (!value)
        return null;
    if (channel === 'email' && isEmailLike(value))
        return value;
    if (channel === 'whatsapp' && isPhoneLike(value))
        return normalizePhoneContact(value);
    if (channel === 'sms' && isPhoneLike(value))
        return normalizePhoneContact(value);
    if (channel === 'telegram' && isTelegramChatId(value))
        return value;
    if (channel === 'slack' && value.startsWith('C') && /^C[A-Z0-9]+$/i.test(value))
        return value;
    return null;
}
export function pickFirstOnboardingTarget(channelRows: WorkerChannelRow[], channelBindings: ChannelBinding[] = []): OnboardingTarget | null {
    const bindingByChannel = new Map(channelBindings
        .filter((b) => b.channel !== 'web' && b.identifier.trim())
        .map((b) => [b.channel, b.identifier.trim()]));
    for (const row of channelRows) {
        if (row.channel === 'web')
            continue;
        const contactId = resolveOnboardingContact(row.channel, bindingByChannel.get(row.channel));
        if (!contactId)
            continue;
        const credentials = resolveOutboundCredentials(row.channel, row);
        if (row.channel !== 'email' && Object.keys(credentials).length === 0)
            continue;
        return { row, contactId, credentials };
    }
    return null;
}
export function pickAllOnboardingTargets(
    channelRows: WorkerChannelRow[],
    channelBindings: ChannelBinding[] = [],
    ownerEmail?: string | null,
): OnboardingTarget[] {
    const bindingByChannel = new Map(channelBindings
        .filter((b) => b.channel !== 'web' && b.identifier.trim())
        .map((b) => [b.channel, b.identifier.trim()]));
    const targets: OnboardingTarget[] = [];
    const seen = new Set<string>();

    for (const row of channelRows) {
        if (row.channel === 'web')
            continue;
        let contactId = resolveOnboardingContact(row.channel, bindingByChannel.get(row.channel));
        if (!contactId && row.channel === 'email' && ownerEmail) {
            contactId = ownerEmail.trim().toLowerCase();
        }
        if (!contactId)
            continue;
        const credentials = resolveOutboundCredentials(row.channel, row);
        if (row.channel !== 'email' && Object.keys(credentials).length === 0)
            continue;
        const key = `${row.channel}:${contactId}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        targets.push({ row, contactId, credentials });
    }
    return targets;
}
function resolveHireChannelIdentity(channel: string, worker: Worker, binding: string | undefined) {
    const value = binding?.trim() ?? '';
    const credentials: Record<string, string> = {};
    if (channel === 'web') {
        return { identifier: `web:${worker.id}`, credentials };
    }
    if (channel === 'email') {
        const identifier = generateEmailSlug(worker.name, worker.id);
        credentials.from_address = identifier;
        credentials.worker_name = worker.name;
        return { identifier, credentials };
    }
    if (channel === 'telegram') {
        if (value && isTelegramBotToken(value)) {
            credentials.bot_token = value;
            return { identifier: worker.id, credentials };
        }
        if (value && !isTelegramBotToken(value)) {
            return null;
        }
        return { identifier: worker.id, credentials };
    }
    if (channel === 'whatsapp') {
        const envCreds = whatsappEnvCredentials();
        if (Object.keys(envCreds).length > 0) {
            return { identifier: envCreds.phone_number_id, credentials: { ...envCreds } };
        }
        if (value && !isPhoneLike(value)) {
            return { identifier: value, credentials };
        }
        return null;
    }
    if (channel === 'slack') {
        if (value && !value.includes('.')) {
            return { identifier: value, credentials };
        }
        return null;
    }
    if (channel === 'sms') {
        const fromNumber = normalizeSmsNumber(String(credentials.from_number ?? value));
        if (!fromNumber)
            return null;
        return { identifier: fromNumber, credentials: { ...credentials, from_number: fromNumber } };
    }
    if (channel === 'discord') {
        if (credentials.bot_token) {
            return { identifier: worker.id, credentials };
        }
        return null;
    }
    if (channel === 'teams') {
        const appId = String(credentials.app_id ?? value).trim();
        if (!appId || !credentials.app_password?.trim())
            return null;
        return { identifier: appId, credentials: { ...credentials, app_id: appId } };
    }
    if (channel === 'linkedin'
        || channel === 'instagram'
        || channel === 'messenger'
        || channel === 'twitter'
        || channel === 'tiktok') {
        return { identifier: 'pending', credentials };
    }
    return value ? { identifier: value, credentials } : null;
}
export async function provisionWorkerChannels(worker: Worker, workspaceId: string, channels: string[], channelBindings: ChannelBinding[] = []): Promise<WorkerChannelRow[]> {
    const bindingByChannel = new Map(channelBindings
        .filter((b) => b.identifier.trim())
        .map((b) => [b.channel, b.identifier.trim()]));
    const channelSet = new Set(channels.length > 0 ? channels : ['web']);
    channelSet.add('web');
    const rows = [];
    for (const raw of channelSet) {
        const channel = asChannel(raw);
        if (!channel)
            continue;
        const identity = resolveHireChannelIdentity(channel, worker, bindingByChannel.get(channel));
        if (!identity)
            continue;
        let identifier = identity.identifier;
        const credentials = identity.credentials;
        if (channel === 'email') {
            try {
                const { ensureHostedEmailAddressForWorker } = await import(
                    '../ingestion/email/hosted-email-address.js'
                );
                const hosted = await ensureHostedEmailAddressForWorker({
                    workspaceId,
                    workerId: worker.id,
                    workerName: worker.name,
                });
                if (hosted?.address) {
                    identifier = hosted.address;
                    credentials.from_address = hosted.address;
                    credentials.worker_name = worker.name;
                }
            }
            catch (err) {
                console.warn('[provision-channels] hosted email ensure failed:', err);
            }
        }
        if (channel === 'telegram' && credentials.bot_token) {
            try {
                await registerTelegramWebhook(credentials.bot_token, worker.id);
            }
            catch (err) {
                console.warn('[provision-channels] telegram webhook registration failed:', err);
            }
        }
        if (channel === 'discord' && credentials.bot_token) {
            try {
                identifier = await resolveDiscordApplicationId(credentials.bot_token);
                credentials.application_id = identifier;
            }
            catch (err) {
                console.warn('[provision-channels] discord application id resolution failed:', err);
                continue;
            }
        }
        if (channel === 'sms') {
            identifier = normalizeSmsNumber(identifier);
            credentials.from_number = identifier;
        }
        // Layer 3: block reuse of a channel credential that is already in a live trial on a different workspace.
        if (channel !== 'web') {
            const credCheck = await checkChannelCredentialForTrial(channel, identifier, workspaceId);
            if (!credCheck.allowed) {
                console.warn(`[provision-channels] trial credential blocked ${channel}:${identifier}: ${credCheck.error}`);
                continue;
            }
        }
        try {
            const row = await createWorkerChannel({
                workerId: worker.id,
                workspaceId,
                channel: channel as import('../channels/types.js').AivaChannelName,
                identifier,
                credentials: Object.keys(credentials).length > 0 ? credentials : undefined,
            });
            registerChannel(channel, identifier, {
                workerId: worker.id,
                workspaceId,
                channelRowId: row.id,
                credentialBlob: row.credentials.encrypted ?? '',
            });
            if (channel === 'discord' && credentials.bot_token) {
                try {
                    await ensureDiscordGateway(identifier, credentials.bot_token, worker.id, workspaceId);
                }
                catch (err) {
                    console.warn('[provision-channels] discord gateway start failed:', err);
                }
            }
            // Start trial clock on first channel (including web chat default onboarding).
            void activateTrialOnFirstChannel(workspaceId).catch((err: unknown) => console.warn('[provision-channels] trial activation failed:', err));
            if (channel !== 'web') {
                void recordChannelCredentialTrial(channel, identifier, workspaceId).catch((err: unknown) => console.warn('[provision-channels] credential record failed:', err));
            }
            rows.push(row);
        }
        catch (err) {
            console.warn(`[provision-channels] failed ${channel}:${identifier}:`, err);
        }
    }
    return rows;
}
export async function sendHireOnboardingMessages(
    worker: Worker,
    channelRows: WorkerChannelRow[],
    channelBindings: ChannelBinding[] = [],
): Promise<void> {
    const contact = await getWorkspaceContact(worker.workspaceId);
    const ownerFirstName = contact
        ? firstName(contact.preferredName || contact.ownerName, contact.ownerEmail)
        : undefined;
    const targets = pickAllOnboardingTargets(channelRows, channelBindings, contact?.ownerEmail);
    if (targets.length === 0)
        return;

    const outreach = await generateHireOutreachContent(worker, contact);

    for (const target of targets) {
        const channel = target.row.channel;
        const body = channel === 'whatsapp' || channel === 'sms'
            ? outreach.whatsappBody
            : outreach.emailBody;
        await sendWorkerOnboardingMessage(
            worker,
            channel,
            target.contactId,
            target.credentials,
            ownerFirstName,
            { content: body, subject: outreach.subject },
        );
        void logActivity(worker.id, {
            actionType: 'message_sent',
            summary: `Welcome message delivered on ${channel}`,
            outputText: body.slice(0, 1000),
            channel,
            contactId: target.contactId,
            escalated: false,
        }).catch(() => {});
    }
}
export function parseChannelBindings(raw: unknown): ChannelBinding[] {
    if (!Array.isArray(raw))
        return [];
    return raw
        .map((item) => {
        if (!item || typeof item !== 'object')
            return null;
        const channel = String(item.channel ?? '').trim();
        const identifier = String(item.identifier ?? '').trim();
        if (!channel)
            return null;
        return { channel, identifier };
    })
        .filter((item) => item !== null);
}
