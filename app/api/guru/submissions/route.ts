import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const teacherId = url.searchParams.get("teacherId");

    if (!teacherId) return NextResponse.json({ error: "teacherId is required" }, { status: 400 });

    const supabase = createSupabaseAdminClient();

    // find banks owned by this teacher
    const { data: banks, error: banksError } = await supabase
      .from("question_banks")
      .select("id")
      .eq("owner_teacher_id", teacherId);

    if (banksError) return NextResponse.json({ error: banksError.message }, { status: 500 });

    const bankIds = (banks ?? []).map((b: any) => b.id).filter(Boolean);
    if (bankIds.length === 0) return NextResponse.json({ data: [] });

    // find sessions using those banks
    const { data: sessions, error: sessionsError } = await supabase
      .from("exam_sessions")
      .select("id, bank_id")
      .in("bank_id", bankIds as string[]);

    if (sessionsError) return NextResponse.json({ error: sessionsError.message }, { status: 500 });

    const sessionIds = (sessions ?? []).map((s: any) => s.id).filter(Boolean);
    if (sessionIds.length === 0) return NextResponse.json({ data: [] });

    // fetch submissions for those sessions
    const { data: subs, error: subsError } = await supabase
      .from("exam_submissions")
      .select("id, session_id, student_id, score, status, needs_manual_review, review_status, reviewed_by, grading_detail, created_at")
      .in("session_id", sessionIds as string[])
      .order("created_at", { ascending: false })
      .limit(500);

    if (subsError) return NextResponse.json({ error: subsError.message }, { status: 500 });

    const submissions = subs ?? [];

    // enrich with student profiles (full_name, class_name)
    const studentIds = [...new Set(submissions.map((s: any) => s.student_id).filter(Boolean))];
    let profileMap = new Map<string, { full_name: string | null; class_name: string | null }>();
    if (studentIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, class_name")
        .in("id", studentIds as string[]);

      if (!profilesError && profiles) {
        profileMap = new Map((profiles as any[]).map((p) => [p.id, { full_name: p.full_name ?? null, class_name: p.class_name ?? null }]));
      }
    }

    // compute durations by looking up exam_participants (started_at/finished_at)
    const sessionIdsUsed = Array.from(new Set((submissions ?? []).map((s:any)=>s.session_id).filter(Boolean)));
    const studentIdsUsed = Array.from(new Set((submissions ?? []).map((s:any)=>s.student_id).filter(Boolean)));
    let parts: any[] = [];
    if (sessionIdsUsed.length && studentIdsUsed.length) {
      const { data: pData } = await supabase
        .from('exam_participants')
        .select('session_id, student_id, started_at, finished_at, created_at')
        .in('session_id', sessionIdsUsed as string[])
        .in('student_id', studentIdsUsed as string[]);
      parts = pData ?? [];
    }
    const partMap = new Map((parts ?? []).map((x:any)=>[`${x.session_id}::${x.student_id}`, x]));

    const enrichedSubs = (submissions as any[]).map((s) => {
      const profile = s.student_id ? profileMap.get(s.student_id) : undefined;
      const p = partMap.get(`${s.session_id}::${s.student_id}`) ?? null;
      let durationSeconds: number | null = null;
      try {
        const started = p?.started_at ? Date.parse(String(p.started_at)) : null;
        const finished = p?.finished_at ? Date.parse(String(p.finished_at)) : Date.parse(String(s.created_at));
        if (started && finished) durationSeconds = Math.max(0, Math.round((finished - started) / 1000));
      } catch (e) {
        durationSeconds = null;
      }
      return {
        ...s,
        studentName: profile?.full_name ?? null,
        className: profile?.class_name ?? null,
        duration_seconds: durationSeconds,
      };
    });

    // sessions and banks for building filter options on client
    const { data: sessionsFull, error: sessionsFullError } = await supabase
      .from("exam_sessions")
      .select("id, bank_id")
      .in("id", sessionIds as string[]);

    if (sessionsFullError) return NextResponse.json({ error: sessionsFullError.message }, { status: 500 });

    const sessionBankIds = [...new Set((sessionsFull ?? []).map((s: any) => s.bank_id).filter(Boolean))];
    let banksFull: any[] = [];
    if (sessionBankIds.length > 0) {
      const { data: banksData, error: banksDataError } = await supabase
        .from("question_banks")
        .select("id, title")
        .in("id", sessionBankIds as string[]);

      if (banksDataError) return NextResponse.json({ error: banksDataError.message }, { status: 500 });
      banksFull = banksData ?? [];
    }

    return NextResponse.json({ data: enrichedSubs, sessions: sessionsFull ?? [], banks: banksFull });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
