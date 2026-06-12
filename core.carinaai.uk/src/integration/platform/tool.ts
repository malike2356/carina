import type { Tool } from '../../types/index.js';
import {
  appleNotesSearch,
  appleRemindersList,
  bearCreate,
  blueBubblesSend,
  cameraSnapshot,
  eightSleepStatus,
  isPlatformIntegrationEnabled,
  listEnabledPlatformIntegrations,
  onePasswordRead,
  platformToolsEnabled,
} from './index.js';

export const platformIntegrateTool: Tool = {
  name: 'platform-integrate',
  description:
    'Optional macOS/platform integrations (opt-in via CARINA_PLATFORM_TOOLS and per-integration env flags). Actions depend on enabled integrations.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: [
          'status',
          'onepassword-read',
          'apple-notes-search',
          'apple-reminders-list',
          'bear-create',
          'bluebubbles-send',
          'eight-sleep-status',
          'camera-snapshot',
        ],
      },
      reference: { type: 'string', description: '1Password op:// reference' },
      query: { type: 'string' },
      title: { type: 'string' },
      text: { type: 'string' },
      chat_guid: { type: 'string' },
      rtsp_url: { type: 'string' },
      list_name: { type: 'string' },
    },
    required: ['action'],
  },
  dangerous: true,
  needsConfirmation: (params) =>
    ['bluebubbles-send', 'bear-create', 'onepassword-read'].includes(String(params.action)),
  execute: async (params) => {
    const action = String(params.action ?? '');

    if (action === 'status') {
      return {
        enabled: platformToolsEnabled(),
        integrations: listEnabledPlatformIntegrations(),
        platform: process.platform,
      };
    }

    if (!platformToolsEnabled()) {
      return { error: 'Set CARINA_PLATFORM_TOOLS=true to enable platform integrations' };
    }

    if (action === 'onepassword-read') {
      if (!isPlatformIntegrationEnabled('onepassword')) {
        return { error: 'Enable CARINA_1PASSWORD_ENABLED=true and install op CLI' };
      }
      const reference = String(params.reference ?? '').trim();
      if (!reference) return { error: 'reference is required' };
      return { output: await onePasswordRead(reference) };
    }

    if (action === 'apple-notes-search') {
      if (!isPlatformIntegrationEnabled('apple-notes')) {
        return { error: 'Enable CARINA_APPLE_NOTES_ENABLED=true on macOS' };
      }
      return { notes: await appleNotesSearch(String(params.query ?? '')) };
    }

    if (action === 'apple-reminders-list') {
      if (!isPlatformIntegrationEnabled('apple-reminders')) {
        return { error: 'Enable CARINA_APPLE_REMINDERS_ENABLED=true on macOS' };
      }
      return { reminders: await appleRemindersList(String(params.list_name ?? 'Reminders')) };
    }

    if (action === 'bear-create') {
      if (!isPlatformIntegrationEnabled('bear')) {
        return { error: 'Enable CARINA_BEAR_ENABLED=true on macOS with Bear installed' };
      }
      return { result: await bearCreate(String(params.title ?? 'Carina'), String(params.text ?? '')) };
    }

    if (action === 'bluebubbles-send') {
      if (!isPlatformIntegrationEnabled('bluebubbles')) {
        return { error: 'Enable CARINA_BLUEBUBBLES_ENABLED=true with BlueBubbles configured' };
      }
      return blueBubblesSend(String(params.text ?? ''), String(params.chat_guid ?? ''));
    }

    if (action === 'eight-sleep-status') {
      if (!isPlatformIntegrationEnabled('eight-sleep')) {
        return { error: 'Enable CARINA_EIGHT_SLEEP_ENABLED=true with EIGHT_SLEEP_TOKEN' };
      }
      return eightSleepStatus();
    }

    if (action === 'camera-snapshot') {
      if (!isPlatformIntegrationEnabled('camera')) {
        return { error: 'Enable CARINA_CAMERA_ENABLED=true with RTSP_URL and ffmpeg' };
      }
      return cameraSnapshot(params.rtsp_url ? String(params.rtsp_url) : undefined);
    }

    return { error: `unknown action: ${action}` };
  },
};

export function registerPlatformTools(register: (tool: Tool) => void): void {
  if (!platformToolsEnabled()) return;
  register(platformIntegrateTool);
}
