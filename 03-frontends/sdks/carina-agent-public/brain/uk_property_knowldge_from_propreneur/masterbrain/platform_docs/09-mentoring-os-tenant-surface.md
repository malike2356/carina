# Mentoring OS (tenant surface)

**Last updated:** 2026-05-13
**Status:** Phase 1 + Phase 2 + Phase 3a-3g shipped - production ready (v1 parity).

The Mentoring OS gives each tenant a self-contained workspace to run mentorship at scale. It is gated by `App\Billing\BillingModule::MentoringOs` and the `mentoring_os` feature flag.

## Surfaces (web)

All routes live under `/mentoring` and are protected by `subscription.feature:mentoring_os` + `feature:mentoring_os`.

| Route name | URI | Controller | Audience |
| --- | --- | --- | --- |
| `tenant.mentoring.index` | `/mentoring` | `MentorHubController@index` | Admin / mentor / mentee (with redirect-to-onboarding for new mentees) |
| `tenant.mentoring.portal` | `/mentoring/portal` | `MentorHubController@menteePortal` | Mentee - relationship list with goals/milestones/notes counts |
| `tenant.mentoring.relationships.show` | `/mentoring/relationships/{mentorship}` | `MentorshipRelationshipController@show` | Mentor, mentee, or admin involved in the pair |
| `tenant.mentoring.directory` | `/mentoring/directory` | `MentorDirectoryController@index` | Admin / mentor / mentee |
| `tenant.mentoring.profile.edit` | `/mentoring/profile` | `MentorProfileController@edit` | Admin / mentor |
| `tenant.mentoring.packages.index` | `/mentoring/packages` | `MentorshipPackageController@index` | Admin / mentor |
| `tenant.mentoring.reports.index` | `/mentoring/reports` | `MentoringReportController@index` | Admin / mentor |
| `tenant.mentoring.onboarding.*` | `/mentoring/onboarding/...` | `MenteeOnboardingController` | Mentee |

The hub view (`resources/views/tenant/mentoring/index.blade.php`) carries a quick-links row to the directory, packages, profile and reports surfaces.

The nav drawer (in `layouts/app.blade.php`) exposes the same surfaces under the **Mentoring** group; admin/mentor-only entries are hidden for plain mentees.

## API (`/api/mentoring-os`)

Defined in `routes/tenant-mentoring-os-api.php`. Every route enforces both the subscription and feature-flag middleware listed above.

- `workspace-users` - typeahead picker.
- `mentorship-programmes` + nested `cohorts` and `cohorts/{cohort}/members` (CRUD).
- `mentorships` + `mentorships/match` and `mentorships/{id}/messages`.
- `mentors/suggest`, `match-requests`, `pending-requests`, `match-requests/{id}/approve|reject|end`.
- `mentor-profile` (self) + `mentor-profile/{user}` (admin and self) with `unpublish`.
- `packages` - full CRUD on `MentorshipPackage`.
- Scoped to `mentorships/{mentorship}`:
  - `goals` - CRUD on `MentorshipGoal`.
  - `milestones` - CRUD plus `milestones/{id}/complete` toggle.
  - `session-notes` - CRUD plus `session-notes/{id}/action-items/{index}/toggle`.
  - `learning-paths` - assign and detach `LearningPathAssignment` records.
- `learning-paths/available` - published tenant learning paths.
- `reports/summary`, `reports/leaderboard`, `reports/at-risk`, `reports/mentees/{id}/progress`.

## Schema additions (tenant)

- Phase 1 migration `2026_05_07_100000_mentorship_programmes_cohorts_and_relationship_links.php` - `mentorship_programmes`, `mentorship_cohorts`, `mentorship_cohort_members`, and FKs on `mentorship_relationships` for programme / cohort / pipeline deal / contact.
- Phase 2 migration `2026_05_15_100000_mentoring_os_phase2_packages_goals_milestones_session_notes.php`:
  - `mentorship_packages` - mentor-defined pricing tiers (price in pence, currency, sessions, duration, inclusions JSON).
  - `mentorship_goals` - per-relationship goals with status / target_date / progress_percent.
  - `mentorship_milestones` - sub-tasks optionally linked to a goal; tracks `completed_at` / `completed_by`.
  - `mentorship_session_notes` - notes plus `action_items` JSON, `visibility` (`shared` | `mentor_only`), optional `vcal_booking_id`.
  - `mentor_profiles` - one-per-user public profile (`headline`, `bio`, `specialties`, `focus_areas`, `languages`, `hourly_rate_cents`, `linkedin_url`, etc.).
  - `mentorship_relationships` gains `mentorship_package_id`, `intent_summary`, `private_notes`.
  - `learning_path_assignments` gains `mentorship_relationship_id`, `assigned_by`, `due_at`.

## Services

All business logic lives in `app/Services/MentoringOs/`:

- `MentorshipStructureService` (programmes, cohorts, members)
- `MentorMatchingService` (requests, approvals, suggestions)
- `MenteeOnboardingService` (wizard state)
- `MentorshipPackageService` (CRUD + slug uniqueness, blocks deletion when attached)
- `MentorshipGoalService` (goal + milestone CRUD with mentee/mentor-only write rules)
- `MentorshipSessionNoteService` (CRUD, visibility, action-item toggle, optional vCal link)
- `MentorshipLearningPathService` (assign / detach within a relationship)
- `MentorProfileService` (CRUD, slug uniqueness, mirrors `users.mentor_directory_*` fields)
- `MentoringReportService` (workspace summary, mentor leaderboard, at-risk list, mentee progress)

## Carina and viCal

- Carina deep link: `GET /carina/open-mentorship/{mentorshipId}` (`tenant.carina.fromMentorship`).
- viCal bookings link to a mentorship via `vcal_bookings.mentorship_relationship_id`; the relationship detail view surfaces upcoming and historical sessions when the `booking_calendar` flag is enabled.
- Session notes optionally link to a `vcal_booking_id` so the call log lives alongside the booking.

## Roles

`spatie/laravel-permission` workspace roles: `mentor`, `mentee`, plus `tenant_admin`. The Phase 1 role migration is `2026_05_01_220000_add_mentor_mentee_workspace_roles.php`. Profile management requires `mentor` or admin; package management is admin-or-mentor; goals and notes are admin-or-participant; learning-path assignment is admin-or-mentor.

## Tests

- `tests/Feature/Mentoring/MentoringOsPhase1Test.php` - billing gating, role gating, programme/cohort wiring.
- `tests/Feature/Mentoring/MentoringOsPhase2Test.php` - goals, milestones, session notes (with visibility), packages, profile, reports summary, relationship detail page, directory/packages/reports/profile admin views.

## Phase 3 additions (v1 parity)

### 3a - Public mentee intake + matching upgrades

- `mentee_registrations` table - public intake pipeline with status enum (`pending`, `awaiting_payment`, `paid`, `approved`, `rejected`), Stripe checkout fields, UTM capture, public `status_token`.
- `MenteeIntakeService` + `MenteeClientProvisioningService` - handles submission, Stripe checkout for paid packages, admin approve/reject which provisions a CRM `Contact`, a workspace `User` (assigned the `mentee` role), and a live `MentorshipRelationship`.
- Public routes: `mentoring/apply[/{packageSlug}]`, `mentoring/apply/status/{token}`, `mentoring/apply/thanks/{token}`. Admin routes: `mentoring/intake`, `mentoring/intake/{registration}`.
- Public API: `api/mentoring-os/public/intake` (POST) + `api/mentoring-os/public/intake/{token}` (GET).
- Mailables: `MenteeRegistrationSubmittedMail`, `MenteeRegistrationApprovedMail`, `MenteeRegistrationRejectedMail`.
- Public `/mentoring/packages` listing page + per-package public landing.
- New mentor-profile columns: `is_featured`, `accepts_free_discovery`, `accepts_paid_sessions`, `accepts_group_masterclass`, `max_active_mentees`, `signature_image_path`, `rating_avg`, `rating_count`.
- `mentorship_package_courses` pivot links a package to one or more `Course` records. `MentorshipRelationshipObserver` auto-enrols the mentee in those courses once the relationship becomes `active`.

### 3b - Recurring mentorship billing + quotas

- `mentorship_relationships` gains `agreed_rate_amount`, `billing_cycle`, `sessions_allowed`, `sessions_used`, `next_invoice_at`, `last_invoiced_at`, `discovery_booking_id`.
- `mentorship_invoices` table + `MentorshipInvoice` model (`open`, `awaiting_payment`, `paid`, `void`; reference `MENTORSHIP-{id}-{period}`).
- `MentorshipInvoicingService` generates invoices idempotently per period and creates Stripe Checkout sessions when due. Console command `mentorship:generate-invoices` runs daily at 06:00 via `PlatformScheduleCatalog`.
- `VcalBookingService` increments `sessions_used` when a mentorship-linked booking is marked `attended`, and blocks linking new bookings once `sessions_allowed` is exhausted.
- Mentee portal renders a "Mentorship payments" block with status and "Pay now" links via `MentorshipInvoiceController@pay`.

### 3c - Engagement scoring + cohort reporting

- `EngagementScoringService` computes a 0-100 score and RAG colour from sessions held, message volume, goal/milestone progress and course progress.
- `MentoringReportService::cohortPerformance()` aggregates per-cohort metrics; surfaced on `/mentoring/reports` and downloadable as PDF (`reports/cohort-pdf`) via dompdf.
- API: `GET /api/mentoring-os/reports/cohort-performance`.

### 3d - Realtime, view-as-mentor, certificates, help centre

- `MentorshipMessageSent` broadcast event + private channel `mentorship.{id}` (auth in `routes/channels.php`).
- `NotifyOfflineMentorshipRecipient` listener queues `MentorshipMessageMail` when the recipient hasn't been seen in the last 5 minutes.
- `ViewAsMentor` middleware + `view_as_mentor_id` session flag; admin picker on the directory page; banner with **Exit view-as** action in the global layout.
- `MentorshipCertificateService` renders PDF certificates from `CourseAssignment` records, embedding the mentor's `signature_image_path` when present. Route `mentoring/certificates/{assignment}.pdf`.
- Help-centre Blade pages: `mentoring/help` and `mentoring/help/booking`.

### 3e - Paid masterclasses + public vCal API keys

- `vcal_group_events` gains `price_amount`, `currency`, `requires_payment`, `issue_certificate`.
- `vcal_event_tickets` table + `VcalEventTicketingService` (capacity check, Stripe checkout per ticket).
- Public routes: `vical/events/{token}/tickets` (purchase) and `vical/tickets/{token}` (ticket detail).
- `vcal_api_keys` table + `VcalApiKey` model with `mint()` / `verify()`. Middleware `VcalApiKeyAuth` (`X-Vcal-Key`) protects an `/api/vcal/rest` group. Admin CRUD UI lives at `vical/api-keys`.

### 3f - Community parity

- `community_wins` + `CommunityWinController` (index, show, store, feature, destroy). Tenant-admin feature toggle.
- `community_testimonials` + `CommunityTestimonialController` with moderation queue (`pending`, `approved`, `rejected`).
- `community_messages` (peer-to-peer DMs) + `CommunityMessageController` (`index`, `show`, `store`).
- `community_deal_shares` + `community_deal_share_comments` + `CommunityDealShareController` (`shareFromDeal`, `storeComment`, `destroy`).
- All four surfaces are linked from the existing community hub (`tenant.community.index`) and gated by `BillingModule::CommunityLearning` + `feature:community_learning`.

### 3g - Polish gaps

- Carina baseline now appends a workspace-wide **Mentoring OS baseline** (active relationships, distinct mentors, open invoices) plus a steering hint when the user's latest message contains mentoring keywords. Gated by the `mentoring_os` feature flag.
- `mentorship_milestones` gains `evidence_text`, `evidence_attachment_path`, `evidence_attachment_name`, `evidence_submitted_at`. The relationship detail page has an inline evidence form per milestone (multipart upload via Alpine `FormData`).
- `mentorship_relationships.discovery_booking_id` lets us trace back which discovery booking originated the mentorship.
- `vcal_availability_rules` gains optional `mentor_profile_id`; when any host has profile-scoped rules for a given profile, those override the host's general rules for bookings against that profile. `VcalSlotService::upcomingSlots()` accepts an optional `$mentorProfileId`.

## Related knowledge

- `54-community-learning-module.md` (mentorship JSON API under community module).
- `08-carina.md`, `22-tenant-route-map.md`.
