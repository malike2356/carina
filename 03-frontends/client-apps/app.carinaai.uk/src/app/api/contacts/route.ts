import { NextRequest } from 'next/server';
import { handleAivaProxy } from '@/lib/aiva-route';

/** List all contacts (manual + Google + CSV). */
export async function GET(request: NextRequest) {
  return handleAivaProxy(request, '/api/contacts-sync/');
}

/** Create a manual contact. Body: { name, email?, phone?, ... } */
export async function POST(request: NextRequest) {
  return handleAivaProxy(request, '/api/contacts-sync/manual');
}
