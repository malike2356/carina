# Feature health (Carina)

Vendored from `shared/feature-health/`.

- Ops: `GET /api/ops/feature-health`, `GET /api/ops/feature-health/build-gate`
- Workspace analytics: `GET /api/aiva/analytics/feature-health`
- UI: `FeatureHealthPanel` on Aiva analytics dashboard

Agent rule: never start a new feature without `canBuildNewFeature()` / build-gate open.
