# Phase 4.2; Heartbeat System

## Task
Implement the heartbeat system. Carina periodically checks in on the user; inbox, calendar, mentions, weather; and can do background maintenance tasks during idle time.

## Specification

### Heartbeat cycle
- Interval: configurable, default ~30 minutes
- Quiet hours: 23:00-08:00 (skip unless urgent)
- Each heartbeat: run HEARTBEAT.md checklist, rotate through checks

### HEARTBEAT.md format
```markdown
# Heartbeat Checklist
- [ ] Check email inbox for urgent messages
- [ ] Check calendar for events in next 24h
- [ ] Check Twitter mentions
- [ ] Review recent daily memory files
- [ ] Update MEMORY.md if new insights found
```

### What to check (rotate, 2-4 times per day)
1. Emails: Any urgent unread messages?
2. Calendar: Upcoming events in next 24-48h?
3. Social mentions: Twitter/social notifications?
4. Weather: Relevant if user might go out?

### Heartbeat state tracking
Persist last check timestamps:
```json
{
  "lastChecks": {
    "email": 1703275200,
    "calendar": 1703260800,
    "weather": null
  }
}
```
Saved to: memory/heartbeat-state.json

### Memory maintenance during heartbeats
Periodically (every few days), during a heartbeat:
1. Read recent daily memory files (memory/YYYY-MM-DD.md)
2. Identify significant events, lessons, insights
3. Update MEMORY.md with distilled learnings
4. Remove outdated info from MEMORY.md

### When to reach out to user
- Important email arrived
- Calendar event coming up (less than 2 hours)
- Something interesting found
- It's been more than 8 hours since last message

### When to stay quiet (HEARTBEAT_OK)
- Late night (23:00-08:00) unless urgent
- User is clearly busy
- Nothing new since last check
- Just checked less than 30 minutes ago

### Proactive background work
Tasks the agent can do without asking:
- Read and organize memory files
- Check on projects (git status)
- Update documentation
- Commit and push agent's own changes
- Review and update MEMORY.md

### Implementation notes
- Heartbeat is a scheduled internal event, not a cron job
- Uses same tool set as normal sessions (but restricted)
- Heartbeat runs in a lightweight session context (minimal token usage)
- Results logged to memory/heartbeat-log.md

### Verification
```bash
# Trigger heartbeat manually
carina heartbeat

# Check heartbeat state
cat memory/heartbeat-state.json

# Verify memory maintenance ran
cat MEMORY.md
```
