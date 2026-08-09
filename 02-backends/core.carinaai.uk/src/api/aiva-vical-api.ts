import { Router, type Request, type Response, type Router as ExpressRouter } from 'express';
import { requireCloudProxy } from '../gateway/cloud-proxy-auth.js';
import {
  approveBooking,
  cancelBookingForGuest,
  cancelBookingForHost,
  createAvailabilityRule,
  createIntakePool,
  createBlackout,
  createBooking,
  createEventType,
  deleteBlackout,
  deleteIntakePool,
  ensureDiscoveryDefaults,
  formatBookingIcs,
  getIntakePool,
  getBookingByGuestToken,
  getOrCreatePublishProfile,
  isVcalError,
  listAvailabilityRules,
  listBlackouts,
  listIntakePools,
  listBookings,
  listEventTypes,
  listOfferedSlots,
  listVicalReminders,
  processDueVicalReminders,
  rejectBooking,
  replaceAvailabilityRules,
  rescheduleBooking,
  rescheduleBookingForGuest,
  resolveWorkspaceByPublicSlug,
  resolvedIntakeQuestions,
  resolvedIntakeRoutingRules,
  setSessionOutcome,
  SlotUnavailableError,
  syncBookingToGoogleCalendar,
  updateIntakePool,
  updateEventType,
  bookWithSaga,
  cancelWithSaga,
  rescheduleWithSaga,
  toPublicBookingView,
  buildZoomUrlValidationResponse,
  handleZoomWebhookEvent,
  verifyZoomWebhookSignature,
} from '../vical/index.js';

export const aivaVicalRouter: ExpressRouter = Router();
aivaVicalRouter.use(requireCloudProxy);

type VicalRequest = Request & { workspaceId?: string };

function resolveWorkspaceId(req: VicalRequest): string | null {
  const header = req.headers['x-workspace-id'];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  return fromHeader?.trim() || null;
}

function sendError(res: Response, error: unknown): void {
  if (error instanceof SlotUnavailableError) {
    res.status(409).json({
      error: error.message,
      code: error.code,
      alternatives: error.alternatives,
    });
    return;
  }
  if (isVcalError(error)) {
    const status = error.code === 'not_found' ? 404 : error.code === 'illegal_transition' ? 400 : 400;
    res.status(status).json({ error: error.message, code: error.code, details: error.details });
    return;
  }
  res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
}

aivaVicalRouter.use((req: VicalRequest, res: Response, next) => {
  // Public guest routes skip workspace header; they resolve via slug/token.
  if (req.path.startsWith('/public/') || req.path.startsWith('/guest/')) {
    next();
    return;
  }
  const workspaceId = resolveWorkspaceId(req);
  if (!workspaceId) {
    res.status(400).json({ error: 'workspaceId is required (X-Workspace-Id header)' });
    return;
  }
  req.workspaceId = workspaceId;
  next();
});

aivaVicalRouter.post('/seed', (req: VicalRequest, res: Response) => {
  const workspaceId = req.workspaceId!;
  const headerUser = req.headers['x-user-id'];
  const fromHeader = Array.isArray(headerUser) ? headerUser[0] : headerUser;
  const hostUserId = String(req.body?.hostUserId ?? fromHeader ?? 'default-host');
  const result = ensureDiscoveryDefaults({
    workspaceId,
    hostUserId,
    timezone: typeof req.body?.timezone === 'string' ? req.body.timezone : undefined,
  });
  const profile = getOrCreatePublishProfile({ workspaceId, hostUserId });
  res.json({ ...result, publish: profile });
});

aivaVicalRouter.get('/event-types', (req: VicalRequest, res: Response) => {
  res.json({ items: listEventTypes(req.workspaceId!, { activeOnly: req.query.active === '1' }) });
});

aivaVicalRouter.post('/event-types', (req: VicalRequest, res: Response) => {
  try {
    const headerUser = req.headers['x-user-id'];
    const fromHeader = Array.isArray(headerUser) ? headerUser[0] : headerUser;
    const row = createEventType({
      workspaceId: req.workspaceId!,
      hostUserId: String(req.body?.hostUserId ?? fromHeader ?? 'default-host'),
      name: String(req.body?.name ?? 'Session'),
      slug: req.body?.slug,
      durationMinutes: req.body?.durationMinutes,
      bufferBeforeMinutes: req.body?.bufferBeforeMinutes,
      bufferAfterMinutes: req.body?.bufferAfterMinutes,
      minNoticeMinutes: req.body?.minNoticeMinutes,
      horizonDays: req.body?.horizonDays,
      locationMode: req.body?.locationMode,
      requiresApproval: Boolean(req.body?.requiresApproval),
      requiresDeposit: Boolean(req.body?.requiresDeposit),
      intakePoolId: req.body?.intakePoolId ?? null,
      active: req.body?.active,
      metadata: req.body?.metadata,
    });
    res.status(201).json(row);
  } catch (error) {
    sendError(res, error);
  }
});

aivaVicalRouter.patch('/event-types/:eventTypeId', (req: VicalRequest, res: Response) => {
  try {
    const row = updateEventType(req.workspaceId!, String(req.params.eventTypeId), req.body ?? {});
    res.json(row);
  } catch (error) {
    sendError(res, error);
  }
});

aivaVicalRouter.get('/intake-pools', (req: VicalRequest, res: Response) => {
  res.json({ items: listIntakePools(req.workspaceId!) });
});

aivaVicalRouter.post('/intake-pools', (req: VicalRequest, res: Response) => {
  try {
    const headerUser = req.headers['x-user-id'];
    const fromHeader = Array.isArray(headerUser) ? headerUser[0] : headerUser;
    const row = createIntakePool({
      workspaceId: req.workspaceId!,
      hostUserId: String(req.body?.hostUserId ?? fromHeader ?? 'default-host'),
      name: String(req.body?.name ?? 'Shared questions'),
      slug: req.body?.slug,
      questions: Array.isArray(req.body?.questions) ? req.body.questions : undefined,
      routingRules: Array.isArray(req.body?.routingRules) ? req.body.routingRules : undefined,
    });
    res.status(201).json(row);
  } catch (error) {
    sendError(res, error);
  }
});

aivaVicalRouter.patch('/intake-pools/:poolId', (req: VicalRequest, res: Response) => {
  try {
    res.json(
      updateIntakePool(req.workspaceId!, String(req.params.poolId), {
        name: req.body?.name,
        slug: req.body?.slug,
        questions: Array.isArray(req.body?.questions) ? req.body.questions : undefined,
        routingRules: Array.isArray(req.body?.routingRules) ? req.body.routingRules : undefined,
      }),
    );
  } catch (error) {
    sendError(res, error);
  }
});

aivaVicalRouter.delete('/intake-pools/:poolId', (req: VicalRequest, res: Response) => {
  const ok = deleteIntakePool(req.workspaceId!, String(req.params.poolId));
  res.status(ok ? 204 : 404).end();
});

aivaVicalRouter.get('/availability-rules', (req: VicalRequest, res: Response) => {
  const hostUserId = typeof req.query.hostUserId === 'string' ? req.query.hostUserId : undefined;
  res.json({ items: listAvailabilityRules(req.workspaceId!, hostUserId) });
});

aivaVicalRouter.post('/availability-rules', (req: VicalRequest, res: Response) => {
  try {
    const headerUser = req.headers['x-user-id'];
    const fromHeader = Array.isArray(headerUser) ? headerUser[0] : headerUser;
    const hostUserId = String(req.body?.hostUserId ?? fromHeader ?? 'default-host');
    if (Array.isArray(req.body?.replace)) {
      const items = replaceAvailabilityRules(
        req.workspaceId!,
        hostUserId,
        req.body.replace,
        req.body.timezone,
      );
      res.json({ items });
      return;
    }
    const row = createAvailabilityRule({
      workspaceId: req.workspaceId!,
      hostUserId,
      dayOfWeek: Number(req.body?.dayOfWeek ?? 1),
      startTime: String(req.body?.startTime ?? '09:00'),
      endTime: String(req.body?.endTime ?? '17:00'),
      timezone: req.body?.timezone,
      eventTypeId: req.body?.eventTypeId ?? null,
    });
    res.status(201).json(row);
  } catch (error) {
    sendError(res, error);
  }
});

aivaVicalRouter.get('/blackouts', (req: VicalRequest, res: Response) => {
  res.json({ items: listBlackouts(req.workspaceId!) });
});

aivaVicalRouter.post('/blackouts', (req: VicalRequest, res: Response) => {
  try {
    const row = createBlackout({
      workspaceId: req.workspaceId!,
      hostUserId: req.body?.hostUserId ?? null,
      startsOn: String(req.body?.startsOn),
      endsOn: String(req.body?.endsOn ?? req.body?.startsOn),
      reason: req.body?.reason,
    });
    res.status(201).json(row);
  } catch (error) {
    sendError(res, error);
  }
});

aivaVicalRouter.delete('/blackouts/:blackoutId', (req: VicalRequest, res: Response) => {
  const ok = deleteBlackout(req.workspaceId!, String(req.params.blackoutId));
  res.status(ok ? 204 : 404).end();
});

aivaVicalRouter.get('/bookings', (req: VicalRequest, res: Response) => {
  res.json({
    items: listBookings(req.workspaceId!, {
      status: typeof req.query.status === 'string' ? (req.query.status as never) : undefined,
      leadId: typeof req.query.leadId === 'string' ? req.query.leadId : undefined,
      guestEmail: typeof req.query.guestEmail === 'string' ? req.query.guestEmail : undefined,
    }),
  });
});

aivaVicalRouter.post('/bookings', async (req: VicalRequest, res: Response) => {
  try {
    const workerId = String(req.body?.workerId ?? req.headers['x-worker-id'] ?? '').trim();
    const useSaga = Boolean(workerId) || req.body?.useSaga === true || req.body?.idempotencyKey;
    if (useSaga) {
      const result = await bookWithSaga({
        workspaceId: req.workspaceId!,
        workerId: workerId || 'default-host',
        eventTypeId: String(req.body?.eventTypeId),
        guestName: String(req.body?.guestName ?? 'Guest'),
        guestEmail: String(req.body?.guestEmail ?? ''),
        startsAt: String(req.body?.startsAt),
        endsAt: req.body?.endsAt,
        timezone: req.body?.timezone,
        source: req.body?.source ?? 'api',
        leadId: req.body?.leadId,
        contactId: req.body?.contactId,
        notes: req.body?.notes,
        meetingUrl: req.body?.meetingUrl,
        staticRoomUrl: req.body?.staticRoomUrl,
        idempotencyKey: req.body?.idempotencyKey,
        metadata: req.body?.metadata,
      });
      res.status(result.duplicate ? 200 : 201).json({
        ...result.publicBooking,
        duplicate: result.duplicate,
        actionRequired: result.actionRequired,
        conferenceManaged: result.conferenceManaged,
        providerOperations: result.providerOperations,
      });
      return;
    }
    const row = createBooking({
      workspaceId: req.workspaceId!,
      eventTypeId: String(req.body?.eventTypeId),
      guestName: String(req.body?.guestName ?? 'Guest'),
      guestEmail: String(req.body?.guestEmail ?? ''),
      startsAt: String(req.body?.startsAt),
      endsAt: req.body?.endsAt,
      timezone: req.body?.timezone,
      source: req.body?.source ?? 'api',
      leadId: req.body?.leadId,
      contactId: req.body?.contactId,
      notes: req.body?.notes,
      meetingUrl: req.body?.meetingUrl,
      intakeAnswers: req.body?.intakeAnswers,
      metadata: req.body?.metadata,
      idempotencyKey: req.body?.idempotencyKey,
    });
    res.status(201).json(toPublicBookingView(row as unknown as Record<string, unknown>));
  } catch (error) {
    sendError(res, error);
  }
});

aivaVicalRouter.post('/bookings/:bookingId/approve', (req: VicalRequest, res: Response) => {
  try {
    res.json(approveBooking(req.workspaceId!, String(req.params.bookingId)));
  } catch (error) {
    sendError(res, error);
  }
});

aivaVicalRouter.post('/bookings/:bookingId/reject', (req: VicalRequest, res: Response) => {
  try {
    res.json(rejectBooking(req.workspaceId!, String(req.params.bookingId), req.body?.reason));
  } catch (error) {
    sendError(res, error);
  }
});

aivaVicalRouter.post('/bookings/:bookingId/cancel', async (req: VicalRequest, res: Response) => {
  try {
    const workerId = String(req.body?.workerId ?? req.headers['x-worker-id'] ?? 'default-host').trim();
    const result = await cancelWithSaga({
      workspaceId: req.workspaceId!,
      workerId,
      bookingId: String(req.params.bookingId),
      reason: req.body?.reason,
    });
    res.json({
      ...result.publicBooking,
      actionRequired: result.actionRequired,
      providerOperations: result.providerOperations,
    });
  } catch (error) {
    sendError(res, error);
  }
});

aivaVicalRouter.post('/bookings/:bookingId/reschedule', async (req: VicalRequest, res: Response) => {
  try {
    const workerId = String(req.body?.workerId ?? req.headers['x-worker-id'] ?? 'default-host').trim();
    const result = await rescheduleWithSaga({
      workspaceId: req.workspaceId!,
      workerId,
      bookingId: String(req.params.bookingId),
      startsAt: String(req.body?.startsAt),
      endsAt: req.body?.endsAt,
    });
    res.json({
      ...result.publicBooking,
      actionRequired: result.actionRequired,
      providerOperations: result.providerOperations,
    });
  } catch (error) {
    sendError(res, error);
  }
});

aivaVicalRouter.post('/bookings/:bookingId/outcome', (req: VicalRequest, res: Response) => {
  try {
    const outcome = req.body?.outcome === 'attended' || req.body?.outcome === 'no_show' ? req.body.outcome : null;
    if (!outcome) {
      res.status(400).json({ error: 'outcome must be attended or no_show' });
      return;
    }
    res.json(setSessionOutcome(req.workspaceId!, String(req.params.bookingId), outcome));
  } catch (error) {
    sendError(res, error);
  }
});

aivaVicalRouter.get('/slots', (req: VicalRequest, res: Response) => {
  try {
    const eventTypeId = String(req.query.eventTypeId ?? '');
    if (!eventTypeId) {
      res.status(400).json({ error: 'eventTypeId required' });
      return;
    }
    const slots = listOfferedSlots({
      workspaceId: req.workspaceId!,
      eventTypeId,
      limit: req.query.limit ? Number(req.query.limit) : 5,
      from: req.query.from ? new Date(String(req.query.from)) : undefined,
    });
    res.json({ items: slots });
  } catch (error) {
    sendError(res, error);
  }
});

// Public slug routes (still behind cloud proxy; resolve workspace from slug).
aivaVicalRouter.get('/public/:slug/event-types', (req: Request, res: Response) => {
  const workspaceId = resolveWorkspaceByPublicSlug(String(req.params.slug));
  if (!workspaceId) {
    res.status(404).json({ error: 'Unknown booking slug' });
    return;
  }
  res.json({ items: listEventTypes(workspaceId, { activeOnly: true }) });
});

aivaVicalRouter.get('/public/:slug/slots', (req: Request, res: Response) => {
  try {
    const workspaceId = resolveWorkspaceByPublicSlug(String(req.params.slug));
    if (!workspaceId) {
      res.status(404).json({ error: 'Unknown booking slug' });
      return;
    }
    const eventTypeId = String(req.query.eventTypeId ?? '');
    if (!eventTypeId) {
      res.status(400).json({ error: 'eventTypeId required' });
      return;
    }
    res.json({
      items: listOfferedSlots({
        workspaceId,
        eventTypeId,
        limit: req.query.limit ? Number(req.query.limit) : 5,
        from: req.query.from ? new Date(String(req.query.from)) : undefined,
      }),
    });
  } catch (error) {
    sendError(res, error);
  }
});

aivaVicalRouter.post('/public/:slug/bookings', (req: Request, res: Response) => {
  try {
    const workspaceId = resolveWorkspaceByPublicSlug(String(req.params.slug));
    if (!workspaceId) {
      res.status(404).json({ error: 'Unknown booking slug' });
      return;
    }
    const row = createBooking({
      workspaceId,
      eventTypeId: String(req.body?.eventTypeId),
      guestName: String(req.body?.guestName ?? 'Guest'),
      guestEmail: String(req.body?.guestEmail ?? ''),
      startsAt: String(req.body?.startsAt),
      endsAt: req.body?.endsAt,
      timezone: req.body?.timezone,
      source: 'public',
      notes: req.body?.notes,
      intakeAnswers: req.body?.intakeAnswers,
    });
    res.status(201).json(row);
  } catch (error) {
    sendError(res, error);
  }
});

aivaVicalRouter.get('/public/:slug/intake-pools/:eventTypeId', (req: Request, res: Response) => {
  const workspaceId = resolveWorkspaceByPublicSlug(String(req.params.slug));
  if (!workspaceId) {
    res.status(404).json({ error: 'Unknown booking slug' });
    return;
  }
  const eventType = listEventTypes(workspaceId, { activeOnly: true }).find((item) => item.id === String(req.params.eventTypeId));
  if (!eventType) {
    res.status(404).json({ error: 'Event type not found' });
    return;
  }
  const storePool = eventType.intakePoolId ? getIntakePool(workspaceId, eventType.intakePoolId) : null;
  res.json({
    eventTypeId: eventType.id,
    intakePool: storePool,
    questions: resolvedIntakeQuestions(eventType),
    routingRules: resolvedIntakeRoutingRules(eventType),
  });
});

aivaVicalRouter.post('/guest/:token/cancel', (req: Request, res: Response) => {
  try {
    res.json(cancelBookingForGuest(String(req.params.token), req.body?.reason));
  } catch (error) {
    sendError(res, error);
  }
});

aivaVicalRouter.post('/guest/:token/reschedule', (req: Request, res: Response) => {
  try {
    res.json(rescheduleBookingForGuest(String(req.params.token), String(req.body?.startsAt), req.body?.endsAt));
  } catch (error) {
    sendError(res, error);
  }
});

aivaVicalRouter.get('/guest/:token', (req: Request, res: Response) => {
  const booking = getBookingByGuestToken(String(req.params.token));
  if (!booking) {
    res.status(404).json({ error: 'Booking not found' });
    return;
  }
  res.json(booking);
});

aivaVicalRouter.get('/reminders', (req: VicalRequest, res: Response) => {
  const bookingId = typeof req.query.bookingId === 'string' ? req.query.bookingId : undefined;
  res.json({ reminders: listVicalReminders(req.workspaceId!, { bookingId }) });
});

aivaVicalRouter.post('/reminders/process-due', (req: VicalRequest, res: Response) => {
  res.json(processDueVicalReminders(req.workspaceId!));
});

aivaVicalRouter.get('/bookings/:id/ics', (req: VicalRequest, res: Response) => {
  const booking = listBookings(req.workspaceId!).find((b) => b.id === String(req.params.id));
  if (!booking) {
    res.status(404).json({ error: 'Booking not found' });
    return;
  }
  const ics = formatBookingIcs(booking);
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="booking-${booking.id}.ics"`);
  res.send(ics);
});

aivaVicalRouter.post('/bookings/:id/calendar-sync', async (req: VicalRequest, res: Response) => {
  const workerId =
    (typeof req.body?.workerId === 'string' && req.body.workerId.trim())
    || (typeof req.headers['x-worker-id'] === 'string' ? req.headers['x-worker-id'] : '')
    || '';
  if (!workerId) {
    res.status(400).json({ error: 'workerId required for calendar sync' });
    return;
  }
  try {
    const result = await syncBookingToGoogleCalendar({
      workspaceId: req.workspaceId!,
      workerId,
      bookingId: String(req.params.id),
      locationMode: req.body?.locationMode,
      zoomRoomUrl: typeof req.body?.zoomRoomUrl === 'string' ? req.body.zoomRoomUrl : undefined,
    });
    res.json(result);
  } catch (error) {
    sendError(res, error);
  }
});
