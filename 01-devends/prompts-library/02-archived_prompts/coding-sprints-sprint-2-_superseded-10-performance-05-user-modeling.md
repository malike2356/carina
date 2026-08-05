# Prompt 05: User Modeling for Reduced Cold-Start Latency


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Context

Every new Carina session starts cold: no context about the user's preferences, current
projects, or working style. The system prompt must be reconstructed from scratch. User
modeling precomputes a "user profile" that is injected into every session, reducing the
latency and prompt tokens needed to establish context.

## What to Build

### 1. User profile schema

Create `src/memory/user-model.ts`:
```typescript
export type UserProfile = {
  userId: string;
  updatedAt: Date;
  preferences: {
    responseStyle: 'brief' | 'detailed' | 'technical';
    preferredModel?: string;
    language: string;
    timezone: string;
  };
  workingContext: {
    activeProjects: string[]; // IDs of most active projects
    recentTopics: string[]; // last 10 distinct topics discussed
    frequentTools: string[]; // top 5 tools used in last 30 days
    frequentSkills: string[]; // top 5 skills used in last 30 days
  };
  behaviorPatterns: {
    peakHours: number[]; // hours of day most active (UTC)
    avgSessionLength: number; // minutes
    avgMessagesPerSession: number;
    morningUser: boolean; // sends first message before 9 AM
  };
};
```

Store in `user_profiles` table:
```sql
CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  profile JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 2. Profile builder

Create `src/memory/profile-builder.ts`:
```typescript
export async function buildUserProfile(userId: string): Promise<UserProfile> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

  // Recent topics from session messages
  const sessions = await db.query(
    `SELECT messages FROM sessions WHERE user_id = $1 AND created_at > $2 ORDER BY created_at DESC LIMIT 20`,
    [userId, thirtyDaysAgo]
  );

  // Extract topics via simple keyword extraction (no LLM call needed)
  const topics = extractTopics(sessions.rows.flatMap(s => s.messages));

  // Tool usage frequency
  const toolUsage = await db.query(
    `SELECT tool_name, COUNT(*) as count FROM tool_executions
     WHERE user_id = $1 AND executed_at > $2
     GROUP BY tool_name ORDER BY count DESC LIMIT 5`,
    [userId, thirtyDaysAgo]
  );

  // Active projects (sessions linked to projects)
  const activeProjects = await db.query(
    `SELECT project_id, COUNT(*) as activity FROM sessions
     WHERE user_id = $1 AND project_id IS NOT NULL AND created_at > $2
     GROUP BY project_id ORDER BY activity DESC LIMIT 5`,
    [userId, thirtyDaysAgo]
  );

  return {
    userId,
    updatedAt: new Date(),
    preferences: await loadUserPreferences(userId),
    workingContext: {
      activeProjects: activeProjects.rows.map(r => r.project_id),
      recentTopics: topics.slice(0, 10),
      frequentTools: toolUsage.rows.map(r => r.tool_name),
      frequentSkills: [],  // similar query on skill_executions
    },
    behaviorPatterns: computeBehaviorPatterns(sessions.rows),
  };
}
```

### 3. Profile injection into system prompt

In `src/agents/CarinaAgent.ts`, prepend the user profile to the system prompt:
```typescript
const profile = await getUserProfile(userId);
const profileSummary = renderProfileSummary(profile);

const systemPrompt = `
${baseSystemPrompt}

USER CONTEXT (auto-populated from profile):
${profileSummary}
`;
```

`renderProfileSummary` produces:
```
Active projects: Scout Dashboard Redesign, ABBIS Billing Module
Recent topics: CVE management, nginx configuration, TypeScript
Frequent tools: nmap, nikto, web-search
Preferred style: technical, detailed
Timezone: Europe/London (morning user)
```

### 4. Profile refresh cron

Rebuild profiles nightly to capture the day's activity:
```typescript
// In src/agents/checks/, or a dedicated nightly cron:
export async function refreshAllUserProfiles(): Promise<void> {
  const users = await db.query('SELECT id FROM users WHERE active = true');
  for (const user of users.rows) {
    const profile = await buildUserProfile(user.id);
    await db.query(
      'INSERT INTO user_profiles (user_id, profile, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (user_id) DO UPDATE SET profile = $2, updated_at = NOW()',
      [user.id, profile]
    );
  }
}
```

### 5. Profile API

```
GET  /api/profile            - get current user's profile
PUT  /api/profile/preferences - update preferences
POST /api/profile/refresh    - trigger immediate profile rebuild
```

## Verification Checklist

- [ ] After 5+ sessions, `GET /api/profile` returns a profile with recent topics populated
- [ ] Profile summary appears at the top of system prompt in ops debug view
- [ ] New session: Carina references an active project without being told which project to work on
- [ ] Update preference to `responseStyle: 'brief'` - subsequent responses are shorter
- [ ] Profile refreshes nightly (cron fires inside the Docker container; verify with `docker compose logs carina-web | grep "profile refresh"`)

## Files to Create or Modify

- CREATE `src/memory/user-model.ts`
- CREATE `src/memory/profile-builder.ts`
- MODIFY `src/agents/CarinaAgent.ts` - inject profile summary into system prompt
- CREATE `src/api/profile.ts`
- MODIFY `src/server.ts` - mount profile API
- MODIFY `docker/postgres/init.sql` - add user_profiles table
