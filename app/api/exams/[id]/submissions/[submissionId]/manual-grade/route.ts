import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  calculatePercentage,
  computeStatusFromPercentage,
  type GradingDetail,
} from "@/lib/cbt/question-engine";

type RouteContext = {
  params: Promise<{ id: string; submissionId: string }>;
};

type ManualGradePayload = {
  reviewerId?: string;
  reviewNote?: string;
  essayScores?: Array<{
    questionId: string;
    manualScore: number;
    notes?: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id, submissionId } = await context.params;
    const supabase = createSupabaseAdminClient();

    const { data: submission, error: submissionError } = await supabase
      .from("exam_submissions")
      .select(
        "id, session_id, student_id, answers, score, auto_score, manual_adjustment, status, needs_manual_review, review_status, grading_detail"
      )
      .eq("id", submissionId)
      .eq("session_id", id)
      .maybeSingle();

    if (submissionError) {
      return NextResponse.json({ error: submissionError.message }, { status: 500 });
    }

    if (!submission) {
      return NextResponse.json({ error: "Submission tidak ditemukan" }, { status: 404 });
    }

    const answers =
      submission.answers && typeof submission.answers === "object" && !Array.isArray(submission.answers)
        ? (submission.answers as Record<string, unknown>)
        : {};

    const questionIdsFromAnswers = Object.keys(answers);
    const questionIdsFromDetail = Array.isArray(submission.grading_detail)
      ? (submission.grading_detail as Array<{ questionId?: string }>)
          .map((item) => item.questionId)
          .filter((item): item is string => typeof item === "string")
      : [];

    const questionIds = [...new Set([...questionIdsFromAnswers, ...questionIdsFromDetail])];

    const { data: questions, error: questionsError } = await supabase
      .from("questions")
      .select("id, subject, prompt, question_type, options, correct_answer, answer_key, max_score")
      .in("id", questionIds)
      .order("created_at", { ascending: true });

    if (questionsError) {
      return NextResponse.json({ error: questionsError.message }, { status: 500 });
    }

    return NextResponse.json({
      submission: {
        id: submission.id,
        sessionId: submission.session_id,
        studentId: submission.student_id,
        answers,
        score: submission.score,
        autoScore: submission.auto_score,
        manualAdjustment: submission.manual_adjustment,
        status: submission.status,
        needsManualReview: submission.needs_manual_review,
        reviewStatus: submission.review_status,
        gradingDetail: Array.isArray(submission.grading_detail)
          ? submission.grading_detail
          : [],
      },
      questions: (questions ?? []).map((question) => ({
        id: question.id,
        subject: question.subject,
        prompt: question.prompt,
        questionType: question.question_type,
        options: question.options,
        correctAnswer: question.correct_answer,
        answerKey: question.answer_key,
        maxScore: question.max_score,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id, submissionId } = await context.params;
    const body = (await request.json()) as ManualGradePayload;

    if (!body.essayScores?.length) {
      return NextResponse.json(
        { error: "essayScores wajib diisi" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    const { data: submission, error: submissionError } = await supabase
      .from("exam_submissions")
      .select("id, session_id, grading_detail, auto_score")
      .eq("id", submissionId)
      .eq("session_id", id)
      .maybeSingle();

    if (submissionError) {
      return NextResponse.json({ error: submissionError.message }, { status: 500 });
    }

    if (!submission) {
      return NextResponse.json({ error: "Submission tidak ditemukan" }, { status: 404 });
    }

    const gradingDetail = Array.isArray(submission.grading_detail)
      ? (submission.grading_detail as GradingDetail[])
      : [];

    if (!gradingDetail.length) {
      return NextResponse.json(
        { error: "Data grading_detail tidak tersedia" },
        { status: 400 }
      );
    }

    const updateMap = new Map(
      body.essayScores.map((item) => [item.questionId, item])
    );

    const nextDetails = gradingDetail.map((item) => {
      if (item.questionType !== "essay") {
        return item;
      }

      const update = updateMap.get(item.questionId);
      if (!update) {
        return item;
      }

      const normalizedScore = clamp(Math.round(update.manualScore), 0, item.maxScore);

      return {
        ...item,
        manualScore: normalizedScore,
        finalScore: normalizedScore,
        notes: update.notes ?? item.notes,
      };
    });

    const totalMaxScore = nextDetails.reduce((sum, item) => sum + item.maxScore, 0);
    const finalRawScore = nextDetails.reduce((sum, item) => sum + item.finalScore, 0);
    const autoPercentage = Number(submission.auto_score ?? 0);
    const finalPercentage = calculatePercentage(finalRawScore, totalMaxScore);
    const manualAdjustment = finalPercentage - autoPercentage;
    const status = computeStatusFromPercentage(finalPercentage);

    const { error: updateError } = await supabase
      .from("exam_submissions")
      .update({
        score: finalPercentage,
        status,
        manual_adjustment: manualAdjustment,
        grading_detail: nextDetails,
        needs_manual_review: false,
        review_status: "reviewed",
        reviewed_by: body.reviewerId ?? null,
        review_note: body.reviewNote ?? null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", submissionId)
      .eq("session_id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      message: "Koreksi manual berhasil disimpan",
      submissionId,
      sessionId: id,
      score: finalPercentage,
      status,
      manualAdjustment,
      details: nextDetails,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
