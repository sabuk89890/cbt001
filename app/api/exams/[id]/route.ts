import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const supabase = createSupabaseAdminClient();
    const { id } = await context.params;

    const { data: session, error: sessErr } = await supabase
      .from("exam_sessions")
      .select("id, title, bank_id, starts_at, duration_minutes, settings, is_active")
      .eq("id", id)
      .single();

    if (sessErr) {
      return NextResponse.json({ error: sessErr.message }, { status: 500 });
    }

    const { data: participants, error: partErr } = await supabase
      .from("exam_participants")
      .select("id, student_id, started_at, finished_at, status, score, updated_at, created_at")
      .eq("session_id", id)
      .order("created_at", { ascending: true });

    if (partErr) {
      return NextResponse.json({ error: partErr.message }, { status: 500 });
    }

    // enrich participants with profile data (full_name, username, class_name) and compute duration (seconds)
    const studentIds = Array.from(new Set((participants ?? []).map((p: any) => p.student_id).filter(Boolean)));
    let profiles: any[] = [];
    if (studentIds.length > 0) {
      const { data: pData } = await supabase.from('profiles').select('id, full_name, username, class_name').in('id', studentIds);
      profiles = pData ?? [];
    }

    const enriched = (participants ?? []).map((p: any) => {
      const prof = profiles.find((x: any) => x.id === p.student_id) ?? null;
      // duration: prefer finished_at - started_at; fallback to created_at (participant) - started_at
      let durationSeconds: number | null = null;
      try {
        const started = p.started_at ? Date.parse(String(p.started_at)) : null;
        const finished = p.finished_at ? Date.parse(String(p.finished_at)) : (p.created_at ? Date.parse(String(p.created_at)) : null);
        if (started && finished) durationSeconds = Math.max(0, Math.round((finished - started) / 1000));
      } catch (e) {
        durationSeconds = null;
      }
      return {
        ...p,
        full_name: prof?.full_name ?? null,
        username: prof?.username ?? null,
        class_name: prof?.class_name ?? null,
        duration_seconds: durationSeconds,
      };
    });

    return NextResponse.json({ data: { session, participants: enriched } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const supabase = createSupabaseAdminClient();
    const { id } = await context.params;

    const { error } = await supabase.from('exam_sessions').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data: { ok: true } }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const body = await request.json();
    const { id } = await context.params;

    const update: any = {};
    if (body.title !== undefined) update.title = body.title;
    if (body.bankId !== undefined) update.bank_id = body.bankId;
    if (body.startsAt !== undefined) update.starts_at = body.startsAt ? new Date(body.startsAt) : null;
    if (body.durationMinutes !== undefined) update.duration_minutes = body.durationMinutes === null ? null : Number(body.durationMinutes);
    if (body.settings !== undefined) update.settings = body.settings;
    if (body.isActive !== undefined) update.is_active = body.isActive;

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from('exam_sessions').update(update).eq('id', id).select('id, title, bank_id, starts_at, duration_minutes, settings, is_active').single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
