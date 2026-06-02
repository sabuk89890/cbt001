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
    if (bankId) {
      const { data: qdata, error: qerr } = await supabase
        .from('questions')
        .select('id', { count: 'estimated' })
        .eq('bank_id', bankId);
      const cnt = Array.isArray(qdata) ? qdata.length : 0;
      resolvedSettings.numQuestions = cnt;

      // bank must have at least one question
      if (cnt === 0) {
        return NextResponse.json({ error: 'Bank soal tidak memiliki pertanyaan' }, { status: 400 });
      }
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

function makeRandomToken(length = 6) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let str = "";
  for (let i = 0; i < length; i++) {
    str += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return str;
}

export async function GET(request: Request) {
  try {
    const supabase = createSupabaseAdminClient();
    const url = new URL(request.url);
    const studentId = url.searchParams.get('studentId');

    // first, fetch all sessions for inspection
    let { data, error } = await supabase
      .from("exam_sessions")
      .select("id, title, bank_id, starts_at, ends_at, duration_minutes, settings, target_classes, is_active")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const nowMs = Date.now();
    const updates: Array<{ id: string; settings: any }> = [];

    (data ?? []).forEach((s: any) => {
      const settings = s.settings || {};
      const interval = typeof settings.refreshInterval === 'number' ? settings.refreshInterval : 0;
      const last = settings.tokenUpdatedAt ? Date.parse(String(settings.tokenUpdatedAt)) : null;
      if (interval > 0 && (!last || nowMs - last >= interval * 60000)) {
        const newTok = makeRandomToken(5);
        settings.token = newTok;
        settings.tokenUpdatedAt = new Date().toISOString();
        updates.push({ id: s.id, settings });
      }
    });

    if (updates.length > 0) {
      for (const upd of updates) {
        await supabase.from('exam_sessions').update({ settings: upd.settings }).eq('id', upd.id);
      }
      // refetch after applying updates
      const r2 = await supabase
        .from("exam_sessions")
        .select("id, title, bank_id, starts_at, ends_at, duration_minutes, settings, target_classes, is_active")
        .order("created_at", { ascending: false });
      if (!r2.error) data = r2.data;
    }

    // If a studentId is provided, filter sessions to those relevant for that student:
    // - sessions where target_classes (column or settings.targetClasses) is empty (available to all), OR
    // - sessions where target_classes includes the student's class_name, OR
    // - sessions where the student already has a participant record (started previously)
    if (studentId && Array.isArray(data)) {
      // fetch student's class
      const { data: profile } = await supabase.from('profiles').select('id, class_name').eq('id', studentId).maybeSingle();
      const studentClass = profile?.class_name ?? null;

      // find participant session ids for this student
      const { data: parts } = await supabase.from('exam_participants').select('session_id').eq('student_id', studentId);
      const participantSessionIds = new Set((parts ?? []).map((p: any) => p.session_id));

      const filtered = (data as any[]).filter((s: any) => {
        if (participantSessionIds.has(s.id)) return true;
        const targetCols = Array.isArray(s.target_classes) ? s.target_classes : [];
        const settingsTargets = (s.settings && Array.isArray(s.settings.targetClasses)) ? s.settings.targetClasses : [];
        const targets = Array.from(new Set([...targetCols, ...settingsTargets].filter(Boolean)));
        if (targets.length === 0) return true; // open to all
        if (studentClass && targets.includes(studentClass)) return true;
        return false;
      });

      return NextResponse.json({ data: filtered });
    }

    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
