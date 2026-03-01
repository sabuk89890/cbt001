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
    // fetch session metadata; some databases (older backups) may not yet have the
    // `ends_at` column. We try the full select first and fall back to a safer variant
    // if the query fails with a column-not-found error.
    let session: any | null = null;
    try {
      const { data, error } = await supabase
        .from("exam_sessions")
        .select("id, bank_id, settings, starts_at, duration_minutes, ends_at")
        .eq("id", sessionId)
        .single();
      if (error) throw error;
      session = data;
    } catch (err) {
      // retry without ends_at column
      const { data, error } = await supabase
        .from("exam_sessions")
        .select("id, bank_id, settings, starts_at, duration_minutes")
        .eq("id", sessionId)
        .single();
      if (error || !data) {
        return NextResponse.json({ error: (error?.message ?? (err instanceof Error ? err.message : String(err))) || "Session not found" }, { status: 404 });
      }
      session = data;
    }

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const numQuestions = (session.settings && session.settings.numQuestions) || 0;

    // check for an existing participant for this student. if one exists but has no
    // questions assigned, drop it so we can create a fresh record. this handles the
    // case where a participant was created but inserting session_questions failed.
    if (studentId) {
      const { data: existing } = await supabase
        .from("exam_participants")
        .select("id")
        .eq("session_id", sessionId)
        .eq("student_id", studentId)
        .limit(1)
        .single();
      if (existing && existing.id) {
        const { count } = await supabase
          .from("session_questions")
          .select("id", { head: true, count: "exact" })
          .eq("participant_id", existing.id);
        if (count === 0) {
          await supabase.from("exam_participants").delete().eq("id", existing.id);
        } else {
          // reuse existing participant with questions
          return NextResponse.json({ data: { participantId: existing.id } }, { status: 200 });
        }
      }
    }

    // before validating token, refresh it automatically if interval configured
    const settings = session.settings || {};
    const refreshInterval = typeof settings.refreshInterval === 'number' ? settings.refreshInterval : 0;
    let currentToken = settings.token ?? null;
    const lastUpdate = settings.tokenUpdatedAt ? Date.parse(String(settings.tokenUpdatedAt)) : null;
    if (refreshInterval > 0) {
      const nowMs = Date.now();
      if (!lastUpdate || nowMs - lastUpdate >= refreshInterval * 60000) {
        // generate new token and persist back to session.settings
        const newTok = makeRandomToken(5);
        currentToken = newTok;
        const newSettings = { ...settings, token: newTok, tokenUpdatedAt: new Date().toISOString() };
        await supabase.from('exam_sessions').update({ settings: newSettings }).eq('id', sessionId);
      }
    }

    // require token if configured
    const requiredToken = currentToken ? String(currentToken).trim() : null;
    if (requiredToken) {
      const provided = (body.token ?? '').toString().trim();
      if (provided !== requiredToken) {
        return NextResponse.json({ error: 'Token Salah' }, { status: 400 });
      }
    }

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
