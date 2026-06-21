# 154 - Academy Module

## What the Module Does

The Academy module provides tenant-scoped, self-paced learning tracks for property investors. Each workspace can host its own set of learning tracks (topics) and lessons (articles). Users read lessons at their own pace; the module records when a lesson is first viewed and when the user marks it complete.

The module is entirely separate from the external Propreneur Academy (SSO to a dedicated workspace) and from the LMS/CommunityLearning module. It is a lightweight, in-workspace knowledge base with per-user progress.

## Feature Flag

Key: `academy`
Default: `false` (must be enabled per tenant by a platform admin at /admin/feature-flags)
Category: `modules`

The flag gates all three HTTP routes and the two Carina tools. When disabled, the `/academy` path is inaccessible and the nav link is hidden.

## Routes and Route Names

All routes require `auth` (implicit via the authenticated middleware group) and `feature:academy`.
Prefix: `/academy`
Name prefix: `tenant.academy.`

| Method | URI | Name | Action |
|--------|-----|------|--------|
| GET | /academy | `tenant.academy.index` | `AcademyController@index` |
| GET | /academy/{track} | `tenant.academy.track` | `AcademyController@track` |
| GET | /academy/{track}/{lesson} | `tenant.academy.lesson` | `AcademyController@lesson` |
| POST | /academy/{track}/{lesson}/complete | `tenant.academy.lesson.complete` | `AcademyController@complete` |

`{track}` and `{lesson}` are URL slugs (strings), not database IDs.

## Data Model

Three tenant-scoped tables:

### academy_tracks

| Column | Type | Notes |
|--------|------|-------|
| id | bigint PK | |
| slug | string unique | URL-safe identifier, e.g. `btl-fundamentals` |
| title | string | |
| description | text | Long description shown on track page |
| excerpt | string(300) | Short summary shown on index card |
| icon | string nullable | SVG path data or icon identifier |
| order | unsignedTinyInteger | Sort order on the index page |
| total_lessons | unsignedSmallInteger | Denormalised count; update when adding/removing lessons |
| timestamps | | |

### academy_lessons

| Column | Type | Notes |
|--------|------|-------|
| id | bigint PK | |
| track_id | bigint FK | Cascades on delete |
| slug | string | Unique within a track |
| title | string | |
| excerpt | string(500) | Shown in track lesson list |
| content | longText | Markdown source rendered via `Str::markdown()` |
| order | unsignedSmallInteger | Sort order within the track |
| estimated_minutes | unsignedSmallInteger | Reading time hint shown to the user |
| timestamps | | |
| unique | (track_id, slug) | |

### academy_lesson_progress

| Column | Type | Notes |
|--------|------|-------|
| id | bigint PK | |
| user_id | bigint FK | Cascades on delete |
| lesson_id | bigint FK | Cascades on delete |
| viewed_at | timestamp nullable | Set on first lesson page visit |
| completed_at | timestamp nullable | Set when user clicks "Mark as complete" |
| timestamps | | |
| unique | (user_id, lesson_id) | |

## Models

- `App\Models\Tenant\AcademyTrack` - hasMany AcademyLesson; appended `progress_percent` resolves via Auth::user()
- `App\Models\Tenant\AcademyLesson` - belongsTo AcademyTrack; hasMany AcademyLessonProgress; `isCompletedBy(User $user): bool`
- `App\Models\Tenant\AcademyLessonProgress` - belongsTo User and AcademyLesson

## Service

`App\Services\Academy\AcademyService`

| Method | Returns | Description |
|--------|---------|-------------|
| `getTracks(User $user)` | `Collection<AcademyTrack>` | All tracks with resolved progress percentage (no N+1) |
| `getTrack(string $slug, User $user)` | `AcademyTrack` | Track with lessons, each annotated `is_viewed`, `is_completed` |
| `getLesson(AcademyTrack, string $lessonSlug, User)` | `AcademyLesson` | Lesson; sets `viewed_at` on first access |
| `markComplete(AcademyLesson, User)` | `void` | Upserts `completed_at` (and `viewed_at`) |
| `getProgress(User)` | `array{total_lessons,completed,percent}` | Platform-wide stats for the user |

## Progress Tracking Mechanics

1. **View event** - When a user lands on `academy.lesson`, `AcademyService::getLesson()` calls `markViewed()`. If no progress row exists it creates one with `viewed_at = now()`. If a row exists with `viewed_at = null`, it updates it. Already-viewed rows are not touched.

2. **Complete event** - When a user submits the "Mark as complete" form (POST to `academy.lesson.complete`), `AcademyService::markComplete()` uses `updateOrCreate` to set both `completed_at` and `viewed_at` to `now()`.

3. **Progress percentage** - Calculated as `floor(completed_lesson_count / total_lessons * 100)`. The `total_lessons` column on `academy_tracks` is a denormalised integer; it must be kept in sync when lessons are added or removed (seed scripts, admin tools, or observers as appropriate).

4. **Conflict safety** - The `(user_id, lesson_id)` unique constraint prevents duplicate rows.

## Views

- `resources/views/tenant/academy/index.blade.php` - overall progress bar, grid of track cards with icon, title, excerpt, lesson count, and per-track progress bar
- `resources/views/tenant/academy/track.blade.php` - breadcrumb, track description, ordered lesson list with completion ticks, duration, links
- `resources/views/tenant/academy/lesson.blade.php` - breadcrumb, markdown content rendered via `Str::markdown()`, "Mark as complete" button (hidden once completed), previous/next lesson navigation

## Navigation

The **Academy** nav link in the Overview section points to **free platform courses** at `tenant.platform-academy.catalogue` (`/platform-academy/learn`). It appears when:

1. `\Illuminate\Support\Facades\Route::has('tenant.platform-academy.catalogue')` is true
2. The user is authenticated on a normal workspace (not the dedicated `academy` host)
3. No billing module is required (`community_learning` is not used for this link)

`PlatformAcademyAccess` reads published courses from the shared **academy tenant** database and bridges the workspace user by email for enrollments, progress, quizzes, and certificates. Carina teaching mode uses `AcademyTeachingPromptService` when `platform_academy.active` is in the session.

In-workspace **tracks** at `/academy` (`tenant.academy.*`) remain available when the `academy` feature flag is on; they are separate from platform courses.

Workspace **LMS** at `/lms` (`tenant.lms.*`) is for mentoring programme courses created inside each tenant, not the platform Academy catalogue.

Workspace users are **not** sent to `academy.{domain}` via SSO from this link. The separate Academy subdomain remains for certificate courses and admin sync; learners who arrive there via legacy SSO see **Back to workspace** when `academy.source_workspace` is in the session (`LayoutComposer` builds the URL with `TenantWorkspaceUrl`).

Icon: open book SVG path.

## How Carina Uses It

Two tools are registered in `CarinaToolRegistry` via `AppServiceProvider`.

### `list_academy_tracks`

- **Class:** `App\Services\Carina\Tools\ListAcademyTracksTool`
- **Authorization:** `academy` feature flag enabled for the tenant
- **Returns:** array of tracks, each with `slug`, `title`, `excerpt`, `total_lessons`, `completed_lessons`, `progress_percent` for the current user
- **Use case:** Answer questions such as "What learning tracks do I have?" or "How far through BTL Fundamentals am I?"

### `get_academy_lesson`

- **Class:** `App\Services\Carina\Tools\GetAcademyLessonTool`
- **Authorization:** `academy` feature flag enabled for the tenant
- **Parameters:** `track_slug` (required), `lesson_slug` (required)
- **Returns:** `track_slug`, `track_title`, `lesson_slug`, `title`, `excerpt`, `content` (raw Markdown), `estimated_minutes`, `is_completed`
- **Use case:** Retrieve lesson content so Carina can summarise, explain, or answer questions about it

## Pest Tests

`tests/Feature/Academy/AcademyModuleTest.php`

- tenant user can view academy index
- tenant user can view a track
- tenant user can view a lesson and viewed_at is set
- tenant user can mark a lesson complete
- unauthenticated user is redirected from academy
