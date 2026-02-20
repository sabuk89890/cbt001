"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type ExamSession = {
  id: string;
  title: string;
  starts_at?: string | null;
  duration_minutes?: number | null;
  settings?: any;
  is_active?: boolean;
};

type Participant = {
  id: string;
  student_id: string;
  started_at?: string | null;
  finished_at?: string | null;
  status?: string | null;
  score?: number | null;
};

export default function StudentLobbyPage() {
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentClass, setStudentClass] = useState("");

  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [participantsMap, setParticipantsMap] = useState<Record<string, Participant | null>>({});
  const [submittedSessions, setSubmittedSessions] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);

  const pollingRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("auth:user");
      if (raw) {
        const auth = JSON.parse(raw);
        setStudentId(String(auth?.id ?? ""));
        setStudentName(auth?.fullName ?? auth?.username ?? "Siswa");
      }
    } catch {}

    async function load() {
      setIsLoading(true);
      try {
        const [r, b] = await Promise.all([
          fetch("/api/exams"),
          fetch("/api/admin/question-banks"),
        ]);
        const payload = await r.json();
        const data = payload.data ?? [];
        setSessions(data);
        // store bank list for lookup
        if (b.ok) {
          const bjson = await b.json();
          setBanks(bjson.data ?? []);
        }

        // load participants for each session in parallel and map by session id
        const parts = await Promise.all(
          (data as ExamSession[]).map(async (s) => {
            try {
              const rr = await fetch(`/api/exams/${s.id}`);
              const body = await rr.json();
              const participants: Participant[] = body?.data?.participants ?? [];
              // prefer stored studentId state but fall back to localStorage
              const currentStudentId = studentId || JSON.parse(localStorage.getItem('auth:user') || '{}')?.id;
              const me = participants.find((p) => p.student_id === currentStudentId);
              return { sessionId: s.id, me: me ?? null };
            } catch {
              return { sessionId: s.id, me: null };
            }
          })
        );

        const map: Record<string, Participant | null> = {};
        for (const p of parts) map[p.sessionId] = p.me;
        setParticipantsMap(map);

        // also fetch submissions for the current student as a fallback
        try {
          const currentStudentId = studentId || JSON.parse(localStorage.getItem('auth:user') || '{}')?.id;
          if (currentStudentId) {
            const sr = await fetch(`/api/student/submissions?studentId=${currentStudentId}`);
            if (sr.ok) {
              const sbody = await sr.json();
              const submitted: Record<string, boolean> = {};
              (sbody.data ?? []).forEach((r: any) => { submitted[r.sessionId] = true; });
              setSubmittedSessions(submitted);
            } else {
              setSubmittedSessions({});
            }
          }
        } catch {
          setSubmittedSessions({});
        }
      } catch (err) {
        // ignore
      } finally {
        setIsLoading(false);
      }
    }

    // initial load
    void load();

    // polling: refresh every 5s while tab is visible
    const POLL_MS = 5000;
    function startPolling() {
      if (pollingRef.current) return;
      pollingRef.current = window.setInterval(() => {
        if (document.visibilityState !== 'visible') return;
        void load();
      }, POLL_MS);
    }

    function stopPolling() {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }

    startPolling();

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') startPolling();
      else stopPolling();
    }

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [studentId]);

  const now = useMemo(() => new Date(), []);

  function formatTime(iso?: string | null) {
    if (!iso) return "-";
    try {
      const d = new Date(iso);
      return d.toLocaleString();
    } catch {
      return iso;
    }
  }

  return (
    <main className="min-h-screen px-6 py-8 text-slate-800">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold">Loby Ujian</h1>
            <p className="text-sm text-slate-500">Daftar sesi ujian untuk kelas Anda</p>
          </div>

          <div className="rounded-2xl bg-slate-100 p-4 text-sm text-slate-700">
            <p className="font-medium">{studentName}</p>
            <p className="text-xs text-slate-500">{studentClass || "Kelas -"}</p>
          </div>
        </header>

        {isLoading ? <p className="text-sm text-slate-500">Memuat sesi ujian...</p> : null}

        {!isLoading && sessions.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">Belum ada sesi ujian.</p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sessions.map((s) => {
            const bankObj = banks.find((b) => b.id === s.bank_id) as any | undefined;
            const bankTitle = bankObj?.title ?? '-';
            const bankCount = typeof bankObj?.questionCount === 'number' ? bankObj.questionCount : 0;
            const participant = participantsMap[s.id] ?? null;
            const startsAt = s.starts_at ? new Date(s.starts_at) : null;
            const duration = s.duration_minutes ?? (s.settings?.durationMinutes ?? null);
            const endsAt = startsAt && duration ? new Date(startsAt.getTime() + duration * 60000) : null;

            const isOngoing = startsAt ? now >= startsAt && (!endsAt || now <= endsAt) : true;
            const isFinished = endsAt ? now > endsAt : false;

            const didAttempt = ((!!participant && participant.status === "finished") || !!submittedSessions[s.id]);

            return (
              <article key={s.id} className="rounded-3xl border-l-4 border-l-violet-500 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xl font-semibold text-slate-800">{s.title}</p>
                    <p className="mt-1 text-sm text-slate-500">Jadwal: {startsAt ? formatTime(s.starts_at) : "-"}</p>
                    <p className="text-sm text-slate-500">Durasi: {duration ? `${duration} menit` : "-"}</p>
                  </div>
                  <div className="rounded-2xl bg-violet-100 p-3 text-violet-600">🧾</div>
                </div>

                <div className="mt-5">
                  <p className="text-sm text-slate-500">Status</p>
                  <p className="text-5xl font-semibold text-slate-700">{didAttempt ? "Sudah dikerjakan" : "Belum dimulai"}</p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {!didAttempt ? (
                    <Link
                      href={`/exam/${s.id}`}
                      className={`rounded-lg px-3 py-2 text-xs font-medium ${bankCount > 0 ? (isOngoing ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700') : 'bg-red-100 text-red-600 cursor-not-allowed'}`}
                      onClick={(e) => {
                        if (bankCount <= 0) {
                          e.preventDefault();
                          alert('Soal belum tersedia untuk sesi ini. Hubungi pengajar.');
                        }
                      }}
                    >
                      Kerjakan
                    </Link>
                  ) : (
                    <Link href="/score" className="rounded-lg bg-amber-500 px-3 py-2 text-xs text-white">Lihat Nilai</Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}
