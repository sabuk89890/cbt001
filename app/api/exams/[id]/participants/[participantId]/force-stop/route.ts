import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { gradeQuestion } from "@/lib/cbt/question-engine";

type RouteContext = { params: Promise<{ id: string; participantId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const supabase = createSupabaseAdminClient();
    const { participantId } = await context.params;

    // fetch participant
    const { data: participant, error: pErr } = await supabase.from("exam_participants").select("id, session_id, student_id, answers").eq("id", participantId).single();
    if (pErr || !participant) {
      return NextResponse.json({ error: pErr?.message ?? "participant not found" }, { status: 404 });
    }

    // grade answers using existing question engine helper (best-effort)
    const answersMap = participant.answers || {};
    let computedScore = 0;
    try {
      // fetch session questions for participant
      const { data: sQuestions } = await supabase.from("session_questions").select("question_id").eq("participant_id", participantId);
      const qIds = Array.isArray(sQuestions) ? sQuestions.map((q: any) => q.question_id) : [];
      if (qIds.length > 0) {
        const { data: qRows } = await supabase.from("questions").select("id, question_type, options, answer_key, max_score").in("id", qIds);
        const rows = Array.isArray(qRows) ? qRows : [];
        for (const q of rows) {
          const submitted = (answersMap as any)[q.id];
          const detail = gradeQuestion(q as any, submitted);
          computedScore += detail.finalScore ?? 0;
        }
      }
    } catch (e) {
      computedScore = 0;
    }

    const { error: upErr } = await supabase.from("exam_participants").update({ finished_at: new Date().toISOString(), status: "stopped", score: computedScore }).eq("id", participantId);

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    return NextResponse.json({ data: { participantId, score: computedScore } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
