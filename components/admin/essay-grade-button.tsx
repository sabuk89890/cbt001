"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

type Props = {
  sessionId: string;
  submissionId: string;
  studentName?: string | null;
};

export default function EssayGradeButton({ sessionId, submissionId, studentName }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [questions, setQuestions] = useState<any[]>([]);
  const [submission, setSubmission] = useState<any | null>(null);
  const [essayScores, setEssayScores] = useState<Record<string, { score: string; notes: string }>>({});
  const router = useRouter();
  
  // modal will be rendered into document.body (below) via React portal to avoid stacking-context issues.

  useEffect(() => {
    if (!open) return;

    let mounted = true;
    const load = async () => {
      setLoading(true);
      setMessage("");
      try {
        const res = await fetch(`/api/exams/${sessionId}/submissions/${submissionId}/manual-grade`, { cache: "no-store" });
        const j = await res.json();
        if (!res.ok) {
          setMessage(j.error ?? "Gagal memuat data");
          return;
        }
        if (!mounted) return;
        setSubmission(j.submission ?? null);
        setQuestions(j.questions ?? []);
        const initialEssayScores: Record<string, { score: string; notes: string }> = {};
        (j.submission?.gradingDetail ?? []).forEach((d: any) => {
          if (d.questionType === "essay") {
            initialEssayScores[d.questionId] = { score: String(d.manualScore ?? d.finalScore ?? d.autoScore ?? 0), notes: d.notes ?? "" };
          }
        });
        setEssayScores(initialEssayScores);
      } catch (e) {
        setMessage("Terjadi kesalahan saat memuat data");
      } finally {
        setLoading(false);
      }
    };

    void load();
    return () => { mounted = false; };
  }, [open, sessionId, submissionId]);

  const handleChange = (questionId: string, field: "score" | "notes", value: string) => {
    setEssayScores((prev) => ({ ...(prev ?? {}), [questionId]: { ...(prev?.[questionId] ?? { score: "0", notes: "" }), [field]: value } }));
  };

  const handleSave = async () => {
    if (!submission) return;
    setSaving(true);
    setMessage("");
    try {
      const payload = {
        reviewerId: (() => {
          try {
            const raw = localStorage.getItem('auth:user');
            if (raw) return JSON.parse(raw).id ?? '';
          } catch {}
          return '';
        })(),
        reviewNote: 'Reviewed from admin quick modal',
        essayScores: Object.entries(essayScores).map(([questionId, v]) => ({ questionId, manualScore: Number(v.score), notes: v.notes })),
      };

      const res = await fetch(`/api/exams/${sessionId}/submissions/${submissionId}/manual-grade`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) {
        setMessage(j.error ?? 'Gagal menyimpan');
        return;
      }
      setMessage(`Tersimpan • Nilai akhir: ${j.score ?? '-'} (${j.status ?? '-'})`);
      // refresh server-rendered data
      router.refresh();
      setTimeout(() => setOpen(false), 900);
    } catch (e) {
      setMessage('Terjadi kesalahan saat menyimpan');
    } finally {
      setSaving(false);
    }
  };

  // determine if submission has essay items to enable the button
  const hasEssay = Array.isArray(submission?.gradingDetail)
    ? submission.gradingDetail.some((d: any) => d.questionType === 'essay')
    : false;

  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-full bg-rose-600 text-white px-4 py-2 text-sm shadow-sm hover:bg-rose-700 transition">
        Nilai Essay
      </button>

      {open ? createPortal(
        <div className="fixed inset-0 z-[9999] flex items-start justify-center p-6">
          <div className="absolute inset-0 z-[9998] bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative z-[10000] w-full max-w-4xl overflow-auto rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold">Penilaian soal essay</h3>
                <div className="text-sm text-slate-500">{studentName ?? submission?.studentId}</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setOpen(false)} className="rounded border px-3 py-1 text-sm">Tutup</button>
                <button onClick={handleSave} disabled={saving || loading} className="rounded bg-blue-600 px-4 py-2 text-sm text-white">{saving ? 'Menyimpan...' : 'Simpan'}</button>
              </div>
            </div>

            <div className="p-6">
              {loading ? <div className="text-sm text-slate-500">Memuat...</div> : null}
              {message ? <div className="mb-4 rounded border bg-amber-50 p-3 text-sm text-amber-700">{message}</div> : null}

              {!loading && submission ? (
                <div className="overflow-hidden rounded-md border">
                  <table className="w-full table-fixed text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-left text-xs text-slate-600">
                        <th className="w-12 px-4 py-3">No.</th>
                        <th className="px-4 py-3">Soal</th>
                        <th className="w-80 px-4 py-3">Jawaban</th>
                        <th className="w-32 px-4 py-3">Nilai</th>
                      </tr>
                    </thead>
                    <tbody>
                      {submission.gradingDetail?.filter((d:any)=>d.questionType === 'essay').map((detail:any, idx:number) => {
                        const q = (questions ?? []).find((x:any) => x.id === detail.questionId) ?? null;
                        const ans = submission.answers ? submission.answers[detail.questionId] : null;
                        const current = essayScores[detail.questionId] ?? { score: String(detail.manualScore ?? detail.finalScore ?? detail.autoScore ?? 0), notes: detail.notes ?? '' };

                        return (
                          <tr key={detail.questionId} className="border-t">
                            <td className="px-4 py-4 text-slate-600">{idx + 1}</td>
                            <td className="px-4 py-4"><div className="text-sm text-slate-700">{q?.prompt ?? detail.questionId}</div></td>
                            <td className="px-4 py-4"><div className="max-h-32 overflow-auto rounded bg-slate-50 p-3 text-sm text-slate-700">{typeof ans === 'string' ? ans : JSON.stringify(ans)}</div></td>
                            <td className="px-4 py-4">
                              <div className="flex flex-col gap-2">
                                <input type="number" min={0} max={detail.maxScore} value={current.score} onChange={(e) => handleChange(detail.questionId, 'score', e.target.value)} className="w-full rounded border px-3 py-2 text-sm" />
                                <div className="text-xs text-slate-400">max {detail.maxScore}</div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </div>
        </div>,
        document.body
      ) : null}
    </>
  );
}
