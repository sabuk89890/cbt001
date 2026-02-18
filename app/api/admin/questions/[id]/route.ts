import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../../lib/supabase/server';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const supa = createSupabaseAdminClient();
  const { data, error } = await supa.from('questions').select('*').eq('id', params.id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const supa = createSupabaseAdminClient();
  const { data, error } = await supa.from('questions').update(body).eq('id', params.id).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data?.[0]);
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const supa = createSupabaseAdminClient();
  const { error } = await supa.from('questions').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
