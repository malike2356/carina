# Staff compliance training (workspace mandatory training)

## Purpose

The staff compliance training module tracks **mandatory regulatory training** for workspace users: AML and financial crime awareness, fire safety, HMO management rules, GDPR, health and safety, and general compliance topics. It records enrolment, progress through course content, assessment scores, pass or fail, certificate URLs, and **certificate expiry dates** for audit and regulator-ready evidence.

This is a **workspace staff compliance** system. It is not property mentorship, investor education, or the Propreneur Academy course catalogue.

## Distinction from Mentorship / Academy

| Area | Staff compliance training | Mentorship / Academy |
|------|---------------------------|----------------------|
| Audience | Workspace staff and tenant users under AML/HMO duties | Mentees, mentors, programme cohorts |
| Models | `ComplianceTrainingCourse`, `ComplianceStaffTraining`, etc. | `Course`, `CourseModule`, `CourseAssignment`, `LearningPath`, `QuizAttempt` |
| Goal | Regulatory compliance and certificate expiry | Learning journeys, packages, mentorship outcomes |
| Routes | `/compliance/training/*` (`tenant.compliance.training.*`) | Academy and mentoring routes |

Do not merge or reuse Academy models for compliance training.

## Mandatory vs optional courses

- **`is_mandatory`**: when true, the course counts toward team compliance snapshots and `getMandatoryCoursesNotCompleted()`.
- Optional courses can still be enrolled and completed but do not block team mandatory completion metrics.
- Admins use **Team overview** (`tenant.compliance.training.team`) to see all active users against every mandatory course.

## Certificate expiry

- Each course may define **`validity_months`** (null = no expiry).
- On completion with **score >= 70**, `passed` is true and **`expiry_date`** is set to completion date plus `validity_months`.
- **`getExpiringCertificates($withinDays)`** lists passed enrollments expiring within the window (default 30 days).
- Store external certificate evidence in **`certificate_url`** (document vault link or uploaded file URL).

## RAG status logic

Per enrollment (`ComplianceStaffTraining::getRagStatus()`):

| Status | Meaning |
|--------|---------|
| **red** | Certificate expired (`expiry_date` in the past) OR assignment overdue (`due_date` past and not completed) |
| **amber** | Due within 14 days (`isDueSoon`) OR certificate expires within 30 days |
| **green** | Otherwise current |

Course list and team matrix use the same colours for at-a-glance compliance.

## AML training requirement context (MLR 2017 Regulation 24)

**Money Laundering, Terrorist Financing and Transfer of Funds (Information on the Payer) Regulations 2017**, Regulation 24, requires relevant businesses (including estate agents and letting agents who carry out estate agency work) to:

- Take appropriate measures so employees are **made aware** of AML obligations and ML/TF risks
- Provide **regular training** on those obligations, policies, and procedures
- Maintain **records** of training given

This module is the workspace record of that obligation. It complements **AML records**, **AML deal logs**, and the **regulatory profile** under Compliance.

- AML category courses align with periodic refresher expectations (often annual; set `validity_months` on the course).
- Completion evidence (score, certificate URL, expiry) supports HMRC supervision and FCA-style audit requests.
- Workspace admins should assign mandatory AML courses to all users who handle client money, onboarding, or deal progression.

## Training categories and regulatory basis

| Seeded category | Regulatory / operational basis |
|---|---|
| AML & Financial Crime | MLR 2017 reg 24; HMRC estate agency supervision; Proceeds of Crime Act 2002 |
| Fire Safety | Regulatory Reform (Fire Safety) Order 2005; responsible person duties in HMOs |
| HMO Management | Housing Act 2004; HMO Management Regulations 2006; licence conditions |
| GDPR & Data Protection | UK GDPR and Data Protection Act 2018; ICO accountability |
| Health & Safety | Health and Safety at Work etc. Act 1974; workplace and visit safety for staff |
| General Compliance | Cross-cutting landlord obligations (deposits, notices, fair treatment) |

## Data model (tenant DB)

- `compliance_training_categories` - seeded categories (AML, Fire Safety, HMO, GDPR, Health & Safety, General).
- `compliance_training_courses` - course definition, content, validity, mandatory flag.
- `compliance_training_questions` - optional JSONB quiz bank per course.
- `compliance_staff_training` - one row per user per course (unique constraint).
- `compliance_training_content_progress` - section completion indices per enrollment.

## Service and UI

- **Service:** `App\Services\Compliance\ComplianceTrainingService` (enrol, complete, progress, expiring certificates, mandatory gaps, team snapshot).
- **Controller:** `App\Http\Controllers\Tenant\Compliance\ComplianceTrainingController`.
- **Views:** `resources/views/tenant/compliance/training/` (index, show, team).

Pass mark: **70%**. Refresher enrollments may set `is_refresher` when re-certifying before expiry.

## Carina help context

When users ask Carina about staff training, AML refresher deadlines, or team compliance gaps:

- Point them to **Compliance > Staff compliance training** (`/compliance/training`).
- Explain mandatory vs optional badges and RAG colours.
- For AML specifically, cross-reference **Compliance > AML** and regulatory profile reminders.
- Carina should not suggest enrolling via Academy for AML; use this compliance training module instead.
