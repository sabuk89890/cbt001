"use client";

import { useEffect, useState, useRef } from "react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

function makeClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON, { realtime: { params: { eventsPerSecond: 10 } } });
}

export default function AdminExamsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [sessionDetail, setSessionDetail] = useState<any | null>(null);
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(60);
  const [numQuestions, setNumQuestions] = useState(10);
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleAnswers, setShuffleAnswers] = useState(true);
  const [showScoreAfter, setShowScoreAfter] = useState(true);
  const [message, setMessage] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const supabaseRef = useRef<SupabaseClient | null>(null);
  const subscriptionRef = useRef<any | null>(null);
  const [metrics, setMetrics] = useState<any | null>(null);

  useEffect(() => {
    void fetchSessions();
  }, []);

  async function fetchSessions() {
    const res = await fetch('/api/exams');
    const json = await res.json();
    setSessions(json.data ?? []);
  }

  async function createSession() {
    const id = `sess-${Date.now()}`;
    const payload = {
      id,
      title,
      bankId: null,
      startsAt: null,
      durationMinutes: Number(duration),
      settings: { numQuestions: Number(numQuestions), shuffleQuestions, shuffleAnswers, showScoreAfter }
    };

    const res = await fetch('/api/exams', { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } });
    const json = await res.json();
    if (!res.ok) {
      setMessage(json.error ?? 'Gagal membuat sesi');
      return;
    }
    setMessage('Sesi dibuat');
    setTitle('');
    await fetchSessions();
  }

  async function handleDelete(sessionId: string) {
    if (!confirm('Hapus sesi ini?')) return;
    const res = await fetch(`/api/exams/${sessionId}`, { method: 'DELETE' });
    const j = await res.json();
    if (!res.ok) { alert(j.error ?? 'Gagal hapus'); return; }
    await fetchSessions();
  }

  async function handleEdit(session: any) {
    const newTitle = prompt('Judul sesi', session.title ?? '');
    if (newTitle === null) return;
    const newDuration = prompt('Durasi (menit, kosongkan untuk tanpa durasi)', session.duration_minutes ?? '');
    const body: any = { title: newTitle };
    if (newDuration === '') body.durationMinutes = null; else if (newDuration != null) body.durationMinutes = Number(newDuration);

    const res = await fetch(`/api/exams/${session.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await res.json();
    if (!res.ok) { alert(j.error ?? 'Gagal update'); return; }
    await fetchSessions();
  }

  async function selectSession(id: string) {
    setSelected(id);
    const res = await fetch(`/api/exams/${id}`);
    const json = await res.json();
    setSessionDetail(json.data ?? null);

    // setup realtime subscription
    if (!supabaseRef.current) supabaseRef.current = makeClient();
    const client = supabaseRef.current;

    // unsubscribe previous
    if (subscriptionRef.current) {
      try { client.removeChannel(subscriptionRef.current); } catch (e) { /* ignore */ }
      subscriptionRef.current = null;
    }

    const channel = client.channel(`exam-session-${id}`);
    subscriptionRef.current = channel;

    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'exam_participants', filter: `session_id=eq.${id}` }, (payload) => {
        // update participant list in-place
        setSessionDetail((prev: any) => {
          if (!prev) return prev;
          const parts = Array.isArray(prev.participants) ? [...prev.participants] : [];
          const p: any = payload as any;
          const record = p.record ?? p.new ?? p.old ?? null;
          const ev = (p.eventType ?? p.type ?? '').toString().toUpperCase();
          if (!record) return prev;
          if (ev === 'INSERT') {
            parts.push(record);
          } else if (ev === 'UPDATE') {
            const idx = parts.findIndex((p: any) => p.id === record.id);
            if (idx >= 0) parts[idx] = record; else parts.push(record);
          } else if (ev === 'DELETE') {
            const idx = parts.findIndex((p: any) => p.id === record.id);
            if (idx >= 0) parts.splice(idx, 1);
          }
        // also refresh aggregated metrics
        fetchMetrics(id).catch(()=>{});
          return { ...prev, participants: parts };
        });
      })
      .subscribe();

    // initial metrics
    void fetchMetrics(id);
  }

  async function fetchMetrics(sessionId: string) {
    try {
      const res = await fetch(`/api/admin/session-metrics?sessionId=${encodeURIComponent(sessionId)}`);
      if (!res.ok) return;
      const j = await res.json();
      setMetrics(j.data ?? null);
    } catch (e) {
      // ignore
    }
  }

  async function simulateStart(sessionId: string) {
    const studentId = prompt('Masukkan student_id (uuid) untuk simulasi start');
    if (!studentId) return;
    const res = await fetch(`/api/exams/${sessionId}/participants/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentId }) });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error ?? 'Gagal memulai peserta');
      return;
    }
    alert('Peserta dibuat: ' + json.data.participantId);
  }

  async function handleReset(participantId: string) {
    if (!confirm('Reset peserta ini?')) return;
    const res = await fetch(`/api/exams/${selected}/participants/${participantId}/reset`, { method: 'POST' });
    const json = await res.json();
    if (!res.ok) { alert(json.error ?? 'Gagal reset'); return; }
    alert('Direset');
  }

  async function handleForceStop(participantId: string) {
    if (!confirm('Hentikan paksa peserta ini?')) return;
    const res = await fetch(`/api/exams/${selected}/participants/${participantId}/force-stop`, { method: 'POST' });
    const json = await res.json();
    if (!res.ok) { alert(json.error ?? 'Gagal hentikan paksa'); return; }
    alert('Hentikan paksa berhasil. Score: ' + (json.data?.score ?? 'n/a'));
  }

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold mb-4">Manajemen Ujian</h1>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-medium">Manajemen Ujian</h2>
            <p className="text-sm text-slate-500">Kelola jadwal ujian dan peserta</p>
          </div>
          <div>
            <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={()=>setShowCreate(v=>!v)}>Buat jadwal</button>
          </div>
        </div>

        {showCreate ? (
          <section className="mb-6 rounded border p-4">
            <h2 className="font-medium">Buat Jadwal</h2>
            <div className="grid gap-2 mt-2">
              <input className="rounded border px-2 py-1" placeholder="Judul sesi" value={title} onChange={(e)=>setTitle(e.target.value)} />
              <div className="flex gap-2">
                <input type="number" className="rounded border px-2 py-1" value={duration} onChange={(e)=>setDuration(Number(e.target.value))} />
                <input type="number" className="rounded border px-2 py-1" value={numQuestions} onChange={(e)=>setNumQuestions(Number(e.target.value))} />
                <label className="flex items-center gap-2"><input type="checkbox" checked={shuffleQuestions} onChange={(e)=>setShuffleQuestions(e.target.checked)} /> Acak Soal</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={shuffleAnswers} onChange={(e)=>setShuffleAnswers(e.target.checked)} /> Acak Jawaban</label>
              </div>
              <label className="flex items-center gap-2"><input type="checkbox" checked={showScoreAfter} onChange={(e)=>setShowScoreAfter(e.target.checked)} /> Tampilkan nilai setelah ujian</label>
              <div className="flex gap-2">
                <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={createSession}>Buat Jadwal</button>
                <button className="px-3 py-1 bg-slate-100 rounded" onClick={fetchSessions}>Refresh</button>
              </div>
              {message ? <p className="text-sm text-slate-600">{message}</p> : null}
            </div>
          </section>
        ) : null}

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {sessions.map((s) => (
            <div key={s.id} className="rounded-lg bg-white shadow p-4 relative">
              <div className="absolute -left-3 top-3 h-full w-2 bg-gradient-to-b from-purple-400 to-violet-600 rounded-l"></div>
              <div className="pl-3">
                <div className="flex justify-between items-start">
                  <h3 className="text-lg font-semibold">{s.title ?? s.id}</h3>
                  <div className="text-xs text-slate-500">{s.duration_minutes != null ? `${s.duration_minutes}m` : ''}</div>
                </div>
                <div className="text-sm text-slate-500 mt-2">ID: {s.id}</div>
                <div className="mt-4">Soal Dibuat</div>
                <div className="text-3xl font-bold mt-1">—</div>

                <div className="mt-4 flex gap-2">
                  <button className="px-3 py-1 bg-blue-600 text-white rounded">Buat Soal</button>
                  <button className="px-3 py-1 border rounded" onClick={()=>handleEdit(s)}>Edit</button>
                  <button className="px-3 py-1 bg-red-600 text-white rounded" onClick={()=>handleDelete(s.id)}>Hapus</button>
                </div>
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
