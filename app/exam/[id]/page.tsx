"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QuestionRenderer } from "@/components/cbt/question-renderer";
import type { ExamQuestion } from "@/lib/cbt/types";

type ExamSessionPageProps = { params: Promise<{ id: string }> };

export default function ExamSessionPage({ params }: ExamSessionPageProps) {
  const [sessionId, setSessionId] = useState("");
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [confirmationVisible, setConfirmationVisible] = useState(true);
  const [tokenInput, setTokenInput] = useState("");
  const [startError, setStartError] = useState("");
  const [studentName, setStudentName] = useState<string | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [unsureSet, setUnsureSet] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [showQuestionList, setShowQuestionList] = useState(false);
  const timerRef = useRef<number | null>(null);

  // helper: format remaining ms -> HH:MM:SS or MM:SS
  const formatRemaining = (ms: number | null) => {
    if (ms === null) return "--:--";
    if (ms <= 0) return "00:00";
    const totalSeconds = Math.floor(ms / 1000);
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hrs > 0) return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  useEffect(() => {
    let mounted = true;

    async function init() {
      const resolved = await params;
      const sid = resolved.id;
      setSessionId(sid);
      setIsLoading(true);

      try {
        // load session metadata (includes participants)
        const r = await fetch(`/api/exams/${sid}`);
        const payload = await r.json();
        const session = payload.data?.session ?? null;
        if (!session) {
          // don't show the generic message to the user here
          setIsLoading(false);
          return;
        }

        if (!mounted) return;
        setSessionInfo(session);

        // compute remaining time if possible (support multiple possible fields)
        const startsAt = session.starts_at ? new Date(session.starts_at).getTime() : null;
        const durationMin = session.duration_minutes ?? (session.settings?.durationMinutes ?? null);

        // session may provide an explicit 'ends_at'/'endsAt' or embed it in settings
        let endTime: number | null = null;
        const candidateEnds = session.ends_at ?? session.endsAt ?? session.settings?.endsAt ?? null;
        if (candidateEnds) {
          if (typeof candidateEnds === 'number') {
            endTime = candidateEnds;
          } else {
            const parsed = Date.parse(String(candidateEnds));
            if (!isNaN(parsed)) endTime = parsed;
          }
        }

        // fallback to starts_at + duration if explicit end not available
        if (!endTime && startsAt && durationMin) {
          endTime = startsAt + durationMin * 60000;
        }

        if (endTime) setRemainingMs(Math.max(0, endTime - Date.now()));

        // determine student id and name from localStorage
        let studentId: string | null = null;
        try {
          const raw = localStorage.getItem('auth:user');
          if (raw) {
            const parsed = JSON.parse(raw);
            studentId = parsed?.id ?? null;
            setStudentName(parsed?.fullName ?? parsed?.username ?? 'Siswa');
          }
        } catch {}

        // check if a participant already exists for this student in session
        let existingParticipantId: string | null = null;
        try {
          const participants = payload.data?.participants ?? [];
          const me = participants.find((p: any) => p.student_id === studentId && (p.status === 'in_progress' || p.status === 'not_started'));
          if (me) existingParticipantId = me.id;
        } catch {}

        // if not exist, either show confirmation or start participant
        let pid = existingParticipantId;
        if (!pid && confirmationVisible) {
          // don't proceed, let UI show confirmation
          setIsLoading(false);
          return;
        }
        if (!pid) {
          // include token if previously stored during validation
          let payload: any = { studentId };
          if (tokenInput) payload.token = tokenInput;
          try {
            const tok = sessionStorage.getItem(`examToken-${sid}`);
            if (tok && !payload.token) payload.token = tok;
          } catch {}
          const sr = await fetch(`/api/exams/${sid}/participants/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const sres = await sr.json();
          if (!sr.ok) {
            // validation error (likely wrong token) -> surface to user
            setStartError(sres.error ?? 'Gagal memulai ujian');
            setConfirmationVisible(true);
            setIsLoading(false);
            return;
          }
          pid = sres.data?.participantId;
          // remember token for this session so user doesn't have to re-enter
          if (tokenInput) {
            try { sessionStorage.setItem(`examToken-${sid}`, tokenInput); } catch {}
          }
        }

        if (!mounted) return;
        setParticipantId(pid ?? null);

        // fetch participant-specific ordered questions
        const qRes = await fetch(`/api/exams/${sid}/participants/${pid}/questions`);
        const qPayload = await qRes.json();
        if (!qRes.ok) {
          setIsLoading(false);
          return;
        }

        const qs = qPayload.data ?? [];
        setQuestions(qs);

        // restore saved answers (server -> localStorage merge fallback)
        try {
          const aRes = await fetch(`/api/exams/${sid}/participants/${pid}/answers`);
          if (aRes.ok) {
            const aJson = await aRes.json();
            const serverAnswers = aJson.data?.answers ?? {};

            // merge with any localStorage (local overrides)
            let localAnswers = {};
            try {
              const raw = localStorage.getItem(`exam:${sid}:participant:${pid}:answers`);
              if (raw) localAnswers = JSON.parse(raw);
            } catch {}

            const merged = { ...(serverAnswers ?? {}), ...(localAnswers ?? {}) };
            setAnswers(merged);
          } else {
            // if server doesn't have answers, still try localStorage
            try {
              const raw = localStorage.getItem(`exam:${sid}:participant:${pid}:answers`);
              if (raw) setAnswers(JSON.parse(raw));
            } catch {}
          }
        } catch (err) {
          try {
            const raw = localStorage.getItem(`exam:${sid}:participant:${pid}:answers`);
            if (raw) setAnswers(JSON.parse(raw));
          } catch {}
        }

        // schedule autosave from client -> server (debounced)
        let autosaveTimer: number | null = null;
        const scheduleAutosave = (latestAnswers: Record<string, unknown>) => {
          if (autosaveTimer) window.clearTimeout(autosaveTimer);
          autosaveTimer = window.setTimeout(async () => {
            try {
              await fetch(`/api/exams/${sid}/participants/${pid}/answers`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ answers: latestAnswers, merge: true }),
              });
            } catch (e) {
              /* best-effort */
            }
          }, 1200);
        };

        // attach a listener so changes to answers state trigger autosave
        const answersObserver = (e: Event) => {
          // noop placeholder for cleanup; actual autosave is handled by effect below
        };
        window.addEventListener('visibilitychange', answersObserver);

        // compute final end time (participant.start takes precedence)
        let finalEndTime: number | null = null;
        try {
          const participants = payload.data?.participants ?? [];
          const me = participants.find((p: any) => p.student_id === studentId && (p.status === 'in_progress' || p.status === 'not_started'));
          // if participant exists on session record and has started_at, use that
          if (me && me.started_at && durationMin) {
            const parsed = Date.parse(String(me.started_at));
            if (!isNaN(parsed)) finalEndTime = parsed + durationMin * 60000;
          }
        } catch (e) {
          // ignore
        }

        // if we just created the participant, assume it started now
        if (!finalEndTime && pid && !payload.data?.participants?.find((p: any) => p.id === pid) && durationMin) {
          finalEndTime = Date.now() + (durationMin * 60000);
        }

        // fallback to explicit session end or session.starts_at + duration
        if (!finalEndTime) {
          const candidateEnds = session.ends_at ?? session.endsAt ?? session.settings?.endsAt ?? null;
          if (candidateEnds) {
            const parsed = typeof candidateEnds === 'number' ? candidateEnds : Date.parse(String(candidateEnds));
            if (!isNaN(parsed)) finalEndTime = parsed;
          }
        }
        if (!finalEndTime && session.starts_at && durationMin) {
          const s = Date.parse(String(session.starts_at));
          if (!isNaN(s)) finalEndTime = s + durationMin * 60000;
        }

        if (finalEndTime) {
          setRemainingMs(Math.max(0, finalEndTime - Date.now()));
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = window.setInterval(() => {
            const rem = Math.max(0, finalEndTime! - Date.now());
            setRemainingMs(rem);
            if (rem <= 0) {
              // time's up -> auto-submit
              clearInterval(timerRef.current!);
              void handleAutoSubmit(sid, studentId, answers);
            }
          }, 1000);
        }
      } catch (err) {
        // hide low-value errors from UI here
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    void init();

    return () => {
      mounted = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [params, confirmationVisible]);

  // keep answers in state; update handler
  const handleAnswerChange = useCallback((questionId: string, value: unknown) => {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: value };
      try {
        // persist locally immediately as fallback
        if (sessionId && participantId) {
          localStorage.setItem(`exam:${sessionId}:participant:${participantId}:answers`, JSON.stringify(next));
        }
      } catch {}
      return next;
    });

    // clear unsure flag when user answers
    setUnsureSet((prev) => {
      if (!prev[questionId]) return prev;
      const copy = { ...prev };
      delete copy[questionId];
      return copy;
    });
  }, [participantId, sessionId]);

  // autosave answers to server (debounced) + flush on unload
  useEffect(() => {
    if (!participantId || !sessionId) return;
    let timer: number | null = null;
    const save = async (payload: Record<string, unknown>) => {
      try {
        await fetch(`/api/exams/${sessionId}/participants/${participantId}/answers`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers: payload, merge: true }),
        });
      } catch (e) {
        // best-effort
      }
    };

    // debounce save
    if (Object.keys(answers).length > 0) {
      timer = window.setTimeout(() => void save(answers), 1200);
    }

    const flush = () => {
      try {
        // use navigator.sendBeacon where available for unload
        const url = `/api/exams/${sessionId}/participants/${participantId}/answers`;
        const body = JSON.stringify({ answers, merge: true });
        if (navigator.sendBeacon) {
          navigator.sendBeacon(url, body);
        } else {
          // fallback synchronous XHR (best-effort)
          const xhr = new XMLHttpRequest();
          xhr.open('PATCH', url, false);
          xhr.setRequestHeader('Content-Type', 'application/json');
          try {
            xhr.send(body);
          } catch {}
        }
      } catch {}
    };

    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);

    return () => {
      if (timer) window.clearTimeout(timer);
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
    };
  }, [answers, participantId, sessionId]);

  const toggleUnsure = useCallback((questionId: string) => {
    setUnsureSet((prev) => {
      const next = { ...prev };
      if (next[questionId]) delete next[questionId];
      else next[questionId] = true;
      return next;
    });
  }, []);

  const getQuestionState = (questionId: string) => {
    if (unsureSet[questionId]) return 'ragu';
    if (answers[questionId] !== undefined && answers[questionId] !== null && answers[questionId] !== '') return 'answered';
    return 'unanswered';
  };

  const handlePrevious = () => setCurrentIndex((i) => Math.max(0, i - 1));
  const handleNext = () => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1));

  const handleJumpTo = (index: number) => setCurrentIndex(index);

  const submitAnswers = async (sid: string, studentId?: string | null) => {
    setIsSubmitting(true);
    setMessage('');
    try {
      const res = await fetch(`/api/exams/${sid}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, studentId }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setMessage(payload.error ?? 'Gagal mengumpulkan');
        setIsSubmitting(false);
        return;
      }
      setMessage(`Terkumpul • Nilai: ${payload.score ?? '-'} • Submission: ${payload.submissionId ?? '-'}`);
      // navigate to score page after brief delay
      setTimeout(() => (window.location.href = '/score'), 1200);
    } catch (err) {
      setMessage('Gagal mengumpulkan ujian');
      setIsSubmitting(false);
    }
  };

  const handleSubmitConfirm = useCallback(async () => {
    // count unanswered questions
    const unansweredCount = questions.reduce((acc, q) => {
      const a = answers[q.id];
      const answered = a !== undefined && a !== null && a !== "";
      return answered ? acc : acc + 1;
    }, 0);

    if (unansweredCount > 0) {
      const proceed = window.confirm(
        `Masih ada ${unansweredCount} soal belum dijawab. Anda yakin tetap ingin mengakhiri ujian dan mengumpulkan jawaban?`
      );
      if (!proceed) return;
    } else {
      const ok = window.confirm('Yakin ingin mengakhiri ujian dan mengumpulkan jawaban?');
      if (!ok) return;
    }

    const raw = localStorage.getItem('auth:user');
    const studentId = raw ? JSON.parse(raw)?.id : null;
    await submitAnswers(sessionId, studentId);
  }, [sessionId, answers, questions]);

  const handleAutoSubmit = async (sid: string, studentId: string | null, currentAnswers: Record<string, unknown>) => {
    // auto-submit when time runs out
    await submitAnswers(sid, studentId);
  };

  const currentQuestion = questions[currentIndex];

  if (confirmationVisible && !isLoading && !participantId && sessionInfo) {
    // show confirmation dialog prior to starting exam
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-100">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Konfirmasi Tes</h2>
          <p className="text-sm">Nama Tes</p>
          <p className="font-medium mb-2">{sessionInfo.title || '-'}</p>
          <p className="text-sm">Status Tes</p>
          <p className="font-medium mb-2">{sessionInfo.is_active ? 'Sedang berjalan' : 'Tes Baru'}</p>
          <p className="text-sm">Waktu Tes</p>
          <p className="font-medium mb-2">
            {(() => {
              const raw =
                sessionInfo.starts_at ||
                sessionInfo.startsAt ||
                sessionInfo.settings?.startsAt ||
                sessionInfo.settings?.starts_at ||
                null;
              return raw ? new Date(raw).toLocaleString() : '-';
            })()}
          </p>
          <p className="text-sm">Alokasi Waktu Tes</p>
          <p className="font-medium mb-4">{sessionInfo.duration_minutes ?? sessionInfo.settings?.durationMinutes ?? '-'} Menit</p>
          {startError ? <p className="text-sm text-red-600 mb-2">{startError}</p> : null}
          {/* token field if required */}
          {sessionInfo?.settings?.token ? (
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700">Token</label>
              <input
                type="text"
                value={tokenInput}
                onChange={(e) => { setTokenInput(e.target.value); setStartError(''); }}
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </div>
          ) : null}
          <button
            onClick={() => {
              setStartError('');
              setConfirmationVisible(false);
              setIsLoading(true);
            }}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white"
          >
            Mulai
          </button>
        </div>
      </div>
    );
  }

  return (
    <main
      className="mx-auto min-h-screen w-full max-w-6xl px-6 py-8"
      style={{
        backgroundImage: "url('/backgrounds/exam-bg.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: 'rgba(0,0,0,0.22)',
        backgroundBlendMode: 'multiply',
      }}
    >
      {/* page header (site header is from layout) */}
      {/* Blue header (match Loby style) */}
      <header className="bg-gradient-to-r from-sky-600 to-blue-800 px-6 py-4 text-white rounded-md mb-6 shadow-sm">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image src="https://iili.io/fynLLYJ.png" alt="Logo" width={56} height={56} className="h-12 w-12 rounded-full object-contain" />
            <div>
              <p className="text-2xl font-semibold">CBT SMP Negeri 1 Bukit</p>
              <p className="text-sm opacity-80">{sessionInfo?.title ?? 'Sesi Ujian'}</p>
              <p className="text-sm opacity-90 mt-1">{studentName || 'Siswa'}</p>
            </div>
          </div>

          <div className="text-sm text-white text-right">
            <div>@2026 EfKa Studio</div>
            <div className="text-xs opacity-80">By Feri Kurniawan, M.Pd.</div>
          </div>
        </div>
      </header>

      {isLoading ? <p className="text-sm text-slate-500">Memuat sesi ujian...</p> : null}

      {!isLoading && questions.length === 0 ? (
        <div className="mt-6 rounded-md bg-amber-50 border border-amber-200 p-6 text-amber-800">
          <p>Tidak ada soal tersedia untuk sesi ini. Hubungi pengajar atau coba lagi nanti.</p>
        </div>
      ) : null}

      {!isLoading && questions.length > 0 ? (
        <div className="space-y-6">
          {/* top toolbar: SOAL NO | SISA WAKTU | DAFTAR SOAL */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-xs font-semibold text-slate-600 uppercase">Soal No.</div>
              <div className="bg-blue-600 text-white rounded-md px-3 py-1 text-sm font-bold">{currentIndex + 1}</div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-xs text-slate-500">Sisa Waktu</div>
              <div className="bg-white rounded-full px-4 py-2 text-sm font-medium border shadow-sm">{formatRemaining(remainingMs)}</div>
            </div>

            <div>
              {!showQuestionList ? (
                <button onClick={() => setShowQuestionList((v) => !v)} className="rounded-full bg-blue-600 px-4 py-2 text-sm text-white flex items-center gap-3 shadow-md">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-90"><rect x="3" y="3" width="8" height="8" rx="1" fill="white"/><rect x="13" y="3" width="8" height="8" rx="1" fill="white"/><rect x="3" y="13" width="8" height="8" rx="1" fill="white"/><rect x="13" y="13" width="8" height="8" rx="1" fill="white"/></svg>
                  <span className="font-medium">DAFTAR SOAL</span>
                </button>
              ) : null}
            </div>
          </div>

          {/* question card centered */}
          <div className="flex justify-center">
            <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl relative">
              {/* question number top-left */}
              <div className="absolute left-6 top-6 text-sm text-slate-400">No. {currentIndex + 1}</div>

              {/* question content */}
              <div className="pt-6">
                <QuestionRenderer index={currentIndex} question={currentQuestion as any} value={answers[currentQuestion?.id ?? '']} onChange={(v) => handleAnswerChange(currentQuestion.id, v)} />
              </div>
            </div>
          </div>

          {/* navigation buttons (hidden while question list open to avoid overlap) */}
          {!showQuestionList ? (
            <div className="flex items-center justify-between">
              <button onClick={handlePrevious} disabled={currentIndex === 0} className="rounded-full bg-rose-400 px-5 py-3 text-sm text-white disabled:opacity-50">Soal Sebelumnya</button>
              <button onClick={() => toggleUnsure(currentQuestion.id)} className={`rounded-full px-5 py-3 text-sm ${unsureSet[currentQuestion.id] ? 'bg-amber-400 text-white' : 'bg-amber-100 text-slate-700'}`}>Ragu-Ragu</button>
              {currentIndex < questions.length - 1 ? (
                <button onClick={handleNext} className="rounded-full bg-blue-600 px-5 py-3 text-sm text-white">Selanjutnya</button>
              ) : (
                <button onClick={handleSubmitConfirm} className="rounded-full bg-emerald-600 px-5 py-3 text-sm text-white">Kumpulkan</button>
              )}
            </div>
          ) : null}

          {/* Question list panel on the right (does not cover main question) */}
          {showQuestionList ? (
            <aside className="fixed right-6 top-28 w-72 h-[calc(100vh-8rem)] overflow-auto bg-white p-4 rounded-2xl shadow-md border z-40">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Daftar Soal</h3>
                <button onClick={() => setShowQuestionList(false)} className="rounded px-2 py-1 text-sm border">Tutup</button>
              </div>

              <div className="grid gap-3 grid-cols-5 sm:grid-cols-5">
                {questions.map((q, idx) => {
                  const state = getQuestionState(q.id);
                  const base = 'w-10 h-10 rounded-md flex items-center justify-center text-sm font-medium cursor-pointer border';
                  const cls = state === 'answered' ? `${base} bg-blue-600 text-white border-blue-700` : state === 'ragu' ? `${base} bg-amber-300 text-slate-800 border-amber-400` : `${base} bg-white text-slate-700 border-slate-200`;
                  return (
                    <button
                      key={q.id}
                      onClick={() => handleJumpTo(idx)}
                      className={cls}
                      title={`Soal ${idx + 1}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </aside>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
