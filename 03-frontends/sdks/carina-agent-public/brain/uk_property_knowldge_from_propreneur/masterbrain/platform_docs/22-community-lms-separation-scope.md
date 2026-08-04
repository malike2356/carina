# Community vs LMS Separation - Scope Assessment

**Date:** 7 May 2026  
**Goal:** Split the current bundled `CommunityLearning` module into two independent modules without breaking existing functionality.

---

## Current State

One module: `BillingModule::CommunityLearning` (value: `community_learning`)
One feature flag: `community_learning`
One sidebar link: "Community"
One route prefix: `community`
One Alpine component: `community-hub.js`

---

## What Goes Where

### Community (Social Layer)
- `community_posts` - Member posts/announcements
- `community_comments` - Post comments
- `community_post_likes` - Post likes
- `groups` - Member groups
- `group_members` - Group membership
- `group_events` - Group events
- `group_event_attendees` - Event attendance
- Mentorship session listings (viCal bookings tied to mentorship)

### LMS (Learning Layer)
- `courses` - Course definitions
- `course_modules` - Course modules/lessons
- `course_assignments` - User course enrollment + progress + completion + certification
- `quizzes` - Quiz definitions
- `quiz_questions` - Quiz questions
- `quiz_attempts` - User quiz attempts + auto-grading
- `learning_paths` - Learning path definitions
- `learning_path_assignments` - User learning path assignments
- `badges` - Badge definitions
- `user_badges` - Earned badges

---

## What Needs to Change (Without Breaking Things)

### 1. Backward-Compatible Module Registry

```php
// Keep existing for old subscribers - no breaking change
case CommunityLearning = 'community_learning';

// New module
case Lms = 'lms';
```

Existing tenants with `community_learning` enabled keep access to both. New tenants can subscribe to either.

### 2. Feature Flags (Central DB)

```
community  → keeps existing name with narrower scope (posts, groups only)
lms       → new flag for courses, quizzes, learning paths, badges
```

Only affects tenants enabling/disabling features - no data migration needed.

### 3. Route Separation

**Keep existing** `tenant-community-learning.php` routes under `community/` prefix for backward compat.

**Add new** `tenant-lms.php` routes under `lms/` prefix.

Clarify the API controller namespaces:
- `Api/Community/` - social endpoints
- `Api/Lms/` - learning endpoints

### 4. Database - NO CHANGES NEEDED

Tables are already separate. No schema changes required. The `community_` prefix tables are the social layer; `courses`, `quizzes`, `badges`, `learning_paths` tables are the learning layer. They just need their own feature flags.

### 5. Views

- Keep `views/tenant/community/index.blade.php` as-is for Community
- Create `views/tenant/lms/` with a proper LMS interface:
  - Course catalog & player (lesson viewer)
  - Quiz taker (interactive)
  - Learning path visualiser
  - Badge showcase
  - Certificate viewer/download
  - Progress dashboard (mentor view)
  - Grading/reports

### 6. Alpine Components

- `community-hub.js` - keep for social features (posts, groups, mentorship sessions)
- New `lms-hub.js` - for courses, quizzes, learning paths

### 7. Sidebar Navigation

Add a new sidebar entry for LMS, separate from Community.

---

## Effort Estimate

| Layer | Effort | Risk |
|-------|--------|------|
| **BillingModule + FeatureFlags** | Low (add enum case + flag) | None - additive only |
| **Routes** | Low (new route file, update existing) | None - existing routes untouched |
| **Controllers** | Medium (refactor namespaces, keep backward compat) | Low - API contracts stay the same |
| **Database** | None | Zero - no migration needed |
| **Community UI** | None | Zero - untouched |
| **LMS UI (new)** | High - needs to be built from scratch | Depends on scope |
| **Sidebar** | Low (add menu entry) | None |

**Estimated total: 2-3 days for the separation plumbing (routes, flags, sidebar).**
**LMS frontend build: 1-2 weeks depending on scope.**

---

## Key Principle

**Add, don't change.** No existing subscribers lose access. No database migrations. No renamed tables. New LMS module sits alongside the existing Community module. They share the same database tables but are gated by separate feature flags and billing modules.
