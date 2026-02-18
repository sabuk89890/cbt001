import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../../lib/supabase/server';

export async function POST(req: Request) {
  const body = await req.json();
  const rows = body.rows || [];
  if (!Array.isArray(rows)) return NextResponse.json({ error: 'invalid rows' }, { status: 400 });
  const supa = createSupabaseAdminClient();
  const { data, error } = await supa.from('questions').insert(rows).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ inserted: data?.length ?? 0 });
}
