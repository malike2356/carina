import { completeWorkspacePrompt } from '@/lib/workspace-llm';

export interface ParsedCalendarEvent {
  title: string;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  description?: string;
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function setTime(date: Date, hours: number, minutes: number): Date {
  const next = new Date(date);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

function parseTimeToken(text: string): { hours: number; minutes: number } | null {
  const match = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  const meridiem = match[3]?.toLowerCase();
  if (meridiem === 'pm' && hours < 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;
  if (!meridiem && hours <= 7) hours += 12;
  return { hours, minutes };
}

function parseWeekdayToken(text: string, reference: Date): Date | null {
  const lower = text.toLowerCase();
  for (let i = 0; i < WEEKDAYS.length; i += 1) {
    const day = WEEKDAYS[i];
    if (!lower.includes(day)) continue;
    const target = i;
    const current = reference.getDay();
    let delta = target - current;
    if (delta <= 0) delta += 7;
    if (/\bnext\b/i.test(text)) delta += 7;
    return addDays(startOfDay(reference), delta);
  }
  return null;
}

export function parseNaturalLanguageEvent(
  phrase: string,
  reference = new Date(),
): ParsedCalendarEvent | null {
  const text = phrase.trim();
  if (!text) return null;

  let date = startOfDay(reference);
  let allDay = true;

  if (/\btoday\b/i.test(text)) date = startOfDay(reference);
  else if (/\btomorrow\b/i.test(text)) date = addDays(startOfDay(reference), 1);
  else {
    const weekday = parseWeekdayToken(text, reference);
    if (weekday) date = weekday;
  }

  const time = parseTimeToken(text);
  let startsAt = date;
  if (time) {
    startsAt = setTime(date, time.hours, time.minutes);
    allDay = false;
  } else if (/\bmorning\b/i.test(text)) {
    startsAt = setTime(date, 9, 0);
    allDay = false;
  } else if (/\bafternoon\b/i.test(text)) {
    startsAt = setTime(date, 14, 0);
    allDay = false;
  } else if (/\bevening\b/i.test(text)) {
    startsAt = setTime(date, 18, 0);
    allDay = false;
  }

  const endsAt = allDay
    ? null
    : new Date(startsAt.getTime() + 60 * 60 * 1000).toISOString();

  let title = text
    .replace(/\b(today|tomorrow|next|morning|afternoon|evening)\b/gi, '')
    .replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '')
    .replace(/\b\d{1,2}(:\d{2})?\s*(am|pm)?\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!title) title = 'New event';

  return {
    title: title.charAt(0).toUpperCase() + title.slice(1),
    startsAt: startsAt.toISOString(),
    endsAt: endsAt,
    allDay,
  };
}

export async function parseCalendarEventWithLlm(
  phrase: string,
  keys: Array<{ provider: string; apiKey: string }>,
  reference = new Date(),
): Promise<ParsedCalendarEvent | null> {
  const heuristic = parseNaturalLanguageEvent(phrase, reference);
  if (heuristic && !keys.length) return heuristic;

  if (!keys.length) return heuristic;

  try {
    const raw = await completeWorkspacePrompt(
      keys,
      `Parse calendar event requests. Return ONLY valid JSON with keys: title (string), startsAt (ISO string), endsAt (ISO string or null), allDay (boolean). Reference now: ${reference.toISOString()}.`,
      phrase,
    );
    const json = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim()) as ParsedCalendarEvent;
    if (!json.title || !json.startsAt) return heuristic;
    return {
      title: String(json.title),
      startsAt: String(json.startsAt),
      endsAt: json.endsAt ? String(json.endsAt) : null,
      allDay: Boolean(json.allDay),
    };
  } catch {
    return heuristic;
  }
}
