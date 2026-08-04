# Aiva Workspace Analytics Implementation Prompt

## Objective

Build a complete workspace Analytics page for Aiva and Carina that gives owners, investors, and funders a single number-led view of business activity. The page must count everything currently available in the workspace and present it through metric cards, line charts, bar charts, doughnut or pie charts, heatmaps, tables, and downloadable exports.

## Scope

- Upgrade `/analytics` into the primary cross-workspace analytics page.
- Promote Analytics into the Aiva left sidebar so Aiva users can reach it directly.
- Keep the existing Carina non-Aiva analytics path usable.
- Use current local workspace data from the app database:
  - Sessions and messages.
  - Usage events, tokens, model mix, provider mix, estimated spend.
  - Documents.
  - Calendar events and meetings.
  - Scheduled tasks and task runs.
  - Research jobs.
  - Email messages.
  - User memories and notes.
  - Enabled skills.
- Merge Aiva backend analytics through the existing core proxy when configured:
  - Worker counts and per-worker message volume.
  - Conversations.
  - Channel mix.
  - Escalation rate and trend.
  - Aiva activity heatmap.
- Make every chart resilient to empty data.
- Add JSON and CSV downloads from the Analytics page.
- Keep all UI copy plain ASCII. Do not use emojis, em dashes, or en dashes.

## Implementation Plan

1. Extend `src/lib/analytics-types.ts` with business-facing analytics types for local modules, Aiva metrics, chart series, and export rows.
2. Extend `src/lib/analytics-overview.ts` so `buildAnalyticsOverview` returns:
   - Existing workspace usage summary.
   - New `business` metrics object.
   - New `aiva` metrics object fetched from core proxy where available.
   - Module counts, trends, status breakdowns, and charts for the selected range.
3. Replace or substantially upgrade `src/components/analytics/AnalyticsDashboard.tsx`:
   - Investor-style header.
   - Metric card grid.
   - Growth line chart.
   - Module bar chart.
   - Status doughnut chart.
   - Channel bar chart.
   - Meeting and schedule charts.
   - Knowledge and content metrics.
   - Per-Aiva table.
   - Export buttons for JSON and CSV.
4. Update `src/app/(workspace)/analytics/page.tsx` so Aiva and Carina both use the richer dashboard.
5. Update `src/lib/aiva-nav.ts` so Analytics appears as a direct left-sidebar item on the Aiva product.
6. Validate:
   - TypeScript for changed code if possible.
   - Production build.
   - Targeted writing-style scan for changed files.
7. Archive this prompt under `docs/archive/` after implementation.
8. Commit only the files changed for this analytics work, avoiding unrelated dirty workspace changes.
9. Deploy app changes to production and verify public health.

## Acceptance Criteria

- `/analytics` loads as one page with all current workspace measurable areas represented.
- Aiva branded left navigation has a direct Analytics menu item.
- Empty workspaces show useful empty states rather than broken charts.
- Exports produce JSON and CSV files.
- No forbidden punctuation or emoji in changed first-party files.
- Production build and health checks pass.
