# Prompt 04: Scout Reporting System


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Context

Security teams need to share Scout findings with management and clients. The reporting
system generates PDF reports and CSV exports from Scout data, and sends scheduled email
digests.

## What to Build

### 1. Report templates

Three report types:

**Executive Summary (PDF):** 2-page visual report
- Scout Score history chart
- Severity breakdown pie chart
- Top 5 open findings
- Compliance status table
- Trend summary (improving/degrading)

**Technical Report (PDF):** Full detail
- All events in date range
- CVSS scores for each CVE finding
- Asset inventory with risk levels
- Remediation recommendations
- Appendix: evidence links

**CSV Export:** Raw event data
- All columns from `events` table
- One row per event
- UTF-8 with BOM for Excel compatibility

### 2. PDF generation

Use `@react-pdf/renderer` for PDF generation (type-safe, no headless browser needed):
```bash
pnpm add @react-pdf/renderer
```

Create `console.labyrinthscout.com/src/reports/executive-pdf.tsx`:
```tsx
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

export function ExecutiveReport({ data }: { data: ReportData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Scout Security Report</Text>
          <Text style={styles.subtitle}>{formatDateRange(data.period)}</Text>
        </View>
        <View style={styles.scoreSection}>
          <Text style={styles.sectionTitle}>Scout Score</Text>
          <Text style={styles.score}>{data.currentScore}</Text>
          <Text style={styles.trend}>{data.trend}</Text>
        </View>
        {/* ... severity breakdown, top findings, etc. */}
      </Page>
    </Document>
  );
}
```

### 3. Report generation API

```
POST /api/reports/generate
  Body: { type: 'executive'|'technical'|'csv', startDate, endDate, format: 'pdf'|'csv' }
  Returns: 202 { reportId }

GET /api/reports/:id/status
  Returns: { status: 'generating'|'ready'|'failed', url?: string }

GET /api/reports/:id/download
  Returns: file download
```

Reports are generated asynchronously (can take 10-30 seconds for large date ranges).

### 4. Scheduled email digests

In `console.labyrinthscout.com/src/reports/digest.ts`:
```typescript
export async function sendWeeklyDigest(tenantId: string): Promise<void> {
  const data = await gatherReportData(tenantId, 7); // last 7 days
  const pdf = await renderToPdf(<ExecutiveReport data={data} />);

  await resend.emails.send({
    from: 'Scout <reports@scout.carinaai.uk>',
    to: await getDigestRecipients(tenantId),
    subject: `Scout Weekly Digest - Score: ${data.currentScore}`,
    html: buildDigestEmailHtml(data),
    attachments: [{ filename: 'scout-weekly.pdf', content: pdf }],
  });
}
```

Run via cron every Monday at 8 AM UTC.

### 5. Report history UI

In the dashboard "Reports" tab:
- List of generated reports (date, type, size, download link)
- "Generate Report" button with type/date range form
- Digest schedule configuration (enable/disable, recipient emails, frequency)

## Verification Checklist

- [ ] POST /api/reports/generate returns 202 with reportId
- [ ] Poll status endpoint - moves from 'generating' to 'ready' within 30 seconds
- [ ] Download PDF - opens valid PDF with score gauge and severity breakdown
- [ ] CSV export contains all events in date range with correct columns
- [ ] Weekly digest email arrives with attached PDF every Monday 8 AM UTC

## Files to Create or Modify

- CREATE `console.labyrinthscout.com/src/reports/executive-pdf.tsx`
- CREATE `console.labyrinthscout.com/src/reports/technical-pdf.tsx`
- CREATE `console.labyrinthscout.com/src/reports/csv-export.ts`
- CREATE `console.labyrinthscout.com/src/reports/digest.ts`
- MODIFY `console.labyrinthscout.com/src/server.ts` - add report API routes + digest cron
- MODIFY `console.labyrinthscout.com/public/dashboard.html` - add Reports tab
