import { NextResponse } from 'next/server';
import { getCurrentLegalDocuments } from '@/lib/legal/documents';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const documents = await getCurrentLegalDocuments();
  return NextResponse.json({
    documents: documents.map((doc) => ({
      type: doc.type,
      version: doc.version,
      url: doc.url,
    })),
  });
}
