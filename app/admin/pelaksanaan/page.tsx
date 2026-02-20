"use client";

import { useEffect, useRef, useState } from "react";

export default function PelaksanaanPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterClass, setFilterClass] = useState<string>("");
  const [classes, setClasses] = useState<string[]>([]);
  const supabaseRef = useRef<any | null>(null);
  const channelRef = useRef<any | null>(null);

  const formatDuration = (secs: number | null | undefined) => {
    if (secs === null || secs === undefined) return '-';
    const s = Number(secs || 0);
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s/60)}m`;
    const h = Math.floor(s/3600);
    const m = Math.floor((s % 3600)/60);
    return `${h}h ${m}m`;
  };

  useEffect(() => {
    void fetchSessions();
    void fetchClasses();
  }, []);

  async function fetchSessions() {
    const res = await fetch('/api/exams');
    const j = await res.json();
    setSessions(j.data ?? []);
  }

  async function fetchClasses() {
    const res = await fetch('/api/admin/users?role=student');
    const j = await res.json();
    const items = j.data ?? [];
    const unique = Array.from(new Set(items.map((i: any) => i.class_name).filter((v: any) => !!v).map((v: any) => String(v)))) as string[];
    setClasses(unique);
  }

  async function selectSession(sessionId: string) {
    setSelectedSession(sessionId);
    const res = await fetch(`/api/exams/${sessionId}`);
    const j = await res.json();
    setParticipants(j.data?.participants ?? []);

    // setup realtime via supabase-js client in browser (optional)
    try {
      if (!supabaseRef.current) {
        const { createClient } = await import('@supabase/supabase-js');
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
        supabaseRef.current = createClient(url, key, { realtime: { params: { eventsPerSecond: 5 } } });
      }
      const client = supabaseRef.current;
      if (channelRef.current) {
        try { client.removeChannel(channelRef.current); } catch (e) {}
      }
      const ch = client.channel(`exam-session-${sessionId}`);
      channelRef.current = ch;
      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'exam_participants', filter: `session_id=eq.${sessionId}` }, (payload:any)=>{
        const record = payload.record ?? payload.new ?? payload.old ?? null;
        const ev = (payload.eventType ?? payload.type ?? '').toString().toUpperCase();
        setParticipants(prev=>{
          const arr = Array.isArray(prev) ? [...prev] : [];
          if (!record) return prev;
          if (ev === 'INSERT') {
            arr.push(record);
          } else if (ev === 'UPDATE') {
            const idx = arr.findIndex((p:any)=>p.id === record.id);
            if (idx >= 0) arr[idx] = record; else arr.push(record);
          } else if (ev === 'DELETE') {
            const idx = arr.findIndex((p:any)=>p.id === record.id);
            if (idx >= 0) arr.splice(idx,1);
          }
          return arr;
        });
      }).subscribe();
    } catch (e) {
      // ignore realtime errors
    }
  }

  function filteredParticipants() {
    return participants.filter((p:any)=>{
      if (filterClass && p.class_name !== filterClass) return false;
      if (search) {
        const s = search.toLowerCase();
        const name = (p.full_name ?? p.username ?? '').toLowerCase();
        return name.includes(s) || (p.student_id ?? '').toLowerCase().includes(s);
      }
      return true;
    });
  }

  async function handleReset(participantId:string) {
    if (!confirm('Riset peserta ini? (ujian akan dimulai ulang untuk peserta)')) return;
    const res = await fetch(`/api/exams/${selectedSession}/participants/${participantId}/reset`, { method: 'POST' });
    const j = await res.json();
    if (!res.ok) alert(j.error ?? 'Gagal reset');
    else {
      alert('Peserta dihapus dari sesi');
      await fetchSessions();
    }
  }

  async function handleForceStop(participantId:string) {
    if (!confirm('Hentikan ujian paksa untuk peserta ini?')) return;
    const res = await fetch(`/api/exams/${selectedSession}/participants/${participantId}/force-stop`, { method: 'POST' });
    const j = await res.json();
    if (!res.ok) alert(j.error ?? 'Gagal hentikan paksa');
    else alert('Ujian peserta dihentikan. Score: ' + (j.data?.score ?? 'n/a'));
  }

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold mb-4">Pelaksanaan Ujian</h1>
        <div className="mb-4 flex gap-4">
          <select className="rounded border p-2" value={selectedSession ?? ''} onChange={(e)=>selectSession(e.target.value)}>
            <option value="">Pilih sesi (untuk monitoring)</option>
            {sessions.map(s=> <option key={s.id} value={s.id}>{s.title ?? s.id}</option>)}
          </select>
          <input className="rounded border p-2 flex-1" placeholder="Search nama atau student id" value={search} onChange={(e)=>setSearch(e.target.value)} />
          <select className="rounded border p-2" value={filterClass} onChange={(e)=>setFilterClass(e.target.value)}>
            <option value="">Semua kelas</option>
            {classes.map(c=> <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-sm text-slate-600 border-b">
                <th className="py-2">Nama</th>
                <th className="py-2">Kelas</th>
                <th className="py-2">Status</th>
                <th className="py-2">Waktu Mulai</th>
                <th className="py-2">Durasi</th>
                <th className="py-2">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredParticipants().map(p=> (
                <tr key={p.id} className="border-b">
                  <td className="py-2">{p.full_name ?? p.username ?? p.student_id}</td>
                  <td className="py-2">{p.class_name ?? '-'}</td>
                  <td className="py-2">{p.status ?? '-'}</td>
                  <td className="py-2">{p.started_at ? new Date(p.started_at).toLocaleString() : '-'}</td>
                  <td className="py-2">{formatDuration(p.duration_seconds)}</td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      <button className="px-2 py-1 border rounded" onClick={()=>handleReset(p.id)}>Riset</button>
                      <button className="px-2 py-1 bg-red-600 text-white rounded" onClick={()=>handleForceStop(p.id)}>Hentikan Paksa</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
