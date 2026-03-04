import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
// import type { QuestionRow } from "@/lib/cbt/question-engine"; // unused

/* eslint-disable @typescript-eslint/no-explicit-any */

// helper to return a simple message for disallowed methods. returning a
// 200 avoids confusing the client if it accidentally issues a GET/OPTIONS (the
// old code used to simply let Next return 405 which surfaced as “Server error
// 405” in the UI and led to a lot of confusion).
function methodNotAllowed() {
  return NextResponse.json(
    { error: 'Gunakan POST untuk merestore soal (endpoint hanya menerima POST)' },
    { status: 405 }
  );
}

export async function GET() {
  // we deliberately return 405 with a friendly message rather than leaving the
  // default 405 HTML page so that if a fetch somehow uses GET the client code
  // can display something more useful.
  return methodNotAllowed();
}

export async function OPTIONS() {
  // support preflight just in case; Next.js does not generate an OPTIONS
  // handler automatically for an API route, so add one to avoid a 405 if the
  // browser happens to send a preflight request.
  return NextResponse.json({}, { status: 204 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // payload can be one of:
    //  - legacy array of questions
    //  - object { questions, bank? }
    //  - object { questions, banks: [...] } (new global backup)
    let questions: any[] = [];
    // single bank info (old format)
    let bank: any | null = null;
    // multiple banks info (new format)
    let banks: any[] | null = null;

    if (Array.isArray(body)) {
      questions = body;
    } else if (body && typeof body === "object") {
      if (Array.isArray((body as any).banks)) {
        banks = (body as any).banks;
      }
      if (Array.isArray((body as any).questions)) {
        questions = (body as any).questions;
      }
      if ((body as any).bank) {
        bank = (body as any).bank;
      }
    }

    if (questions.length === 0 && !banks) {
      return NextResponse.json({ error: "Invalid restore payload" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    // upsert multiple banks first if provided
    if (banks && banks.length > 0) {
      for (const b of banks) {
        if (b && b.id) {
          await supabase.from("question_banks").upsert({
            id: b.id,
            title: b.title,
            subject: b.subject ?? null,
            target_classes: b.targetClasses ?? null,
            owner_teacher_id: b.ownerTeacherId,
          });
        }
      }
    }

    // if single bank metadata included (legacy) also upsert it
    if (bank && bank.id) {
      await supabase.from("question_banks").upsert({
        id: bank.id,
        title: bank.title,
        subject: bank.subject ?? null,
        target_classes: bank.targetClasses ?? null,
        owner_teacher_id: bank.ownerTeacherId,
      });
    }

    // convert questions to DB column names
    const toInsert = questions.map((q: any) => ({
      id: q.id,
      bank_id: q.bankId ?? null,
      subject: q.subject,
      prompt: q.prompt,
      question_type: q.questionType,
      options: q.options,
      correct_answer: q.correctAnswer,
      answer_key: q.answerKey,
      max_score: q.maxScore,
    }));

    let error;
    if (toInsert.length > 0) {
      ({ error } = await supabase
        .from("questions")
        .upsert(toInsert, { onConflict: "id" }));
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: { inserted: toInsert.length, bankCreated: !!bank } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}