import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  normalizeQuestionPayload,
  type QuestionPayload,
  type QuestionRow,
} from "@/lib/cbt/question-engine";

function mapQuestion(row: QuestionRow) {
  return {
    id: row.id,
    subject: row.subject,
    prompt: row.prompt,
    questionType: row.question_type,
    options: row.options,
    correctAnswer: row.correct_answer,
    answerKey: row.answer_key,
    maxScore: row.max_score,
  };
}

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("questions")
      .select("id, subject, prompt, question_type, options, correct_answer, answer_key, max_score")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data: (data as QuestionRow[] | null)?.map(mapQuestion) ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as QuestionPayload;
    const normalized = normalizeQuestionPayload(body);

    if (!normalized.ok) {
      return NextResponse.json({ error: normalized.error }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("questions")
      .insert({
        id: normalized.data.id,
        subject: normalized.data.subject,
        prompt: normalized.data.prompt,
        question_type: normalized.data.questionType,
        options: normalized.data.options,
        correct_answer: normalized.data.legacyCorrectAnswer,
        answer_key: normalized.data.answerKey,
        max_score: normalized.data.maxScore,
      })
      .select("id, subject, prompt, question_type, options, correct_answer, answer_key, max_score")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "ID soal sudah ada" }, { status: 409 });
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { data: mapQuestion(data as QuestionRow) },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
