import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const studentId = url.searchParams.get("studentId");
    if (!studentId) return NextResponse.json({ error: "studentId required" }, { status: 400 });

    const supabase = createSupabaseAdminClient();

    // fetch submissions for this student, include session title and bank title where possible
    const { data: subs, error } = await supabase
      .from("exam_submissions")
      .select("id, session_id, student_id, score, status, created_at")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // fetch session titles for referenced sessions
    const sessionIds = Array.from(new Set((subs ?? []).map((s: any) => s.session_id).filter(Boolean)));
    const { data: sessions } = await supabase.from("exam_sessions").select("id, title, bank_id").in("id", sessionIds);
    const bankIds = Array.from(new Set((sessions ?? []).map((s: any) => s.bank_id).filter(Boolean)));
    const { data: banks } = bankIds.length ? await supabase.from("question_banks").select("id, title").in("id", bankIds) : { data: [] };

    const sessionMap = new Map((sessions ?? []).map((r: any) => [r.id, r]));
    const bankMap = new Map((banks ?? []).map((b: any) => [b.id, b]));

    const result = (subs ?? []).map((row: any) => {
      const session = sessionMap.get(row.session_id) ?? null;
      const bank = session ? bankMap.get(session.bank_id) ?? null : null;
      return {
        id: row.id,
        sessionId: row.session_id,
        title: session?.title ?? bank?.title ?? row.session_id,
        score: row.score,
        status: row.status,
        createdAt: row.created_at,
      };
    });

    return NextResponse.json({ data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
