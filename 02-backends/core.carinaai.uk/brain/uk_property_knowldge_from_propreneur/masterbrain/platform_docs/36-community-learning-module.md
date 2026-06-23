# Community and learning (tenant)

**Last updated:** 2026-05-14 (message endpoints, badge awards, deal sharing, group events)

**Purpose:** Document the shipped tenant slice for community posts, groups, courses, quizzes, learning paths, mentorship messaging, and badges. This is distinct from the high-level "Mentoring OS" product roadmap in `memory.md`; the JSON API and schema here are real and gated.

## Billing and features

- Subscription module: `App\Billing\BillingModule::CommunityLearning` (`community_learning`).
- Route middleware on both Blade hub and API: `subscription.feature:community_learning` and `feature:community_learning`.

## Tenant migration (tables)

Single migration: `database/migrations/tenant/2026_05_02_300000_create_community_learning_tables.php`.

Core tables: `community_posts`, `community_post_likes`, `community_comments`, `groups`, `group_members`, `group_events`, `group_event_attendees`, `courses`, `course_modules`, `course_assignments`, `quizzes`, `quiz_questions`, `quiz_attempts`, `learning_paths`, `learning_path_assignments`, `mentorship_relationships`, `mentorship_messages`, `badges`, `user_badges`.

Later migrations extend mentorship for programmes and viCal (see `58-mentoring-os-tenant-surface.md` and `31-vcal-booking-module.md`).

## Blade hub

- `GET /community` (`tenant.community.index`), `CommunityLearningController@index`.
- Same feature gates as the API.

## JSON API (authenticated tenant user)

Included from `routes/tenant.php` inside the authenticated `Route::prefix('api')` group via `routes/tenant-community-learning.php`.

Base path on the workspace host: **`/api/`** plus the groups below (examples: `/api/community/posts`, `/api/courses`, `/api/mentorships`).

| Prefix | Controllers under `App\Http\Controllers\Api\CommunityLearning` |
| --- | --- |
| `community/posts`, likes, comments | `CommunityPostController`, `CommunityCommentController` |
| `groups`, `groups/{id}/events`, attend | `GroupController`, `GroupEventController` |
| `courses`, modules, enroll, progress, certify | `CourseController`, `CourseModuleController`, `CourseEnrollmentController` |
| `courses/{course}/quizzes`, `quizzes/{quiz}`, attempts | `QuizController`, `QuizAttemptController` |
| `learning-paths`, assign, progress | `LearningPathController`, `LearningPathAssignmentController` |
| `mentorships`, messages, read | `MentorshipController`, `MentorshipMessageController` |
| `badges`, `achievements/progress`, `badges/my` | `BadgeController`, `AchievementController` |

## Carina

- `CarinaController` deep link: `GET /carina/open-community-post/{postId}` (`tenant.carina.fromCommunityPost`).
- Valid `context_type` for conversations: `community_post` (and `course`, `mentorship` for other surfaces; see `08-carina.md`).

## Services

- `App\Services\CommunityLearning\CommunityService.php` (tenant assertions and shared checks used by API controllers).

## Tests

Search under `tests/Feature` for `Community` or `community` to find API and web coverage as the suite grows.

## Related knowledge

- `08-carina.md` (context types).
- `22-tenant-route-map.md` (middleware patterns).
- `58-mentoring-os-tenant-surface.md` (programmes, cohorts, `/mentoring` hub).
