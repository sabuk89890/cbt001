import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

function shuffle<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const body = await request.json();
    const { studentId } = body;
    const { id: sessionId } = await context.params;
    if (!studentId) {
      return NextResponse.json({ error: "studentId required" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    // load session
    const { data: session, error: sessErr } = await supabase
      .from("exam_sessions")
      .select("id, bank_id, settings, starts_at, duration_minutes")
      .eq("id", sessionId)
      .single();

    if (sessErr || !session) {
      return NextResponse.json({ error: sessErr?.message ?? "Session not found" }, { status: 404 });
    }

    const numQuestions = (session.settings && session.settings.numQuestions) || 0;

    // enforce start/end times
    const now = new Date();
    if (session.starts_at) {
      const starts = new Date(session.starts_at);
      if (now < starts) return NextResponse.json({ error: 'Belum waktunya ujian' }, { status: 400 });
    }
    // Note: ends_at column may not exist in DB yet; server-side enforcement will rely on DB migration.

    // fetch candidate questions for bank
    const { data: questions } = await supabase
      .from("questions")
      .select("id, options, answer_key, question_type, max_score")
      .eq("bank_id", session.bank_id);

    const qs = Array.isArray(questions) ? questions : [];
    const chosen = numQuestions > 0 ? shuffle(qs).slice(0, numQuestions) : shuffle(qs);

    // create participant
    const { data: participant, error: partErr } = await supabase
      .from("exam_participants")
      .insert({ session_id: sessionId, student_id: studentId, started_at: new Date().toISOString(), status: "in_progress" })
      .select("id, session_id, student_id, started_at, status")
      .single();

    if (partErr || !participant) {
      return NextResponse.json({ error: partErr?.message ?? "Failed create participant" }, { status: 500 });
    }

    // insert session_questions for this participant
    const inserts = chosen.map((q: any, idx: number) => ({
      session_id: sessionId,
      participant_id: participant.id,
      question_id: q.id,
      order_index: idx,
      shuffled_options: (session.settings && session.settings.shuffleAnswers) ? shuffle(q.options || []) : q.options || [],
    }));

    if (inserts.length > 0) {
      const { error: iqErr } = await supabase.from("session_questions").insert(inserts);
      if (iqErr) {
        return NextResponse.json({ error: iqErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ data: { participantId: participant.id } }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
