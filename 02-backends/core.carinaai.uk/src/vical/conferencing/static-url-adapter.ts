/**
 * Explicitly labelled static room URL fallback (not managed Zoom sync).
 */

import type {
  ConferenceAdapterResult,
  ConferenceCreateInput,
  ConferenceDeleteInput,
  ConferenceUpdateInput,
  ConferencingAdapter,
} from './types.js';

export class StaticUrlConferencingAdapter implements ConferencingAdapter {
  readonly provider = 'static_url' as const;

  async createMeeting(input: ConferenceCreateInput): Promise<ConferenceAdapterResult> {
    const url = input.staticRoomUrl?.trim() || null;
    if (!url) {
      return {
        ok: false,
        status: 'not_configured',
        artifact: {
          provider: 'static_url',
          providerMeetingId: null,
          joinUrl: null,
          hostStartUrlPresent: false,
          passcodeRequired: false,
          waitingRoom: false,
          managed: false,
          fallbackLabel: 'static_room_url_not_set',
        },
        errorCode: 'static_url_missing',
        errorMessage: 'No static room URL configured; this is a labelled fallback only',
      };
    }
    return {
      ok: true,
      status: 'succeeded',
      artifact: {
        provider: 'static_url',
        providerMeetingId: `static:${input.idempotencyKey}`,
        joinUrl: url,
        hostStartUrlPresent: false,
        passcodeRequired: false,
        waitingRoom: false,
        managed: false,
        fallbackLabel: 'static_room_url_fallback',
      },
      hostStartUrl: null,
    };
  }

  async updateMeeting(input: ConferenceUpdateInput): Promise<ConferenceAdapterResult> {
    return this.createMeeting(input);
  }

  async deleteMeeting(_input: ConferenceDeleteInput): Promise<ConferenceAdapterResult> {
    return {
      ok: true,
      status: 'succeeded',
      artifact: {
        provider: 'static_url',
        providerMeetingId: null,
        joinUrl: null,
        hostStartUrlPresent: false,
        passcodeRequired: false,
        waitingRoom: false,
        managed: false,
        fallbackLabel: 'static_room_url_fallback',
      },
    };
  }
}
