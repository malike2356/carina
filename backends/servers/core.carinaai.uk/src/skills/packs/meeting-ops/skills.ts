import type { PackSkillInput } from '../../pack-types.js';

export const meetingOpsSkills: PackSkillInput[] = [
  {
    name: 'calendar-assistant',
    description: 'Find open slots, schedule meetings, reschedule with conflict detection, and summarize the week ahead',
    trigger: ['find slot', 'schedule meeting', 'reschedule', 'calendar', 'book meeting', 'weekly calendar', 'meeting conflict', 'availability'],
    steps: `1. Determine the request: find availability, schedule, reschedule, detect conflicts, or weekly summary.
2. Ask for the date range and timezone if not stated. Default to the user's stated timezone; ask on first use if unknown.
3. For availability: list free windows in the requested range clearly by day, time, and duration.
4. For scheduling: confirm title, time, duration, and attendees before creating the event. Read back the created event.
5. For rescheduling: retrieve the existing event details, propose the new time, get explicit approval before updating. Ask whether to notify attendees.
6. Conflict detection: before any create or update, check for overlapping events. Surface conflicts and suggest alternatives. Never double-book.
7. Weekly summary: fetch all events for the next 7 days and return a structured day-by-day list with event names, times, and durations.
8. Never invent event data. Confirm every write action back to the user with full details.
9. Never delete events without explicit "Are you sure?" confirmation naming the event.`,
    toolsUsed: ['http-request', 'send-message'],
  },
  {
    name: 'zoom-recap',
    description: 'Transform a Zoom meeting transcript or notes into a structured recap with summary, decisions, and action items',
    trigger: ['zoom recap', 'meeting recap', 'meeting summary', 'meeting notes', 'action items from meeting', 'decisions from meeting'],
    steps: `1. Accept the meeting transcript or notes from the user (pasted or via file-read).
2. Extract and produce exactly these sections:
   - Summary: 2-4 sentences covering the meeting purpose and outcome.
   - Topics Discussed: bulleted list in chronological order.
   - Key Decisions: bulleted list, each attributed to the person who stated it.
   - Action Items: bulleted list formatted as "[ ] <task> -- Owner: <name> -- Due: <date or TBD>".
   - Open Questions: unresolved questions raised during the meeting.
3. Use only information present in the transcript. Never invent participants, decisions, or action items.
4. If the transcript is too short or unintelligible, output a minimal summary noting "Transcript insufficient for full recap."
5. If participant names are unclear, use "Unknown Speaker" rather than guessing.
6. Offer to save the recap to a file or send via email/Slack if the user wants.`,
    toolsUsed: ['file-read', 'file-write', 'send-message'],
  },
  {
    name: 'competitive-intel-sweep',
    description: 'Daily sweep of competitor activity using web search, producing a structured digest of new moves',
    trigger: ['competitor intel', 'competitive intelligence', 'competitor activity', 'competitor news', 'market intel', 'competitive sweep'],
    steps: `1. Ask for: list of competitors to monitor, topic focus areas (funding, product launches, partnerships, pricing, leadership, regulatory), lookback window (default 24h).
2. For each competitor and each topic, run a targeted web-search combining the competitor name and the topic.
3. Deduplicate results by URL. Discard results with low relevance or outside the lookback window.
4. For each unique result, extract: title, source, URL, date, and a 1-2 sentence summary. Never embellish facts beyond what the search returns.
5. Group findings by competitor, then by topic.
6. Compose a structured digest:
   - Header: "Competitive Intel Digest -- {date}"
   - Per competitor: bold name, then bulleted items with [Topic] Title -- 1-sentence summary (URL).
   - If no activity found for a competitor, note "No notable activity detected."
   - Footer: total results, sources scanned, and disclaimer "Verify before acting."
7. If a search fails, note the gap with a warning and continue with remaining queries.
8. Limit to top 40 results if more than 40 are found; note the truncation.`,
    toolsUsed: ['web-search', 'http-request', 'send-message'],
  },
];
