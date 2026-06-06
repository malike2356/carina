# Nexio - AI Certificate Scanning (Phase 6)

## Overview

Landlords photograph UK compliance certificates (CP12, EICR, EPC, etc.). Vision AI extracts dates and reference numbers for operator confirmation - nothing is auto-saved without review.

## API

| Surface | Route |
|---|---|
| Mobile | `POST /api/v1/mobile/documents/scan-cert` (`tenant.mobile.api.documents.scan-cert`) |
| Web | `POST /compliance/{item}/scan-cert` (`tenant.compliance.scan-cert`) |

Multipart field: `image` (JPEG/PNG/WebP).

## Services

- `App\Services\Documents\CertScanningService` - vision prompt + JSON parse + per-field confidence
- `App\Services\Carina\AiRouterService::routeVisionAnalysis()` - OpenAI-compatible or Anthropic vision
- Rate limit: `throttle:cert-scan` - 10 scans per workspace per hour (`CERT_SCAN_MAX_PER_HOUR`)

## Config (`config/cert_scan.php`)

- `CERT_SCAN_PROVIDER` - openai, anthropic, google
- `STORE_CERT_SCANS` - default false (delete image after extraction)
- `CERT_SCAN_MAX_PER_HOUR` - default 10

## Confirmation flow

1. Scan returns JSON with `fields.{name}.confidence` (`high` / `low`).
2. Mobile or web UI shows review; user edits and saves via existing document/compliance update endpoints.
3. `compliance_type` maps scan slugs to `ComplianceItem.type` (e.g. `fire_risk_assessment` → `fire_alarm`).

## Tests

`tests/Feature/Documents/CertScanningTest.php`
