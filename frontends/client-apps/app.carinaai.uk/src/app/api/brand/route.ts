import { NextResponse } from 'next/server';
import { getPublicBrand } from '@/lib/server-brand';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ data: getPublicBrand() });
}
