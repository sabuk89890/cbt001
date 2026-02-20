import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../../lib/supabase/server';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const { id } = await context.params;
  const supa = createSupabaseAdminClient();
  const { data, error } = await supa.from('questions').select('*').eq('id', id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await req.json();
  const supa = createSupabaseAdminClient();
  const { data, error } = await supa.from('questions').update(body).eq('id', id).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data?.[0]);
}

export async function DELETE(_req: Request, context: RouteContext) {
  const { id } = await context.params;
  const supa = createSupabaseAdminClient();
  const { error } = await supa.from('questions').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
