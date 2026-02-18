import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, title, bankId, startsAt, endsAt, durationMinutes, settings } = body;
    if (!id || !title) {
      return NextResponse.json({ error: "Missing id or title" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    // if bankId provided and settings.numQuestions missing, compute question count
    let resolvedSettings = settings ?? {};
    if (bankId && (resolvedSettings.numQuestions === undefined || resolvedSettings.numQuestions === null)) {
      const { data: qdata, error: qerr, count } = await supabase
        .from('questions')
        .select('id', { count: 'estimated' })
        .eq('bank_id', bankId);
      const cnt = Array.isArray(qdata) ? qdata.length : 0;
      resolvedSettings.numQuestions = cnt;
    }

    const { data, error } = await supabase.from("exam_sessions").insert({
      id,
      title,
      bank_id: bankId,
      starts_at: startsAt ? new Date(startsAt) : null,
      ends_at: endsAt ? new Date(endsAt) : null,
      duration_minutes: durationMinutes ?? null,
      settings: resolvedSettings,
      is_active: false,
    }).select("id, title, bank_id, starts_at, ends_at, duration_minutes, settings, is_active").single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from("exam_sessions").select("id, title, bank_id, starts_at, ends_at, duration_minutes, settings, is_active").order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
