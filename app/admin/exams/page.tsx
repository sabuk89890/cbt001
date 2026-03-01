"use client";

import { useEffect, useState, useRef, useMemo } from "react";
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
  const [lockFinishMinutes, setLockFinishMinutes] = useState<number>(0);
  const [banks, setBanks] = useState<any[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [bankTeacherName, setBankTeacherName] = useState<string | null>(null);
  const [availableQuestions, setAvailableQuestions] = useState<number | null>(null);
  // disables create/update when bank is missing or has no questions
  const canSubmit = useMemo(() => {
    if (!selectedBank) return false;
    if (availableQuestions !== null && availableQuestions <= 0) return false;
    return true;
  }, [selectedBank, availableQuestions]);
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [startsDate, setStartsDate] = useState<string | null>(null);
  const [startsTime, setStartsTime] = useState<string | null>(null);
  const [endsDate, setEndsDate] = useState<string | null>(null);
  const [endsTime, setEndsTime] = useState<string | null>(null);
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleAnswers, setShuffleAnswers] = useState(true);
  const [showScoreAfter, setShowScoreAfter] = useState(true);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [classChoice, setClassChoice] = useState<string>('');
  const [classesLockedFromBank, setClassesLockedFromBank] = useState<boolean>(false);
  const [message, setMessage] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const supabaseRef = useRef<SupabaseClient | null>(null);
  const subscriptionRef = useRef<any | null>(null);
  const [metrics, setMetrics] = useState<any | null>(null);

  useEffect(() => {
    void fetchSessions();
    void fetchBanks();
    void fetchClasses();
  }, []);

  async function fetchBanks() {
    try {
      const res = await fetch('/api/admin/question-banks');
      const j = await res.json();
      if (!res.ok) return;
      setBanks(j.data ?? []);
    } catch (e) {
      // ignore
    }
  }

  async function fetchClasses() {
    try {
      const res = await fetch('/api/admin/users?role=student');
      const j = await res.json();
      if (!res.ok) return;
      const items = j.data ?? [];
      const unique = Array.from(new Set(items.map((i: any) => i.class_name).filter((v: any) => !!v).map((v: any) => String(v)))) as string[];
      setClasses(unique);
    } catch (e) {
      // ignore
    }
  }

  async function fetchSessions() {
    const res = await fetch('/api/exams');
    const json = await res.json();
    setSessions(json.data ?? []);
  }

  async function createSession() {
    const id = `sess-${Date.now()}`;
    function combine(date: string | null, time: string | null) {
      if (!date) return null;
      if (!time) return null;
      // combine to local ISO
      try {
        const dt = new Date(`${date}T${time}`);
        return dt.toISOString();
      } catch (e) {
        return null;
      }
    }

    // guard validation before sending
    if (!selectedBank) {
      setMessage('Pilih bank soal terlebih dahulu');
      return;
    }
    if (availableQuestions !== null && availableQuestions <= 0) {
      setMessage('Bank soal kosong, tidak bisa membuat sesi');
      return;
    }

    const payload = {
      title,
      bankId: selectedBank,
      startsAt: combine(startsDate, startsTime),
      endsAt: combine(endsDate, endsTime),
      durationMinutes: Number(duration),
      settings: { numQuestions: Number(numQuestions), shuffleQuestions, shuffleAnswers, showScoreAfter, lockFinishMinutes: Number(lockFinishMinutes) },
      targetClasses: selectedClasses ?? []
    };

    let res: Response;
    if (editingId) {
      res = await fetch(`/api/exams/${editingId}`, { method: 'PATCH', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } });
    } else {
      // create new
      const idPayload = { ...payload, id: id };
      res = await fetch('/api/exams', { method: 'POST', body: JSON.stringify(idPayload), headers: { 'Content-Type': 'application/json' } });
    }

    const json = await res.json();
    if (!res.ok) {
      setMessage(json.error ?? (editingId ? 'Gagal update sesi' : 'Gagal membuat sesi'));
      return;
    }
    setMessage(editingId ? 'Sesi diperbarui' : 'Sesi dibuat');
    // reset form
    setTitle('');
    setSelectedBank(null);
    setBankTeacherName(null);
    setStartsAt(null);
    setEndsAt(null);
    setLockFinishMinutes(0);
    setSelectedClasses([]);
    setEditingId(null);
    setShowCreate(false);
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
    // open create panel and populate fields for editing
    setEditingId(session.id);
    setShowCreate(true);
    setTitle(session.title ?? '');
    setSelectedBank(session.bank_id ?? null);
    setBankTeacherName(null);
    // try to populate bank info (available questions + teacher) from loaded banks
    try {
      let bankObj = banks.find(b => b.id === session.bank_id) as any | undefined;
      if (!bankObj) {
        // attempt to refresh banks once
        await fetchBanks();
        bankObj = banks.find(b => b.id === session.bank_id) as any | undefined;
      }
      if (bankObj) {
        setBankTeacherName(bankObj.ownerTeacherName ?? null);
        if (typeof bankObj.questionCount === 'number') {
          setAvailableQuestions(bankObj.questionCount);
          // if number of questions not explicitly set in session, default to bank count
          const s = session.settings ?? {};
          if (!s.numQuestions) setNumQuestions(bankObj.questionCount);
        }
        // if bank defines targetClasses and session has none, prefill from bank
        const s = session.settings ?? {};
        if (Array.isArray(bankObj.targetClasses) && bankObj.targetClasses.length > 0) {
          // always prefer bank-defined classes (user requested behavior)
          setSelectedClasses(bankObj.targetClasses.map((x: any) => String(x)));
          setClassesLockedFromBank(true);
        } else if ((!session.target_classes || session.target_classes.length === 0) && Array.isArray(s.targetClasses) && s.targetClasses.length > 0) {
          setSelectedClasses(s.targetClasses.map((x: any) => String(x)));
          setClassesLockedFromBank(true);
        } else if (session.target_classes && Array.isArray(session.target_classes) && session.target_classes.length > 0) {
          setSelectedClasses(session.target_classes.map((x: any) => String(x)));
          setClassesLockedFromBank(false);
        } else {
          setSelectedClasses([]);
          setClassesLockedFromBank(false);
        }
      }
    } catch (e) {
      // ignore
    }
    // settings from session
    const s = session.settings ?? {};
    setNumQuestions(s.numQuestions ?? numQuestions);
    setShuffleQuestions(Boolean(s.shuffleQuestions ?? shuffleQuestions));
    setShuffleAnswers(Boolean(s.shuffleAnswers ?? shuffleAnswers));
    setShowScoreAfter(Boolean(s.showScoreAfter ?? showScoreAfter));
    setLockFinishMinutes(Number(s.lockFinishMinutes ?? lockFinishMinutes));
    // target classes fallback
    if (session.target_classes && Array.isArray(session.target_classes)) {
      setSelectedClasses(session.target_classes.map((x: any) => String(x)));
    } else if (s.targetClasses && Array.isArray(s.targetClasses)) {
      setSelectedClasses(s.targetClasses.map((x: any) => String(x)));
    } else {
      setSelectedClasses([]);
    }
    // starts/ends: prefer columns, fallback to settings
    if (session.starts_at) {
      const dt = new Date(session.starts_at);
      setStartsDate(dt.toISOString().slice(0,10));
      setStartsTime(dt.toISOString().slice(11,16));
    } else if (s.startsAt) {
      const dt = new Date(s.startsAt);
      setStartsDate(dt.toISOString().slice(0,10));
      setStartsTime(dt.toISOString().slice(11,16));
    } else { setStartsDate(null); setStartsTime(null); }

    if (session.ends_at) {
      const dt = new Date(session.ends_at);
      setEndsDate(dt.toISOString().slice(0,10));
      setEndsTime(dt.toISOString().slice(11,16));
    } else if (s.endsAt) {
      const dt = new Date(s.endsAt);
      setEndsDate(dt.toISOString().slice(0,10));
      setEndsTime(dt.toISOString().slice(11,16));
    } else { setEndsDate(null); setEndsTime(null); }

    // duration
    setDuration(session.duration_minutes ?? duration);
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

    let payload: any = { studentId };
    // check if token is required
    try {
      const r = await fetch(`/api/exams/${sessionId}/token`);
      if (r.ok) {
        const j = await r.json();
        if (j.required) {
          const t = prompt('Masukkan token ujian');
          if (!t) return;
          payload.token = t;
        }
      }
    } catch (e) {
      console.error(e);
    }

    const res = await fetch(`/api/exams/${sessionId}/participants/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
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
            <button type="button" className="px-4 py-2 bg-blue-600 text-white rounded" onClick={()=>{ if (!showCreate) {
                // reset create form defaults when opening
                setTitle(''); setDuration(60); setSelectedBank(null); setBankTeacherName(null);
                setAvailableQuestions(null); setNumQuestions(10); setLockFinishMinutes(0);
                setStartsDate(null); setStartsTime(null); setEndsDate(null); setEndsTime(null);
                setShuffleQuestions(true); setShuffleAnswers(true); setShowScoreAfter(true);
              }
              setShowCreate(v=>!v);
            }}>Buat jadwal</button>
          </div>
        </div>

        {showCreate ? (
          <section className="mb-6 rounded border p-4">
            <h2 className="font-medium">Buat Jadwal</h2>
            <div className="grid gap-2 mt-2">
              <input className="rounded border px-2 py-1" placeholder="Judul sesi" value={title} onChange={(e)=>setTitle(e.target.value)} />
              <div className="flex gap-2 items-center">
                <select className="rounded border px-2 py-1" value={selectedBank ?? ''} onChange={async (e)=>{
                  const v = e.target.value || null; setSelectedBank(v);
                  const b = banks.find(x=>x.id === v);
                  setBankTeacherName(b?.ownerTeacherName ?? null);
                  if (b && typeof b.questionCount === 'number') {
                    setAvailableQuestions(b.questionCount);
                    // default tampil sama dengan available
                    setNumQuestions(b.questionCount);
                  } else {
                    setAvailableQuestions(null);
                  }
                  // if bank has targetClasses, use them and lock class selection
                  try {
                    if (b && Array.isArray(b.targetClasses) && b.targetClasses.length > 0) {
                      setSelectedClasses(b.targetClasses.map((x:any)=>String(x)));
                      setClassesLockedFromBank(true);
                    } else {
                      setClassesLockedFromBank(false);
                    }
                  } catch (err) {
                    setClassesLockedFromBank(false);
                  }
                }}>
                  <option value="">Pilih Bank Soal</option>
                  {banks.map((b) => <option key={b.id} value={b.id}>{b.title} ({b.questionCount} soal)</option>)}
                </select>
                <div className="text-sm text-slate-600">Guru: {bankTeacherName ?? '-'}</div>
              </div>
              <div className="mt-2">
                <label className="text-xs text-slate-600 block mb-1">Kelas Tujuan (boleh pilih lebih dari satu)</label>
                <div className="flex gap-2">
                  {/* If the selected bank defines targetClasses, use those as options; otherwise fall back to global classes */}
                  <select className="w-full rounded border p-2 text-sm" value={classChoice} onChange={(e)=>setClassChoice(e.target.value)} disabled={classesLockedFromBank}>
                    <option value="">Pilih kelas</option>
                    {(() => {
                      const bankObj = banks.find(b => b.id === selectedBank) as any | undefined;
                      const opts = (bankObj && Array.isArray(bankObj.targetClasses) && bankObj.targetClasses.length > 0)
                        ? bankObj.targetClasses.map((x: any) => String(x))
                        : classes;
                      return opts.filter((c: string) => !selectedClasses.includes(c)).map((c: string) => <option key={c} value={c}>{c}</option>);
                    })()}
                  </select>
                  {!classesLockedFromBank ? (
                    <button type="button" className="px-3 py-1 bg-blue-600 text-white rounded" onClick={()=>{
                      if (!classChoice) return;
                      if (!selectedClasses.includes(classChoice)) setSelectedClasses(prev=>[...prev, classChoice]);
                      setClassChoice('');
                    }}>Tambah</button>
                  ) : (
                    <div className="px-3 py-1 text-sm text-slate-600">Diambil dari Bank Soal</div>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedClasses.map(c => (
                    <span key={c} className="flex items-center gap-2 bg-slate-100 px-2 py-1 rounded text-sm">
                      <span>{c}</span>
                      {!classesLockedFromBank ? (
                        <button type="button" className="text-slate-500 hover:text-red-600" onClick={()=>setSelectedClasses(prev=>prev.filter(x=>x!==c))}>×</button>
                      ) : null}
                    </span>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
                <div className="text-sm min-w-0">
                  <label className="text-xs text-slate-600 block mb-1">Durasi (menit)</label>
                  <input type="number" className="rounded border px-2 h-10 w-full" value={duration} onChange={(e)=>setDuration(Number(e.target.value))} />
                  <div className="text-xs text-slate-500">Waktu pengerjaan per peserta (menit)</div>
                </div>

                <div className="text-sm min-w-0">
                  <label className="text-xs text-slate-600 block mb-1">Soal Tersedia</label>
                  <input readOnly className="rounded border px-2 h-10 bg-slate-50 text-slate-700 w-full" value={availableQuestions ?? ''} />
                </div>

                <div className="text-sm min-w-0">
                  <label className="text-xs text-slate-600 block mb-1">Soal Tampil</label>
                  <input type="number" className="rounded border px-2 h-10 text-center w-full" value={numQuestions} onChange={(e)=>{
                    const v = Number(e.target.value) || 0;
                    if (availableQuestions != null && v > availableQuestions) {
                      setNumQuestions(availableQuestions);
                    } else {
                      setNumQuestions(v);
                    }
                  }} />
                </div>

                <div className="text-sm min-w-0">
                  <label className="text-xs text-slate-600 block mb-1">Lock Selesai (menit)</label>
                  <input type="number" className="rounded border px-2 h-10 text-center w-full" value={lockFinishMinutes} onChange={(e)=>setLockFinishMinutes(Number(e.target.value) || 0)} />
                  <div className="text-xs text-slate-500 mt-1 max-w-xs">Jika lebih dari 0, siswa tidak dapat menekan selesai sampai menit ini berlalu sejak mulai.</div>
                </div>
              </div>
              <div className="flex gap-4 items-center mt-2">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={shuffleQuestions} onChange={(e)=>setShuffleQuestions(e.target.checked)} /> Acak Soal</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={shuffleAnswers} onChange={(e)=>setShuffleAnswers(e.target.checked)} /> Acak Jawaban</label>
              </div>
              {/* warning if chosen bank has no questions */}
              {selectedBank && availableQuestions !== null && availableQuestions <= 0 ? (
                <p className="mt-2 text-sm text-red-600">Bank soal ini tidak memiliki pertanyaan. Pilih bank lain atau tambahkan soal terlebih dahulu.</p>
              ) : null}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm">Mulai (Tanggal)</label>
                  <input type="date" className="rounded border px-2 py-1 w-full" value={startsDate ?? ''} onChange={(e)=>setStartsDate(e.target.value)} />
                  <label className="block text-sm mt-2">Jam Mulai</label>
                  <input type="time" className="rounded border px-2 py-1 w-full" value={startsTime ?? ''} onChange={(e)=>setStartsTime(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm">Selesai (Tanggal)</label>
                  <input type="date" className="rounded border px-2 py-1 w-full" value={endsDate ?? ''} onChange={(e)=>setEndsDate(e.target.value)} />
                  <label className="block text-sm mt-2">Jam Selesai</label>
                  <input type="time" className="rounded border px-2 py-1 w-full" value={endsTime ?? ''} onChange={(e)=>setEndsTime(e.target.value)} />
                </div>
              </div>
              <label className="flex items-center gap-2"><input type="checkbox" checked={showScoreAfter} onChange={(e)=>setShowScoreAfter(e.target.checked)} /> Tampilkan nilai setelah ujian</label>
              <div className="flex gap-2">
                <button
                type="button"
                className={`px-3 py-1 rounded text-white ${canSubmit ? 'bg-blue-600' : 'bg-blue-300 cursor-not-allowed'}`}
                onClick={createSession}
                disabled={!canSubmit}
              >
                {editingId ? 'Simpan Perubahan' : 'Buat Jadwal'}
              </button>
              <button type="button" className="px-3 py-1 bg-slate-100 rounded" onClick={fetchSessions}>Refresh</button>
              {editingId ? <button type="button" className="px-3 py-1 bg-white border rounded" onClick={()=>{
                // cancel editing
                setEditingId(null); setShowCreate(false);
                setTitle(''); setSelectedBank(null); setSelectedClasses([]);
              }}>Batal</button> : null}
              </div>
              {message ? <p className="text-sm text-slate-600">{message}</p> : null}
            </div>
          </section>
        ) : null}

        {/* show session cards when not creating */}
        {!showCreate && (
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {sessions.map((s) => {
              const bankObj = banks.find(b => b.id === s.bank_id) as any | undefined;
              const bankTitle = bankObj?.title ?? '-';
              const bankCount = typeof bankObj?.questionCount === 'number' ? bankObj.questionCount : 0;

              return (
                <div key={s.id} className="rounded-lg bg-white shadow p-4 relative">
                  <div className="absolute -left-3 top-3 h-full w-2 bg-gradient-to-b from-purple-400 to-violet-600 rounded-l"></div>
                  <div className="pl-3">
                    <div className="flex justify-between items-start">
                      <h3 className="text-lg font-semibold">{s.title ?? s.id}</h3>
                      <div className="text-xs text-slate-500">{s.duration_minutes != null ? `${s.duration_minutes}m` : ''}</div>
                    </div>
                    <div className="text-sm text-slate-500 mt-2">ID: {s.id}</div>
                    <div className="text-sm text-slate-500">Bank: {bankTitle} ({bankCount} soal)</div>
                    <div className="mt-4 text-sm text-slate-600">Mulai Ujian</div>
                    <div className="text-base font-medium mt-1">
                      {(() => {
                        const raw = s.starts_at ?? (s.settings && s.settings.startsAt) ?? null;
                        if (!raw) return <span className="text-slate-400">Belum dijadwalkan</span>;
                        try {
                          const dt = new Date(raw);
                          return dt.toLocaleString();
                        } catch (e) {
                          return <span className="text-slate-400">Belum dijadwalkan</span>;
                        }
                      })()}
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button className="px-3 py-1 border rounded" onClick={()=>handleEdit(s)}>Edit</button>
                      <button className="px-3 py-1 bg-red-600 text-white rounded" onClick={()=>handleDelete(s.id)}>Hapus</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
