# Aiva Legal Acceptance Gate

**Status: PENDING**

## Purpose

Implement the in-app legal acceptance system for Carina Aiva. This covers:
- Recording which version of the ToS, Privacy Policy, and DPA the user accepted.
- Blocking access to the Service until acceptance is recorded.
- Re-acceptance flow when document versions are updated.
- Public legal pages at `carinaai.uk/legal/...`.

Legal documents live at: `aiva/legal/` (TERMS_OF_SERVICE.md, PRIVACY_POLICY.md,
DATA_PROCESSING_AGREEMENT.md). Those files are the source of truth for content.
Implement the acceptance flow around them, do not rewrite the content inline.

---

## Database Schema

Add to the core database migration:

```sql
CREATE TABLE legal_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_type TEXT NOT NULL,
    -- 'terms_of_service', 'privacy_policy', 'dpa'
    version TEXT NOT NULL,
    -- e.g. '1.0', '1.1', '2.0'
    effective_date DATE NOT NULL,
    content_url TEXT NOT NULL,
    -- public URL to the rendered page, e.g. /legal/terms/v/1.0
    is_current BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(document_type, version)
);

CREATE TABLE legal_acceptances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,
    document_version TEXT NOT NULL,
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address_hash TEXT,
    -- sha256(raw_ip + LEGAL_IP_SALT env var) - never store raw IP
    user_agent TEXT,
    CONSTRAINT fk_document FOREIGN KEY (document_type, document_version)
        REFERENCES legal_documents(document_type, version),
    UNIQUE(user_id, document_type, document_version)
);

CREATE INDEX ON legal_acceptances (user_id, document_type);
CREATE INDEX ON legal_acceptances (tenant_id, accepted_at DESC);
```

Seed the initial document versions on first migration:

```sql
INSERT INTO legal_documents (document_type, version, effective_date, content_url, is_current)
VALUES
  ('terms_of_service', '1.0', '[EFFECTIVE DATE]', '/legal/terms', TRUE),
  ('privacy_policy',   '1.0', '[EFFECTIVE DATE]', '/legal/privacy', TRUE),
  ('dpa',              '1.0', '[EFFECTIVE DATE]', '/legal/dpa', TRUE);
```

---

## Backend: API Endpoints

`02-backends/core.carinaai.uk/src/api/legal-api.ts`

### GET /api/legal/current

Returns the current version of all documents that require acceptance. Used by the
onboarding gate and the re-acceptance check on login.

Response:
```json
{
  "documents": [
    { "type": "terms_of_service", "version": "1.0", "url": "/legal/terms" },
    { "type": "privacy_policy",   "version": "1.0", "url": "/legal/privacy" },
    { "type": "dpa",              "version": "1.0", "url": "/legal/dpa" }
  ]
}
```

### GET /api/legal/status

Requires authentication. Returns which current documents the authenticated user has
accepted and which are outstanding.

Response:
```json
{
  "pending": [
    { "type": "terms_of_service", "version": "1.0", "url": "/legal/terms" }
  ],
  "accepted": [
    { "type": "privacy_policy", "version": "1.0", "accepted_at": "2026-06-30T10:00:00Z" },
    { "type": "dpa",            "version": "1.0", "accepted_at": "2026-06-30T10:00:00Z" }
  ],
  "all_current_accepted": false
}
```

### POST /api/legal/accept

Requires authentication. Records the user's acceptance of one or more documents.
Called when the user clicks "I agree" on the acceptance gate.

Request body:
```json
{
  "acceptances": [
    { "document_type": "terms_of_service", "version": "1.0" },
    { "document_type": "privacy_policy",   "version": "1.0" },
    { "document_type": "dpa",              "version": "1.0" }
  ]
}
```

Validation:
- Reject any version that is not in `legal_documents` as `is_current = TRUE`.
- Record `ip_address_hash` as sha256(request IP + `LEGAL_IP_SALT` env var).
- Record `user_agent` from the request header.
- Return 409 if a given document version has already been accepted by this user.

Response on success:
```json
{ "accepted": 3, "all_current_accepted": true }
```

### GET /api/legal/audit (admin only)

Returns acceptance records for a tenant. Used for compliance audit export.
Restricted to tenant admin role.

---

## Middleware: Acceptance Gate

`02-backends/core.carinaai.uk/src/middleware/legal-gate.ts`

Add middleware that runs after authentication on all protected routes. It checks whether
the authenticated user has accepted all current document versions. If not, it returns:

```json
{
  "code": "legal_acceptance_required",
  "pending": [
    { "type": "terms_of_service", "version": "1.0", "url": "/legal/terms" }
  ]
}
```

HTTP status: 403

The frontend checks for this code and shows the acceptance gate instead of the requested
page.

Exempt from the gate:
- `POST /api/legal/accept`
- `GET /api/legal/current`
- `GET /api/legal/status`
- `POST /api/auth/logout`
- All public (unauthenticated) routes

---

## Frontend: Onboarding Gate

`03-frontends/client-apps/app.carinaai.uk/src/components/LegalGate.tsx`

This component is shown during initial onboarding and whenever `all_current_accepted`
is false. It intercepts navigation until acceptance is recorded.

### Layout

```
+--------------------------------------------------+
|  Before you continue                             |
|                                                  |
|  Please review and accept the following:         |
|                                                  |
|  [x] Terms of Service (v1.0)      [Read]         |
|  [x] Privacy Policy (v1.0)        [Read]         |
|  [x] Data Processing Agreement (v1.0)  [Read]   |
|                                                  |
|  By clicking Accept, you confirm that you have   |
|  read and agree to these documents.              |
|                                                  |
|  [ Accept and Continue ]                         |
+--------------------------------------------------+
```

Behaviour:
- All checkboxes start unchecked.
- "Accept and Continue" is disabled until all checkboxes are checked.
- Each "Read" link opens the document in a new tab.
- On click of "Accept and Continue", call `POST /api/legal/accept` with all pending
  documents.
- On success (`all_current_accepted: true`), redirect to the user's intended destination.
- On error, show an inline error message. Do not redirect.

### Re-acceptance (version update flow)

When a user logs in and `GET /api/legal/status` returns `pending` documents, show the
same gate with only the updated documents listed. Include a note: "We have updated
[document name]. Please review and accept the new version to continue."

---

## Frontend: Public Legal Pages

`03-frontends/client-apps/app.carinaai.uk/src/app/(marketing)/legal/`

The legal documents are served as static pages rendered from the markdown files in
`aiva/legal/`. Use a markdown renderer (e.g. `react-markdown` with a prose stylesheet).

| Route | Source file |
| --- | --- |
| `/legal/terms` | `aiva/legal/TERMS_OF_SERVICE.md` |
| `/legal/privacy` | `aiva/legal/PRIVACY_POLICY.md` |
| `/legal/dpa` | `aiva/legal/DATA_PROCESSING_AGREEMENT.md` |
| `/legal/sub-processors` | `aiva/legal/SUB_PROCESSORS.md` (create when needed) |
| `/legal/cookies` | `aiva/legal/COOKIE_POLICY.md` (create when needed) |

Each page must:
- Show the document version and effective date at the top.
- Show a "Download PDF" link (use browser print-to-PDF or a pre-generated PDF if feasible).
- Link to all other legal pages in a sidebar or footer section.
- Be accessible without authentication (public pages).

A versioned archive is available at `/legal/terms/v/1.0` etc. This allows links in
acceptance records to remain stable even after a document is updated.

---

## Version Update Process

When a legal document is updated (e.g. ToS v1.0 to v1.1):

1. Add the new version to the `legal_documents` table with `is_current = FALSE`.
2. Set the new version `effective_date` to the date 30 days in the future.
3. At the effective date, update the old version to `is_current = FALSE` and the new
   version to `is_current = TRUE` (via a migration or admin action).
4. Notify all users by email 30 days before the effective date (use the notification
   system).
5. On the effective date, the gate middleware will detect the new current version and
   require re-acceptance at next login.

This satisfies the 30-day notice requirement in the Terms of Service.

---

## Environment Variables

```
LEGAL_IP_SALT=<random 32-byte hex string>   # for hashing IP addresses in acceptance records
```

Add to `.env.example` and to the Docker Compose env section.

---

## Tests

```
tests/legal/
  test_legal_api.py
    - GET /api/legal/current returns three documents
    - POST /api/legal/accept records acceptance and sets all_current_accepted
    - POST /api/legal/accept with already-accepted version returns 409
    - POST /api/legal/accept with non-current version returns 400
    - Middleware blocks /api/workspace with 403 code=legal_acceptance_required if pending docs exist
    - Middleware passes after all docs accepted
    - ip_address_hash is a sha256 hex string, not the raw IP
```

---

## Acceptance Criteria

- A new user completing registration is shown the acceptance gate before accessing the
  workspace.
- The acceptance gate cannot be bypassed (all protected routes return 403 until acceptance
  is recorded).
- Acceptance records in the database include document type, version, timestamp,
  ip_address_hash, and user_agent.
- The raw IP address is never stored in the database.
- Public legal pages at `/legal/terms`, `/legal/privacy`, `/legal/dpa` are accessible
  without authentication.
- Versioned archive URLs remain stable after a document update.
- When ToS is updated to v1.1, existing users see the re-acceptance gate on next login
  and are emailed 30 days in advance.
