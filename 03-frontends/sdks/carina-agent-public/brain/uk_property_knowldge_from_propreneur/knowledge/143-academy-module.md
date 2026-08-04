# Academy Module

**Last updated:** 2026-05-20

## Overview

The Academy is a dedicated learning workspace that converts Carina's `brain/knowledge/` markdown files into structured courses with modules, quizzes, and certificates. It runs as a separate subdomain (`academy.{tenant_base_domain}`) and is identified by the `is_academy` tenant setting or by matching the `academy_workspace_slug` platform setting. Workspace users authenticate via one-click SSO from their normal portal; external learners can self-register directly.

## Key tables

All tables are in the tenant database.

| Table | Key columns |
|---|---|
| `courses` | `id`, `name`, `slug`, `description`, `featured_image`, `source_knowledge_file`, `source_file_hash`, `category`, `difficulty` (`beginner`/`intermediate`/`advanced`), `estimated_minutes`, `status` (`draft`/`published`/`archived`), `is_published`, `video_source`, `video_url`, `video_path`, `video_mime_type`, `video_size_bytes` |
| `course_modules` | `id`, `course_id`, `title`, `content` (markdown), `sort_order`, `video_source`, `video_url`, `video_path`, `video_mime_type`, `video_size_bytes` |
| `course_module_completions` | `id`, `user_id`, `course_module_id`, `course_id`, `completed_at`; unique on `(user_id, course_module_id)` |
| `course_assignments` | `id`, `user_id`, `course_id`, `enrolled_at`, `progress_percent`, `completed_at`, `certified_at`, `certificate_code` |
| `quizzes` | `id`, `course_id`, `course_module_id`, `title`, `passing_score` (default 70) |
| `quiz_questions` | `id`, `quiz_id`, `question`, `options` (JSONB), `correct_answer` (JSONB `{value}`), `explanation`, `type` (`multiple_choice`) |
| `quiz_attempts` | `id`, `quiz_id`, `user_id`, `passed`, `completed_at` |
| `academy_sso_tokens` | Central DB. `token_hash`, `email`, `source_tenant_id`, `platform_user_id`, `expires_at`, `used_at` |
| `academy_knowledge_sync_log` | `id`, `filename`, `file_hash`, `course_id`, `status` (`ok`/`failed`/`system_guide`), `tokens_in`, `tokens_out`, `processed_at`, `error` |

## Routes / entry points

Academy routes are defined in `routes/academy.php` and loaded via `routes/tenant.php` under the `academy.workspace` middleware.

| Route | Name | Description |
|---|---|---|
| `GET /academy` | `academy.dashboard` | Learner dashboard - enrolled courses, certificates, badges |
| `GET /academy/catalogue` | `academy.catalogue` | Browse all published courses |
| `GET /academy/courses/{course}` | `academy.course.show` | View course content by session number |
| `POST /academy/courses/{course}/enroll` | `academy.course.enroll` | Enroll in a course |
| `POST /academy/courses/{course}/sessions/{module}/complete` | `academy.course.session.complete` | Mark a session complete and advance |
| `GET /academy/courses/{course}/quiz` | `academy.quiz.show` | Show quiz for a course |
| `POST /academy/courses/{course}/quiz/start` | `academy.quiz.start` | Begin a quiz attempt |
| `POST /academy/courses/{course}/quiz/{attempt}/submit` | `academy.quiz.submit` | Submit answers and grade |
| `GET /academy/courses/{course}/quiz/{attempt}/result` | `academy.quiz.result` | View quiz result and breakdown |
| `GET /academy/certificates` | `academy.certificates.index` | List earned certificates |
| `GET /academy/certificates/{code}/download` | `academy.certificates.download` | Download PDF certificate |
| `GET /academy/register` | `academy.register` | Self-registration form |
| `GET /academy/sso/callback` | `academy.sso.callback` | Receive SSO token from workspace |
| `POST /api/sso-token` (tenant-scoped) | `tenant.academy.sso-token` | Generate SSO token (called from MIS portal) |

## How it works

### Course generation from knowledge base

1. Run `php artisan academy:sync` (or call `AcademySyncCoursesService::sync()`).
2. The service reads all `*.md` files from `brain/knowledge/`.
3. `AcademyCourseMaterialClassifier` determines if a file is learnable content (not a system guide). Files classified as system guides are archived.
4. If the file hash is unchanged and `--force` is not passed, the file is skipped.
5. Files with in-progress quiz attempts are also skipped to avoid disrupting active learners.
6. `AcademyCarinaGeneratorService` sends the file content to an AI model. The model returns a structured `GeneratedCourse` DTO with `title`, `description`, `category`, `difficulty`, `estimatedMinutes`, and a list of modules each containing `title`, `content_markdown`, and `quiz_questions`.
7. The service upserts the `Course`, its `CourseModule` rows, a `Quiz` per module, and `QuizQuestion` rows (deleting old questions first).
8. `academy_knowledge_sync_log` is updated with hash, status, token counts, and any error.

### SSO flow (workspace to Academy)

1. A logged-in workspace user clicks "Go to Academy" in the MIS.
2. The MIS calls `POST /api/sso-token` (`AcademySsoController::generateToken`).
3. `AcademySsoService` creates an encrypted payload `{email, name, workspace, exp}`, stores a SHA-256 hash in `academy_sso_tokens` (central DB) with `expires_at = now + 5 minutes`, and returns a redirect URL pointing to the Academy's `/sso/callback?token=...`.
4. The browser follows the redirect to the Academy subdomain.
5. `AcademySsoCallbackController` decrypts the token, marks it `used_at` (one-time use), provisions or finds the user via `AcademyUserProvisionService`, logs them in, and stores `academy.source_workspace` in the session.
6. The user lands on the course catalogue.

### Session / module completion flow

1. User opens a course and views modules one at a time (pagination by `?session=N`).
2. Content is Markdown split by `AcademyCourseController::lessonChunks()` - headings become chunk titles; each chunk is capped at ~90 words.
3. User clicks "Complete session" to record a `CourseModuleCompletion` row.
4. `EnrollmentService::trackProgress()` updates `progress_percent` on the `CourseAssignment`.
5. After the last module, the user is redirected to the quiz.

### Quiz flow

1. `QuizService::assertCanStartAttempt()` validates the user can attempt (no open attempts).
2. `startAttempt()` creates a `QuizAttempt` row with `completed_at = null`.
3. User submits answers. `QuizService::gradeAttempt()` scores each answer against `correct_answer.value` and marks `passed = true` if score >= `passing_score` (default 70%).
4. If passed: linked `CourseModule` is completed, progress tracked at 100%, certificate issued via `EnrollmentService::certify()`.
5. `AcademyConversationService::setSessionMode()` sets the Carina conversation mode to `quiz_active` on start and `quiz_review` on result.

### Certificates

`CertificateController::download()` generates a PDF via `AcademyCertificatePdfService`. Certificates are keyed by `certificate_code` on the `CourseAssignment`. `AcademyRenewalService` handles certificate renewals.

### Video delivery

Courses and individual modules support video content. `video_source` is a short code (e.g. `upload`, `youtube`, `vimeo`). `video_url` holds external links. `video_path` and `video_mime_type` are for locally stored files.

### Academy workspace identification

`AcademyWorkspace::isAcademyTenant()` returns true if:
- The tenant's slug matches `academy_workspace_slug` (platform setting, default `academy`), or
- The tenant has `TenantSetting` with `key = is_academy` and `value = 1`.

Use `AcademyWorkspace::markAsAcademy()` to flag any tenant as an Academy workspace. The `EnsureAcademyWorkspace` middleware gates all academy routes.

## Carina context

Carina's role in the Academy is as an in-course teaching assistant. The `AcademyConversationService` attaches a `programme_id` equivalent via the session mode (`learning`, `quiz_active`, `quiz_review`) so Carina knows which course context to draw from.

Users may ask Carina:
- "What is this course about?"
- "Explain the concept in this module"
- "I failed the quiz on HMO calculations - what did I miss?"
- "Show me my progress"

Carina should know: courses are generated from the Propreneur knowledge base; each course has modules (sessions) and a quiz at the end; passing score is 70%; certificates are issued on quiz pass; the academy is accessible at `academy.{domain}`.
