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
    let computedRawScore = 0;
    let totalMaxScore = 0;
    let gradingDetails: any[] = [];
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
          gradingDetails.push(detail);
          computedRawScore += detail.finalScore ?? 0;
          totalMaxScore += Number(q.max_score) || 0;
        }
      }
    } catch (e) {
      computedRawScore = 0;
      totalMaxScore = 0;
      gradingDetails = [];
    }

    // compute percentage score consistent with submit flow
    const { calculatePercentage, computeStatusFromPercentage } = await import("@/lib/cbt/question-engine");
    const percentageScore = totalMaxScore > 0 ? calculatePercentage(computedRawScore, totalMaxScore) : 0;

    const { error: upErr } = await supabase.from("exam_participants").update({ finished_at: new Date().toISOString(), status: "stopped", score: percentageScore }).eq("id", participantId);

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    // also record an exam_submissions row so reports include this forced stop
    try {
      // create or update an exam_submissions row so reports include this forced stop
      if (participant.student_id) {
        const matchCond = { session_id: participant.session_id, student_id: participant.student_id };
        const existing = await supabase.from('exam_submissions').select('id').match(matchCond).limit(1).maybeSingle();

        const payload = {
          session_id: participant.session_id,
          student_id: participant.student_id,
          answers: participant.answers ?? {},
          score: percentageScore,
          status: computeStatusFromPercentage(percentageScore),
          auto_score: percentageScore,
          manual_adjustment: 0,
          grading_detail: gradingDetails,
          needs_manual_review: gradingDetails.some((d:any) => d.needsManualReview),
          review_status: gradingDetails.some((d:any) => d.needsManualReview) ? 'auto' : 'reviewed',
          created_at: new Date().toISOString(),
        };

        if (existing && existing.data && existing.data.id) {
          await supabase.from('exam_submissions').update(payload).eq('id', existing.data.id);
        } else {
          await supabase.from('exam_submissions').insert(payload);
        }
      }
    } catch (e) {
      // non-fatal: continue even if submission insert/update fails, but surface to logs
      console.error('force-stop: failed to insert/update exam_submissions', e);
    }

    return NextResponse.json({ data: { participantId, score: percentageScore } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
