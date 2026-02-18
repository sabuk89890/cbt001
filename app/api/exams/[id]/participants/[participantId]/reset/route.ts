import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string; participantId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { participantId } = await context.params;
  try {
    const supabase = createSupabaseAdminClient();

    // clear answers and reset status
    const { error } = await supabase.from("exam_participants").update({ answers: {}, status: "not_started", started_at: null, finished_at: null, score: null }).eq("id", participantId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // remove any session_questions for this participant
    const { error: delErr } = await supabase.from("session_questions").delete().eq("participant_id", participantId);
    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    return NextResponse.json({ data: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
