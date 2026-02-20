import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';

export async function GET() {
  const supa = createSupabaseAdminClient();
  const { data, error } = await supa.from('questions').select('*').order('created_at', { ascending: false }).limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const supa = createSupabaseAdminClient();
  const body = await req.json();
  const { id, subject, prompt, question_type, options, correct_answer, max_score, bank_id } = body;
  const payload = { id, subject, prompt, question_type, options, correct_answer, max_score: max_score ?? 1, bank_id };
  const { data, error } = await supa.from('questions').insert(payload).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data?.[0]);
}
