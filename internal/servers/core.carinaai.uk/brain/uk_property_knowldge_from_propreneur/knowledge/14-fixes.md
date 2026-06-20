# Bug Fixes & Build Log

**Last updated:** 2026-05-16

## Overview
Historical log of bugs found and fixed during the Propreneur v2.0 build. Kept as reference - the codebase is the source of truth for current state.

## Fixes

- **Tenant DB isolation:** Ensured tenant-scoped queries never leak across databases
- **SDLT calculation (v1 parity):** Updated stamp duty bands to current HMRC rates for additional properties
- **Calculator nullable fields:** Dealt with scenarios where fields were missing from calculator JSON
- **Pipeline stage reordering:** Fixed sort order persistence when dragging stages
- **Contact deduplication:** Email-based dedup on import and lead funnel conversion
- **Subscription gate race:** Fixed interceptor race when multiple subscription checks fire
- **RAG chunking:** Fixed edge case where single-line documents produced no chunks
- **Carina context resolution:** Fixed context_type validation for deep link routes
- **OAuth state TTL:** Added configurable expiry for OAuth state tokens (lead funnel, TrueLayer)
- **Lead funnel webhook HMAC:** Added shared secret verification for Meta lead gen callbacks
- **Deal listings view modes (prompt 80):** Grid/list toggle on Sourced Listings and Deal Engine index with `localStorage` persistence, image thumbnails, and Pest coverage (`DealListingsViewModeTest`)
