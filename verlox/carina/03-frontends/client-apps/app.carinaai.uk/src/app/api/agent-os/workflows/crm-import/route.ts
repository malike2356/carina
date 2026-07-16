import { NextResponse } from 'next/server';
import { cleanCrmCsv, rowsToCsv } from '@/lib/agent-os-crm-clean';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { csv?: string };
  const csv = String(body.csv ?? '');
  if (!csv.trim()) {
    return NextResponse.json({ error: 'csv text is required' }, { status: 400 });
  }

  const cleaned = cleanCrmCsv(csv);
  if (!cleaned.rows.length) {
    return NextResponse.json(
      { error: cleaned.errors[0] || 'No rows to import', details: cleaned },
      { status: 400 },
    );
  }

  const download = rowsToCsv(cleaned.columns, cleaned.rows);
  return NextResponse.json({
    summary: {
      rows: cleaned.rows.length,
      removedDuplicates: cleaned.removedDuplicates,
      columns: cleaned.columns,
      errors: cleaned.errors,
    },
    preview: cleaned.rows.slice(0, 5),
    csv: download,
    note: 'Contacts map to Carina first. Connectors like HubSpot are not invented here.',
  });
}
