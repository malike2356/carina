/**
 * Microsoft Graph Calendar adapter stub (Prompt 704).
 * Honest not_configured until Graph credentials and scopes are wired.
 */

import type { CalendarAdapter, CalendarAdapterResult, CalendarEventInput } from './types.js';

export class MicrosoftCalendarAdapter implements CalendarAdapter {
  readonly provider = 'microsoft' as const;

  private notConfigured(action: string): CalendarAdapterResult {
    return {
      ok: false,
      status: 'not_configured',
      provider: 'microsoft',
      attendees: [],
      invitationSendRequested: false,
      errorCode: 'microsoft_not_configured',
      errorMessage: `Microsoft Graph calendar ${action} is not configured`,
    };
  }

  async createEvent(_input: CalendarEventInput): Promise<CalendarAdapterResult> {
    return this.notConfigured('create');
  }

  async updateEvent(
    _input: CalendarEventInput & { providerEventId: string },
  ): Promise<CalendarAdapterResult> {
    return this.notConfigured('update');
  }

  async deleteEvent(_input: {
    workspaceId: string;
    workerId: string;
    bookingId: string;
    providerEventId: string;
    idempotencyKey: string;
  }): Promise<CalendarAdapterResult> {
    return this.notConfigured('delete');
  }

  async getEvent(_input: {
    workspaceId: string;
    workerId: string;
    providerEventId: string;
  }): Promise<CalendarAdapterResult> {
    return this.notConfigured('get');
  }
}
