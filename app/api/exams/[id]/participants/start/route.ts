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
    const { studentId, token: providedToken } = body as { studentId?: string; token?: string };
    const { id: sessionId } = await context.params;
    if (!studentId) {
      return NextResponse.json({ error: "studentId required" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    // enforce token if required
    const { data: currentToken, error: tokErr } = await supabase
      .from("exam_tokens")
      .select("token, expires_at")
      .eq("session_id", sessionId)
      .single();
    if (!tokErr && currentToken) {
      const now = new Date();
      if (currentToken.expires_at && new Date(currentToken.expires_at).getTime() < now.getTime()) {
        return NextResponse.json({ error: 'Token sudah kadaluwarsa' }, { status: 400 });
      }
      if (currentToken.token !== (providedToken || "")) {
        return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 });
      }
    }

    // load session
    const { data: session, error: sessErr } = await supabase
      .from("exam_sessions")
      .select("id, bank_id, settings, starts_at, ends_at, duration_minutes")
      .eq("id", sessionId)
      .single();

    if (sessErr || !session) {
      return NextResponse.json({ error: sessErr?.message ?? "Session not found" }, { status: 404 });
    }

    const numQuestions = (session.settings && session.settings.numQuestions) || 0;

    // enforce start/end times (support older DBs which may store endsAt inside settings)
    const now = new Date();
    if (session.starts_at) {
      const starts = new Date(session.starts_at);
      if (now < starts) return NextResponse.json({ error: 'Belum waktunya ujian' }, { status: 400 });
    }
    const sessionEnds = session.ends_at ?? (session.settings && session.settings.endsAt) ?? null;
    if (sessionEnds) {
      const ends = new Date(sessionEnds);
      if (now > ends) return NextResponse.json({ error: 'Waktu ujian telah berakhir' }, { status: 400 });
    }

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
