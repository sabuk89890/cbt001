import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

function toCsv(rows: any[]) {
  if (!rows || rows.length === 0) return '';
  const keys = Object.keys(rows[0]);
  const esc = (v: any) => {
    if (v === null || v === undefined) return '';
    const s = String(v).replace(/"/g, '""');
    return '"' + s + '"';
  };
  return [keys.join(','), ...rows.map(r => keys.map(k=>esc(r[k])).join(','))].join('\n');
}

export async function GET(request: Request) {
  try {
    const supabase = createSupabaseAdminClient();
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'students';
    const format = url.searchParams.get('format') || 'json';
    const kelas = url.searchParams.get('kelas') || null;
    const mapel = url.searchParams.get('mapel') || null;

    if (type === 'students') {
      const { data, error } = await supabase
        .from('exam_submissions')
        .select('id, student_id, session_id, score, status, created_at')
        .order('created_at', { ascending: false });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // deduplicate submissions by student_id, keeping the latest (data already ordered desc)
      const seen = new Set<string>();
      const deduped = [] as any[];
      for (const row of (data ?? [])) {
        if (!row || !row.student_id) continue;
        if (seen.has(row.student_id)) continue;
        seen.add(row.student_id);
        deduped.push(row);
      }

      const studentIds = Array.from(new Set(deduped.map((r:any)=>r.student_id).filter(Boolean)));
      let profiles: any[] = [];
      if (studentIds.length > 0) {
        const p = await supabase.from('profiles').select('id, full_name, class_name').in('id', studentIds);
        profiles = p.data ?? [];
      }

      // fetch related participant timings so we can compute duration per submission
      const sessionIds = Array.from(new Set(deduped.map((r:any)=>r.session_id).filter(Boolean)));
      let participants: any[] = [];
      if (sessionIds.length && studentIds.length) {
        const pRes = await supabase
          .from('exam_participants')
          .select('session_id, student_id, started_at, finished_at, created_at')
          .in('session_id', sessionIds)
          .in('student_id', studentIds);
        participants = pRes.data ?? [];
      }

      const partMap = new Map((participants ?? []).map((x:any) => [`${x.session_id}::${x.student_id}`, x]));

      let rows = (deduped ?? []).map((r:any) => {
        const prof = profiles.find((p) => p.id === r.student_id) ?? null;
        const key = `${r.session_id}::${r.student_id}`;
        const part = partMap.get(key) ?? null;

        // compute duration in seconds
        let durationSeconds: number | null = null;
        try {
          const started = part?.started_at ? Date.parse(String(part.started_at)) : null;
          const finished = part?.finished_at ? Date.parse(String(part.finished_at)) : Date.parse(String(r.created_at));
          if (started && finished) durationSeconds = Math.max(0, Math.round((finished - started) / 1000));
        } catch (e) {
          durationSeconds = null;
        }

        return {
          id: r.id,
          student_id: r.student_id,
          full_name: prof?.full_name ?? null,
          class_name: prof?.class_name ?? null,
          session_id: r.session_id,
          score: r.score,
          status: r.status,
          submitted_at: r.created_at,
          duration_seconds: durationSeconds,
        };
      });

      if (kelas) rows = rows.filter((x:any)=>x.class_name === kelas);

      if (format === 'csv') {
        const csv = toCsv(rows);
        return new NextResponse(csv, { status: 200, headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="rekap_siswa.csv"' } });
      }

      return NextResponse.json({ data: rows });
    }

    if (type === 'classes') {
      const { data: subs, error: subErr } = await supabase.from('exam_submissions').select('id, student_id, score, created_at');
      if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 });
      const studentIds = Array.from(new Set((subs ?? []).map((r:any)=>r.student_id).filter(Boolean)));
      const { data: profiles } = await supabase.from('profiles').select('id, full_name, class_name').in('id', studentIds);

      const map: Record<string, number[]> = {};
      (subs ?? []).forEach((s:any)=>{
        const cls = (profiles ?? []).find((p:any)=>p.id === s.student_id)?.class_name ?? 'Unknown';
        map[cls] = map[cls] || [];
        if (typeof s.score === 'number') map[cls].push(s.score);
      });

      const rows = Object.keys(map).map(k => ({ class_name: k, count: map[k].length, avg_score: map[k].length ? (map[k].reduce((a,b)=>a+b,0)/map[k].length) : 0 }));
      if (format === 'csv') return new NextResponse(toCsv(rows), { status: 200, headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="rekap_kelas.csv"' } });
      return NextResponse.json({ data: rows });
    }

    if (type === 'subjects') {
      const { data: subs } = await supabase.from('exam_submissions').select('id, session_id, score');
      const sessionIds = Array.from(new Set((subs ?? []).map((s:any)=>s.session_id).filter(Boolean)));
      const { data: sessions } = await supabase.from('exam_sessions').select('id, bank_id').in('id', sessionIds);
      const bankIds = Array.from(new Set((sessions ?? []).map((s:any)=>s.bank_id).filter(Boolean)));
      const { data: banks } = await supabase.from('question_banks').select('id, title, subject').in('id', bankIds);

      const subjectMap: Record<string, number[]> = {};
      (subs ?? []).forEach((s:any)=>{
        const sess = (sessions ?? []).find((ss:any)=>ss.id === s.session_id);
        const bank = sess ? (banks ?? []).find((b:any)=>b.id === sess.bank_id) : null;
        const subj = bank?.subject ?? 'Umum';
        subjectMap[subj] = subjectMap[subj] || [];
        if (typeof s.score === 'number') subjectMap[subj].push(s.score);
      });

      let rows = Object.keys(subjectMap).map(k=>({ subject: k, count: subjectMap[k].length, avg_score: subjectMap[k].length ? (subjectMap[k].reduce((a,b)=>a+b,0)/subjectMap[k].length) : 0 }));
      if (mapel) rows = rows.filter((r:any)=>r.subject === mapel);
      if (format === 'csv') return new NextResponse(toCsv(rows), { status: 200, headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="rekap_mapel.csv"' } });
      return NextResponse.json({ data: rows });
    }

    return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
