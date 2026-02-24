import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';

export async function GET() {
  const supa = createSupabaseAdminClient();
  const { data, error } = await supa.from('questions').select('*').order('created_at', { ascending: false }).limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

import { normalizeQuestionPayload, type QuestionPayload } from '../../../../lib/cbt/question-engine';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as QuestionPayload;
    const normalized = normalizeQuestionPayload(body);
    if (!normalized.ok) {
      return NextResponse.json({ error: normalized.error }, { status: 400 });
    }

    const supa = createSupabaseAdminClient();
    const { data, error } = await supa
      .from('questions')
      .insert({
        id: normalized.data.id,
        bank_id: normalized.data.bankId,
        subject: normalized.data.subject,
        prompt: normalized.data.prompt,
        question_type: normalized.data.questionType,
        options: normalized.data.options,
        correct_answer: normalized.data.legacyCorrectAnswer,
        answer_key: normalized.data.answerKey,
        max_score: normalized.data.maxScore,
      })
      .select();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'ID soal sudah ada' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data?.[0]);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
