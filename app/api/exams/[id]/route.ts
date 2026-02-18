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
