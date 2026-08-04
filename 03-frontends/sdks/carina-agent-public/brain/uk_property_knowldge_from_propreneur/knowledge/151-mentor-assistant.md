# Mentor Assistant (Carina for Mentoring)

**Last updated:** 2026-05-20

## Overview

The Mentor Assistant adds Carina AI capabilities directly into the Mentoring OS. Per programme, admins and mentors can configure how Carina behaves when interacting with mentees, upload programme-specific reference materials (PDF, DOCX, TXT, MD) that are indexed into RAG, receive automated alerts when students stall or repeatedly fail quizzes, and generate pre-session briefings that summarise each mentee's progress before a meeting.

## Key tables

All tables in the tenant database.

| Table | Key columns |
|---|---|
| `mentorship_programme_carina_settings` | `mentorship_programme_id` (unique FK), `enabled`, `carina_label` (max 30, default `Carina`), `teaching_tone` (`professional`/`friendly`/`strict`), `example_style` (`mixed`/`property_specific`/`general`), `allow_general_knowledge` (bool), `persona_notes` (max 500), `topics_outside_scope` (max 200), `alert_stall_days` (default 3), `alert_digest_enabled` (bool), `alert_digest_hour` (default 9) |
| `mentor_programme_documents` | `id`, `mentorship_programme_id`, `uploaded_by`, `original_filename`, `stored_path`, `file_type`, `file_size_bytes`, `ingestion_status` (`pending`/`ingested`/`failed`), `ingestion_error`, `rag_document_ids` (JSONB array), `moderation_status` (`pending`/`cleared`/`flagged`), `moderation_flags` (JSONB), `ingested_at` |
| `mentorship_carina_alerts` | `id`, `mentorship_programme_id`, `mentorship_relationship_id`, `student_user_id`, `alert_type`, `alert_data` (JSONB), `fired_at`, `digest_included_at`; indexed on `(mentorship_relationship_id, alert_type, fired_at)` |
| `mentorship_session_briefs` | `id`, `mentorship_programme_id`, `vcal_booking_id` (nullable), `mentor_user_id`, `session_scheduled_for`, `generated_at`, `brief_markdown`, `student_snapshots` (JSONB) |

### Columns added to existing tables

`carina_conversations`:
- `programme_id` (nullable FK to `mentorship_programmes`) - ties a Carina conversation to a specific mentoring programme
- `is_impersonated` (bool, default false) - distinguishes mentor test sessions from real mentee conversations

`mentorship_programmes`:
- `modules_per_week` (decimal 4,2, nullable) - expected learning pace; used by the behind-schedule alert

## Routes / entry points

All routes are nested under a programme within the mentoring section.

| Route | Method | Name | Description |
|---|---|---|---|
| `GET /mentoring/programmes/{programme}/assistant` | GET | `tenant.mentoring.assistant.settings` | Carina assistant settings for this programme |
| `POST /mentoring/programmes/{programme}/assistant/settings` | POST | `tenant.mentoring.assistant.settings.save` | Save assistant settings |
| `GET /mentoring/programmes/{programme}/assistant/students` | GET | `tenant.mentoring.assistant.students` | Student overview with alert flags and last Carina activity |
| `POST /mentoring/programmes/{programme}/assistant/students` | POST | `tenant.mentoring.assistant.students.store` | Manually enrol a student (bypasses public intake) |
| `DELETE /mentoring/programmes/{programme}/assistant/students/{relationship}` | DELETE | - | End a mentee relationship |
| `GET /mentoring/programmes/{programme}/assistant/materials` | GET | `tenant.mentoring.assistant.materials.index` | List uploaded programme documents |
| `POST /mentoring/programmes/{programme}/assistant/materials` | POST | `tenant.mentoring.assistant.materials.upload` | Upload a new document |
| `DELETE /mentoring/programmes/{programme}/assistant/materials/{doc}` | DELETE | - | Delete a document and remove from RAG index |
| `POST /mentoring/programmes/{programme}/assistant/materials/{doc}/retry` | POST | - | Retry ingestion for a failed document |
| `GET /mentoring/programmes/{programme}/assistant/brief` | GET | `tenant.mentoring.assistant.brief` | View latest session brief |
| `POST /mentoring/programmes/{programme}/assistant/brief/generate` | POST | `tenant.mentoring.assistant.brief.generate` | Generate a new session brief |

Controllers: `MentoringAssistantController`, `MentoringMaterialController`, `MentoringSessionBriefController`.

## How it works

### Carina settings per programme

Each programme has one `mentorship_programme_carina_settings` row (created on first access via `MentoringCarinaSettingsService::getOrCreate()`). Settings control:
- Whether Carina is active for this programme
- The display name Carina uses (default `Carina`)
- Teaching tone and example style
- Whether Carina can answer questions outside the programme syllabus
- Persona notes - free text guidance fed into Carina's system prompt
- Topics outside scope - comma-separated topics Carina should deflect

When a mentee opens a Carina conversation linked to a programme (`programme_id` set on `carina_conversations`), these settings are applied to the AI context.

### Document upload and RAG ingestion

1. Mentor or admin uploads a file (PDF, DOCX, TXT, or MD, max 10 MB) via `MentoringMaterialIngestionService::handleUpload()`.
2. The file is stored at `mentor-materials/{programme_id}/doc_{uuid}.{ext}`.
3. `MentoringMaterialModerationService` scans the extracted text for prohibited content. If flagged, the document is marked `moderation_status = flagged` and platform super-admins are notified via `MentorMaterialFlaggedNotification`.
4. If cleared, `moderation_status = cleared` and `IngestMentorMaterialJob` is dispatched.
5. The job calls `RagIndexService` to index the document text. The resulting RAG document IDs are stored in `rag_document_ids` on the `mentor_programme_documents` row.
6. `ingestion_status` is set to `ingested` (or `failed` with `ingestion_error` on exception).
7. To delete: `MentoringMaterialIngestionService::deleteDocument()` removes RAG index entries for all `rag_document_ids`, deletes the file from storage, and soft-deletes the DB row.

### Automated alerts

`MentoringAlertService::evaluateAll()` is called on a schedule to scan all active mentorship relationships. Three alert types are generated:

| Alert type | Trigger |
|---|---|
| `module_stalled` | Student has an in-progress course assignment with less than 100% progress AND no Carina activity for `alert_stall_days` days (checked via `carina_conversations` where `programme_id` matches and `is_impersonated = false`) |
| `quiz_failed_repeatedly` | Student has 3+ failed `quiz_attempts` on a quiz with no passing attempt |
| `programme_behind` | Student has completed fewer modules than `modules_per_week * weeks_enrolled`, where the gap is >= 1 module |

Each alert fires at most once per 7-day window per relationship per alert type (checked via `fired_at >= now - 7 days`). Alerts accumulate in `mentorship_carina_alerts` until included in a digest (marked with `digest_included_at`).

`MentoringAlertService::fireModuleCompleted()` creates a `module_completed` alert when a mentee finishes a module - this is a positive event used in digests and reporting.

### Alert digest

`SendAlertDigestsCommand` (scheduled) calls `MentoringAlertService` and sends digest emails to mentors. Each alert digest email lists undigested alerts (where `digest_included_at IS NULL`). After sending, `digest_included_at` is set to now on all included alerts.

`alert_digest_enabled` and `alert_digest_hour` on the settings row control whether and when digests go out.

### Session brief generation

1. Mentor clicks "Generate session brief" from the programme's assistant page (optionally linked to a vCal booking ID).
2. `MentorSessionBriefService::generate()` loads all active mentorship relationships for the programme.
3. For each mentee, `MentoringReportService::summaryForRelationship()` builds a snapshot: modules completed/total, average quiz score, weak areas, days since last active.
4. A structured prompt is sent to Carina via `CarinaService::complete()` asking for a markdown pre-session brief with: overall cohort summary, per-student breakdown (achievements, struggles, recommended focus), and a prioritised action list.
5. The response is stored as a `mentorship_session_briefs` row with `brief_markdown` and `student_snapshots`.
6. Mentors receive a `MentorSessionBriefReadyNotification`.

### Manual student enrolment

`MentoringAssistantController::storeStudent()` allows admins or mentors to add a student directly without going through the public intake form. It creates a `MenteeRegistration`, provisions a user account via `MenteeClientProvisioningService`, creates the `MentorshipRelationship` as `active`, and sends the new mentee a password setup email.

### Access control

`authorizeMentor()` on `MentoringAssistantController` allows access if the user is a tenant admin OR is a mentor on the programme (has an active relationship or a package linked to the programme). Platform admins can also impersonate mentor views.

## Carina context

Carina conversations with programme context (`programme_id` set) use the programme's Carina settings as additional system prompt guidance. The `teaching_tone`, `example_style`, `persona_notes`, and `topics_outside_scope` settings all shape how Carina responds.

Users may ask Carina:
- "How are my students doing?"
- "Which students are falling behind?"
- "Generate a brief for my next session"
- "Why hasn't [mentee] completed module 3?"
- "What materials have I uploaded for this programme?"
- "Send the weekly digest"

Carina should know:
- Each programme has independent assistant settings
- Uploaded materials are indexed into RAG and influence Carina's answers within that programme's scope
- `is_impersonated = true` on a `carina_conversation` means a mentor was testing the assistant - exclude these from student activity tracking
- Alert digests go to mentors only, not mentees
- Session briefs are generated on demand, not automatically
