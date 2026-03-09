import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();
    // export limited set of tables
    const { data: profiles } = await supabase.from('profiles').select('*');
    const { data: question_banks } = await supabase.from('question_banks').select('*');
    const { data: questions } = await supabase.from('questions').select('*');
    const { data: exam_sessions } = await supabase.from('exam_sessions').select('*');
    const { data: exam_participants } = await supabase.from('exam_participants').select('*');
    const { data: exam_submissions } = await supabase.from('exam_submissions').select('*');
    const { data: system_settings } = await supabase.from('system_settings').select('*');

    return NextResponse.json({ profiles, question_banks, questions, exam_sessions, exam_participants, exam_submissions, system_settings });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = createSupabaseAdminClient();
    // naive restore: insert/replace by primary key where possible
    if (body.profiles) {
      for (const p of body.profiles) await supabase.from('profiles').upsert(p, { onConflict: 'id' });
    }
    if (body.question_banks) {
      for (const q of body.question_banks) await supabase.from('question_banks').upsert(q, { onConflict: 'id' });
    }
    if (body.questions) {
      for (const q of body.questions) await supabase.from('questions').upsert(q, { onConflict: 'id' });
    }
    if (body.exam_sessions) {
      for (const s of body.exam_sessions) await supabase.from('exam_sessions').upsert(s, { onConflict: 'id' });
    }
    if (body.exam_participants) {
      for (const ep of body.exam_participants) await supabase.from('exam_participants').upsert(ep, { onConflict: 'id' });
    }
    if (body.exam_submissions) {
      for (const es of body.exam_submissions) await supabase.from('exam_submissions').upsert(es, { onConflict: 'id' });
    }
    if (body.system_settings) {
      for (const ss of body.system_settings) await supabase.from('system_settings').upsert(ss, { onConflict: 'key' });
    }

    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
