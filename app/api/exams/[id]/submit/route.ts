import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  calculatePercentage,
  computeStatusFromPercentage,
  gradeQuestion,
  type GradingDetail,
  type QuestionRow,
} from "@/lib/cbt/question-engine";

type SubmitPayload = {
  answers?: Record<string, unknown>;
  studentId?: string;
};

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as SubmitPayload;

    if (!body.answers || Object.keys(body.answers).length === 0) {
      return NextResponse.json({ error: "answers wajib diisi" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const questionIds = Object.keys(body.answers);

    const { data: questions, error: questionsError } = await supabase
      .from("questions")
      .select("id, subject, prompt, question_type, options, correct_answer, answer_key, max_score")
      .in("id", questionIds as string[]);

    if (questionsError) {
      return NextResponse.json({ error: questionsError.message }, { status: 500 });
    }

    const validQuestions = (questions ?? []) as QuestionRow[];
    const total = validQuestions.length;
    if (total === 0) {
      return NextResponse.json(
        { error: "Soal untuk sesi ini tidak ditemukan" },
        { status: 404 }
      );
    }

    const details: GradingDetail[] = validQuestions.map((question) =>
      gradeQuestion(question, body.answers?.[question.id])
    );

    const autoRawScore = details.reduce((sum, item) => sum + item.autoScore, 0);
    const totalMaxScore = details.reduce((sum, item) => sum + item.maxScore, 0);
    const score = calculatePercentage(autoRawScore, totalMaxScore);
    const status = computeStatusFromPercentage(score);
    const needsManualReview = details.some((item) => item.needsManualReview);
    const autoCorrectCount = details.filter(
      (item) => item.autoScore >= item.maxScore && item.maxScore > 0
    ).length;

    const { error: sessionError } = await supabase
      .from("exam_sessions")
      .upsert({ id }, { onConflict: "id" });

    if (sessionError) {
      return NextResponse.json({ error: sessionError.message }, { status: 500 });
    }

    const { data: submission, error: submissionError } = await supabase
      .from("exam_submissions")
      .insert({
        session_id: id,
        student_id: body.studentId ?? null,
        answers: body.answers,
        score,
        status,
        auto_score: score,
        manual_adjustment: 0,
        grading_detail: details,
        needs_manual_review: needsManualReview,
        review_status: needsManualReview ? "auto" : "reviewed",
      })
      .select("id, created_at")
      .single();

    if (submissionError) {
      return NextResponse.json({ error: submissionError.message }, { status: 500 });
    }

    return NextResponse.json({
      sessionId: id,
      submissionId: submission.id,
      submittedAt: submission.created_at,
      total,
      autoCorrectCount,
      totalMaxScore,
      autoRawScore,
      score,
      status,
      needsManualReview,
      details,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
