import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string; participantId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id: sessionId, participantId } = await context.params;
    const supabase = createSupabaseAdminClient();

    // fetch session_questions for participant, ordered by order_index
    const { data: sQuestions, error: sqErr } = await supabase
      .from('session_questions')
      .select('id, question_id, order_index, shuffled_options')
      .eq('participant_id', participantId)
      .order('order_index', { ascending: true });

    if (sqErr) {
      return NextResponse.json({ error: sqErr.message }, { status: 500 });
    }

    const qIds = (sQuestions ?? []).map((r: any) => r.question_id).filter(Boolean);
    if (qIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const { data: qRows, error: qErr } = await supabase
      .from('questions')
      .select('id, bank_id, subject, prompt, question_type, options, answer_key, max_score')
      .in('id', qIds as string[]);

    if (qErr) {
      return NextResponse.json({ error: qErr.message }, { status: 500 });
    }

    const qMap = new Map((qRows ?? []).map((q: any) => [q.id, q]));

    const result = (sQuestions ?? []).map((sq: any) => {
      const q = qMap.get(sq.question_id) || {};
      return {
        sessionQuestionId: sq.id,
        orderIndex: sq.order_index,
        id: q.id,
        bankId: q.bank_id ?? null,
        subject: q.subject ?? null,
        prompt: q.prompt ?? "",
        questionType: q.question_type ?? 'multiple-choice',
        options: (sq.shuffled_options && Array.isArray(sq.shuffled_options) && sq.shuffled_options.length > 0) ? sq.shuffled_options : (q.options ?? []),
        answerKey: q.answer_key ?? {},
        maxScore: q.max_score ?? 1,
      };
    });

    return NextResponse.json({ data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
