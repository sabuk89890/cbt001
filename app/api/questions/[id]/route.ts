import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  normalizeQuestionPayload,
  type QuestionPayload,
} from "@/lib/cbt/question-engine";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as QuestionPayload;
    const normalized = normalizeQuestionPayload({ ...body, id });

    if (!normalized.ok) {
      return NextResponse.json({ error: normalized.error }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("questions")
      .update({
        bank_id: normalized.data.bankId,
        subject: normalized.data.subject,
        prompt: normalized.data.prompt,
        question_type: normalized.data.questionType,
        options: normalized.data.options,
        correct_answer: normalized.data.legacyCorrectAnswer,
        answer_key: normalized.data.answerKey,
        max_score: normalized.data.maxScore,
      })
      .eq("id", id)
      .select("id, bank_id, subject, prompt, question_type, options, correct_answer, answer_key, max_score")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Soal tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        id: data.id,
        bankId: data.bank_id ?? null,
        subject: data.subject,
        prompt: data.prompt,
        questionType: data.question_type,
        options: data.options,
        correctAnswer: data.correct_answer,
        answerKey: data.answer_key,
        maxScore: data.max_score,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    const supabase = createSupabaseAdminClient();
    const { error, count } = await supabase
      .from("questions")
      .delete({ count: "exact" })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!count) {
      return NextResponse.json({ error: "Soal tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({ message: "Soal berhasil dihapus" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
