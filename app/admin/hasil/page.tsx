"use client";

import { useEffect, useState } from "react";

export default function HasilPage() {
  const [type, setType] = useState<"students"|"classes"|"subjects">("students");
  const [rows, setRows] = useState<any[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [filterClass, setFilterClass] = useState("");
  const [filterSession, setFilterSession] = useState("");
  const [loading, setLoading] = useState(false);

  const formatDuration = (secs: number | null | undefined) => {
    if (secs === null || secs === undefined) return '-';
    const s = Number(secs || 0);
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s/60)}m`;
    const h = Math.floor(s/3600);
    const m = Math.floor((s % 3600)/60);
    return `${h}h ${m}m`;
  };

  useEffect(()=>{
    void fetchOptions();
    void load();
  }, [type]);

  async function fetchOptions() {
    try {
      const res = await fetch('/api/admin/question-banks');
      const j = await res.json();
      if (!res.ok) return;
      // keep existing subjects fetch for backward compatibility (not shown)
      // setSubjects((j.data ?? []).map((b:any)=>b.subject).filter(Boolean).filter((v: any, i: number, a: any[]) => a.indexOf(v) === i));
    } catch (e) {}
    try {
      const res2 = await fetch('/api/admin/users?role=student');
      const j2 = await res2.json();
      if (res2.ok) {
        const items = j2.data ?? [];
        const unique = Array.from(new Set(items.map((i:any)=>i.class_name).filter(Boolean))).map((v:any)=>String(v));
        setClasses(unique);
      }
    } catch (e) {}
    try {
      // fetch exam sessions to populate "Semua jadwal ujian"
      const rs = await fetch('/api/exams');
      const js = await rs.json();
      if (rs.ok) {
        setSessions(js.data ?? []);
      }
    } catch (e) {}
  }

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('type', type);
      if (filterClass) params.set('kelas', filterClass);
      if (filterSession) params.set('sessionId', filterSession);
      const res = await fetch('/api/admin/reports?' + params.toString());
      const j = await res.json();
      if (!res.ok) {
        setRows([]);
        return;
      }
      setRows(j.data ?? []);
    } catch (e) {
      setRows([]);
    } finally { setLoading(false); }
  }

  async function exportCsv() {
    const params = new URLSearchParams();
    params.set('type', type);
    params.set('format', 'csv');
    if (filterClass) params.set('kelas', filterClass);
    if (filterSession) params.set('sessionId', filterSession);
    const res = await fetch('/api/admin/reports?' + params.toString());
    if (!res.ok) {
      const j = await res.json(); alert(j.error ?? 'Gagal export'); return;
    }
    const text = await res.text();
    const blob = new Blob([text], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `rekap_${type}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-semibold mb-4">Hasil & Laporan</h1>
        <div className="flex gap-3 mb-4 items-center">
          <select value={type} onChange={(e)=>setType(e.target.value as any)} className="rounded border px-2 py-1">
            <option value="students">Rekap per Siswa</option>
            <option value="classes">Rekap per Kelas</option>
            <option value="subjects">Rekap per Mata Pelajaran</option>
          </select>
          <select value={filterClass} onChange={(e)=>setFilterClass(e.target.value)} className="rounded border px-2 py-1">
            <option value="">Semua kelas</option>
            {classes.map(c=> <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterSession} onChange={(e)=>setFilterSession(e.target.value)} className="rounded border px-2 py-1">
            <option value="">Semua jadwal ujian</option>
            {sessions.map(s=> <option key={s.id} value={s.id}>{s.title ?? s.id}</option>)}
          </select>
          <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={load} disabled={loading}>Refresh</button>
          <button className="px-3 py-1 bg-slate-100 rounded" onClick={exportCsv}>Export CSV</button>
        </div>

        <div className="rounded border bg-white p-4">
          {loading ? <div>Loading...</div> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-600">
                  {type === 'students' && <><th className="py-2">Nama</th><th>Kelas</th><th>Ujian</th><th>Nilai</th><th>Durasi</th><th>Status</th></>}
                  {type === 'classes' && <><th className="py-2">Kelas</th><th>Jumlah</th><th>Rata-rata</th></>}
                  {type === 'subjects' && <><th className="py-2">Mata Pelajaran</th><th>Jumlah</th><th>Rata-rata</th></>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r:any, idx:number)=> (
                  <tr key={idx} className="border-t">
                    {type === 'students' && <>
                      <td className="py-2">{r.full_name ?? r.student_id}</td>
                      <td className="py-2">{r.class_name ?? '-'}</td>
                      <td className="py-2">{r.session_id ?? '-'}</td>
                      <td className="py-2">{r.score ?? '-'}</td>
                      <td className="py-2">{formatDuration(r.duration_seconds)}</td>
                      <td className="py-2">{r.status ?? '-'}</td>
                    </>}
                    {type === 'classes' && <>
                      <td className="py-2">{r.class_name}</td>
                      <td className="py-2">{r.count}</td>
                      <td className="py-2">{r.avg_score?.toFixed ? r.avg_score.toFixed(2) : r.avg_score}</td>
                    </>}
                    {type === 'subjects' && <>
                      <td className="py-2">{r.subject}</td>
                      <td className="py-2">{r.count}</td>
                      <td className="py-2">{r.avg_score?.toFixed ? r.avg_score.toFixed(2) : r.avg_score}</td>
                    </>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}
