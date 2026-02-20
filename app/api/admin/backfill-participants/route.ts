import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = createSupabaseAdminClient();

    // fetch all submissions ordered newest first so we can pick the latest per (session,student)
    const { data: subs, error: subsErr } = await supabase
      .from('exam_submissions')
      .select('id, session_id, student_id, score, created_at')
      .order('created_at', { ascending: false });

    if (subsErr) return NextResponse.json({ error: subsErr.message }, { status: 500 });

    const seen = new Map<string, any>();
    for (const s of subs ?? []) {
      if (!s.session_id || !s.student_id) continue;
      const key = `${s.session_id}::${s.student_id}`;
      if (!seen.has(key)) seen.set(key, s); // first occurrence is the latest because of ordering
    }

    const results: Array<{ sessionId: string; studentId: string; updatedCount: number; participantIds: string[] }> = [];
    let totalUpdated = 0;

    for (const [key, sub] of seen.entries()) {
      const sessionId = sub.session_id;
      const studentId = sub.student_id;
      const finishedAt = sub.created_at ?? new Date().toISOString();
      const score = sub.score ?? null;

      const { data: updated, error: updErr } = await supabase
        .from('exam_participants')
        .update({ status: 'finished', finished_at: finishedAt, score })
        .eq('session_id', sessionId)
        .eq('student_id', studentId)
        .neq('status', 'finished')
        .select('id');

      if (updErr) {
        // continue but record zero update for this pair
        results.push({ sessionId, studentId, updatedCount: 0, participantIds: [] });
        continue;
      }

      const ids = (updated ?? []).map((r: any) => r.id);
      const count = ids.length;
      totalUpdated += count;
      results.push({ sessionId, studentId, updatedCount: count, participantIds: ids });
    }

    return NextResponse.json({ scannedSubmissions: seen.size, totalParticipantsUpdated: totalUpdated, results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}