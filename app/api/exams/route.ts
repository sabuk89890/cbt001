import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, title, bankId, startsAt, endsAt, durationMinutes, settings, targetClasses } = body;
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

    // Attempt insert including starts_at / ends_at. If the DB schema doesn't have those columns
    // (older schemas), fall back to storing them inside `settings` and retry without columns.
    let insertResult: any;
    let insertError: any;
    try {
      insertResult = await supabase.from("exam_sessions").insert({
        id,
        title,
        bank_id: bankId,
        starts_at: startsAt ? new Date(startsAt) : null,
        ends_at: endsAt ? new Date(endsAt) : null,
        duration_minutes: durationMinutes ?? null,
        settings: resolvedSettings,
        target_classes: targetClasses ?? [],
        is_active: false,
      }).select("id, title, bank_id, starts_at, ends_at, duration_minutes, settings, is_active").single();
    } catch (e) {
      insertError = e as Error;
    }

    // supabase client may return error via result.error or throw; normalize
    if (!insertResult || insertResult.error) {
      const errMsg = insertResult?.error?.message ?? insertError?.message ?? '';
      // detect missing column errors for starts_at/ends_at
      // detect missing columns and fall back to storing those values inside `settings`
      if (/ends?_at/.test(errMsg) || /target_classes/.test(errMsg) || /column .* does not exist/.test(errMsg)) {
        const fallbackSettings = { ...resolvedSettings };
        if (startsAt) fallbackSettings.startsAt = startsAt;
        if (endsAt) fallbackSettings.endsAt = endsAt;
        if (targetClasses && Array.isArray(targetClasses) && targetClasses.length) fallbackSettings.targetClasses = targetClasses;

        // Retry insert without starts_at/ends_at/target_classes columns
        const fallback = await supabase.from("exam_sessions").insert({
          id,
          title,
          bank_id: bankId,
          duration_minutes: durationMinutes ?? null,
          settings: fallbackSettings,
          is_active: false,
        }).select("id, title, bank_id, duration_minutes, settings, is_active").single();

        if (fallback.error) {
          return NextResponse.json({ error: fallback.error.message }, { status: 500 });
        }

        return NextResponse.json({ data: fallback.data }, { status: 201 });
      }

      return NextResponse.json({ error: errMsg || 'Gagal membuat sesi' }, { status: 500 });
    }

    return NextResponse.json({ data: insertResult.data }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from("exam_sessions").select("id, title, bank_id, starts_at, duration_minutes, settings, is_active").order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
