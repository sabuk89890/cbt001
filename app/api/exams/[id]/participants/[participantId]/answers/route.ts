import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string; participantId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { participantId } = await context.params;
    const supabase = createSupabaseAdminClient();

    const { data: participant, error } = await supabase
      .from("exam_participants")
      .select("id, answers")
      .eq("id", participantId)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data: { answers: (participant?.answers as Record<string, unknown>) ?? {} } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const body = await request.json();
    const { participantId } = await context.params;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "answers required in body" }, { status: 400 });
    }

    const incoming = (body.answers ?? {}) as Record<string, unknown>;
    const merge = Boolean(body.merge ?? true);

    const supabase = createSupabaseAdminClient();

    if (merge) {
      // fetch current answers first
      const { data: current, error: curErr } = await supabase
        .from("exam_participants")
        .select("answers")
        .eq("id", participantId)
        .maybeSingle();
      if (curErr) return NextResponse.json({ error: curErr.message }, { status: 500 });

      const base = (current?.answers as Record<string, unknown>) ?? {};
      const merged = { ...base, ...incoming };

      const { error: upErr } = await supabase
        .from("exam_participants")
        .update({ answers: merged })
        .eq("id", participantId);
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

      return NextResponse.json({ data: { answers: merged } });
    }

    // replace
    const { error: upErr } = await supabase.from("exam_participants").update({ answers: incoming }).eq("id", participantId);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    return NextResponse.json({ data: { answers: incoming } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
