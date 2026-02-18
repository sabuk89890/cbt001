import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const supabase = createSupabaseAdminClient();
    const { id } = await context.params;

    const { data: session, error: sessErr } = await supabase
      .from("exam_sessions")
      .select("id, title, bank_id, starts_at, ends_at, duration_minutes, settings, is_active")
      .eq("id", id)
      .single();

    if (sessErr) {
      return NextResponse.json({ error: sessErr.message }, { status: 500 });
    }

    const { data: participants, error: partErr } = await supabase
      .from("exam_participants")
      .select("id, student_id, started_at, finished_at, status, score, updated_at")
      .eq("session_id", id)
      .order("created_at", { ascending: true });

    if (partErr) {
      return NextResponse.json({ error: partErr.message }, { status: 500 });
    }

    return NextResponse.json({ data: { session, participants } });
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
    if (body.endsAt !== undefined) update.ends_at = body.endsAt ? new Date(body.endsAt) : null;
    if (body.durationMinutes !== undefined) update.duration_minutes = body.durationMinutes === null ? null : Number(body.durationMinutes);
    if (body.settings !== undefined) update.settings = body.settings;
    if (body.isActive !== undefined) update.is_active = body.isActive;

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from('exam_sessions').update(update).eq('id', id).select('id, title, bank_id, starts_at, ends_at, duration_minutes, settings, is_active').single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
