import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string; participantId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { participantId } = await context.params;
  try {
    const supabase = createSupabaseAdminClient();

    // fetch session/student identifiers so we can also purge any submission row
    const { data: partData, error: fpErr } = await supabase
      .from("exam_participants")
      .select("session_id, student_id")
      .eq("id", participantId)
      .single();
    if (fpErr) {
      // participant may already be gone, nothing else to do
    }
    const sessId = partData?.session_id;
    const studId = partData?.student_id;

    // delete any session_questions tied to this participant
    const { error: delQs } = await supabase.from("session_questions").delete().eq("participant_id", participantId);
    if (delQs) {
      return NextResponse.json({ error: delQs.message }, { status: 500 });
    }

    // delete the participant row itself
    const { error: partErr } = await supabase.from("exam_participants").delete().eq("id", participantId);
    if (partErr) {
      return NextResponse.json({ error: partErr.message }, { status: 500 });
    }

    // if we know session & student, also drop any submission so reports forget
    if (sessId && studId) {
      await supabase.from("exam_submissions").delete().eq("session_id", sessId).eq("student_id", studId);
    }

    return NextResponse.json({ data: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
