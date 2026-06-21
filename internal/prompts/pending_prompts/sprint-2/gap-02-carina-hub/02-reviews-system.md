# Gap 02 - File 2: Hub Reviews System

Agent: Claude Code (primary), Codex (fallback)
Estimated time: 3-4 hours

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Context

The Carina Skills Hub at `core.carinaai.uk/src/skills/hub/server.ts` has
pack and skill APIs but no review or rating system. We need to add:

- A `hub_skill_reviews` database table
- `rating_avg` and `review_count` columns on `hub_skills`
- `POST /api/v1/skills/:pack/:name/reviews` to submit a review
- `GET /api/v1/skills/:pack/:name/reviews` to read reviews
- A trigger that recalculates averages after each insert
- Rate limiting: one review per author per skill

The existing server uses PostgreSQL via `hubPool` imported from
`./migrations.js`. All SQL must use parameterised queries via the pool.
The server already has IP-based rate limiting for publish - mirror that
pattern for reviews.

---

## Step 1: Read these files first

1. `src/skills/hub/migrations.ts` - full file; understand the schema for
   `skill_packs` and `hub_skills`, and how `HUB_SCHEMA` and `HUB_ALTER`
   are structured, and how `initHubDb()` runs them
2. `src/skills/hub/server.ts` - full file; pay attention to the
   `createSkillsHubApp()` function, the CORS middleware, the rate limiter,
   and the existing GET `/api/skills/:pack/:name` handler (you must add
   the new routes after the existing routes, before the error handler)
3. `src/skills/hub/registry.ts` - find `getHubSkill()` and
   `listHubSkills()` to understand the return type shapes

---

## Step 2: Add migrations in migrations.ts

In `src/skills/hub/migrations.ts`, append a new constant and call it
from `initHubDb()`. Do not edit the existing `HUB_SCHEMA` or `HUB_ALTER`
strings.

Add after the `HUB_ALTER` constant:

```typescript
const HUB_REVIEWS_SCHEMA = `
ALTER TABLE hub_skills ADD COLUMN IF NOT EXISTS rating_avg NUMERIC(3,2) NOT NULL DEFAULT 0;
ALTER TABLE hub_skills ADD COLUMN IF NOT EXISTS review_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS hub_skill_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_name TEXT NOT NULL,
  skill_name TEXT NOT NULL,
  author_id TEXT NOT NULL,
  rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hub_skill_reviews_unique_author UNIQUE (pack_name, skill_name, author_id),
  CONSTRAINT hub_skill_reviews_skill_fk FOREIGN KEY (pack_name, skill_name)
    REFERENCES hub_skills (pack_name, name) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS hub_skill_reviews_skill_idx
  ON hub_skill_reviews (pack_name, skill_name);

CREATE OR REPLACE FUNCTION hub_update_skill_rating()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE hub_skills
  SET
    rating_avg = (
      SELECT COALESCE(AVG(rating), 0)
      FROM hub_skill_reviews
      WHERE pack_name = NEW.pack_name AND skill_name = NEW.skill_name
    ),
    review_count = (
      SELECT COUNT(*)
      FROM hub_skill_reviews
      WHERE pack_name = NEW.pack_name AND skill_name = NEW.skill_name
    )
  WHERE pack_name = NEW.pack_name AND name = NEW.skill_name;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hub_skill_rating_trigger ON hub_skill_reviews;
CREATE TRIGGER hub_skill_rating_trigger
  AFTER INSERT OR UPDATE OR DELETE ON hub_skill_reviews
  FOR EACH ROW EXECUTE FUNCTION hub_update_skill_rating();
`;
```

Inside `initHubDb()`, after the two existing `await hubPool.query(...)` calls,
add:

```typescript
await hubPool.query(HUB_REVIEWS_SCHEMA);
```

---

## Step 3: Add review rate limiter in server.ts

In `src/skills/hub/server.ts`, after the `publishRateHits` map
declaration, add a parallel rate limiter for reviews (one per author per
skill per 24 hours):

```typescript
const REVIEW_RATE_WINDOW_MS = 24 * 60 * 60 * 1000;
const reviewRateHits = new Map<string, number>();

function reviewRateLimit(authorId: string, packName: string, skillName: string, res: Response): boolean {
  const key = `${authorId}:${packName}:${skillName}`;
  const last = reviewRateHits.get(key) ?? 0;
  const now = Date.now();
  if (now - last < REVIEW_RATE_WINDOW_MS) {
    res.status(429).json({ error: 'You have already submitted a review for this skill recently.' });
    return false;
  }
  reviewRateHits.set(key, now);
  return true;
}
```

---

## Step 4: Add POST /api/v1/skills/:pack/:name/reviews to server.ts

Inside `createSkillsHubApp()`, add after the existing
`GET /api/skills/:pack/:name` handler (around line 200):

```typescript
app.post('/api/v1/skills/:pack/:name/reviews', async (req, res, next) => {
  try {
    const { pack, name } = req.params;
    const { rating, body, author_id } = req.body as {
      rating?: unknown;
      body?: unknown;
      author_id?: unknown;
    };

    const ratingNum = Number(rating);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      res.status(400).json({ error: 'rating must be an integer 1-5' });
      return;
    }
    const authorId = String(author_id ?? '').trim();
    if (!authorId || authorId.length > 128) {
      res.status(400).json({ error: 'author_id is required (max 128 chars)' });
      return;
    }
    const reviewBody = String(body ?? '').trim().slice(0, 2000);

    if (!reviewRateLimit(authorId, pack, name, res)) return;

    const { hubPool } = await import('./migrations.js');
    await hubPool.query(
      `INSERT INTO hub_skill_reviews (pack_name, skill_name, author_id, rating, body)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT ON CONSTRAINT hub_skill_reviews_unique_author
       DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body`,
      [pack, name, authorId, ratingNum, reviewBody],
    );

    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});
```

---

## Step 5: Add GET /api/v1/skills/:pack/:name/reviews to server.ts

Immediately after the POST handler:

```typescript
app.get('/api/v1/skills/:pack/:name/reviews', async (req, res, next) => {
  try {
    const { pack, name } = req.params;
    const limit = Math.min(Number(req.query.limit ?? 20), 100);
    const offset = Number(req.query.offset ?? 0);

    const { hubPool } = await import('./migrations.js');
    const result = await hubPool.query<{
      id: string;
      author_id: string;
      rating: number;
      body: string;
      created_at: string;
    }>(
      `SELECT id, author_id, rating, body, created_at
       FROM hub_skill_reviews
       WHERE pack_name = $1 AND skill_name = $2
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [pack, name, limit, offset],
    );

    const countResult = await hubPool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM hub_skill_reviews WHERE pack_name = $1 AND skill_name = $2`,
      [pack, name],
    );

    res.json({
      reviews: result.rows,
      total: Number(countResult.rows[0]?.count ?? 0),
      limit,
      offset,
    });
  } catch (err) {
    next(err);
  }
});
```

---

## Files to create or modify

| File | Action |
|---|---|
| `src/skills/hub/migrations.ts` | MODIFY (HUB_REVIEWS_SCHEMA + call in initHubDb) |
| `src/skills/hub/server.ts` | MODIFY (rate limiter + 2 new routes) |

No new files are needed.

---

## Done-when criteria

- [ ] `pnpm build` completes without TypeScript errors
- [ ] After `initHubDb()` runs, the database has `hub_skill_reviews` table
  with the UNIQUE constraint and the trigger
- [ ] `hub_skills` table has `rating_avg` and `review_count` columns
- [ ] `POST /api/v1/skills/:pack/:name/reviews` with a valid body returns
  201 and the trigger updates `rating_avg` on the row
- [ ] Submitting a second review from the same `author_id` within 24 hours
  returns 429
- [ ] `GET /api/v1/skills/:pack/:name/reviews` returns paginated reviews
  with `total`, `limit`, `offset` fields
- [ ] `pnpm test` still passes

---

## Do NOT do

- Do not add an admin endpoint to delete reviews (out of scope)
- Do not add authentication middleware to the review routes (author_id is
  self-reported; authentication is a separate gap)
- Do not change the existing `/api/skills/:pack/:name` GET response shape
