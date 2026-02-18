"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { QuestionRenderer } from "@/components/cbt/question-renderer";
import type { ExamQuestion, SubmissionReview } from "@/lib/cbt/types";

type ReviewPageProps = {
  params: Promise<{ sessionId: string; submissionId: string }>;
};

export default function ReviewSubmissionPage({ params }: ReviewPageProps) {
  const [sessionId, setSessionId] = useState("");
  const [submissionId, setSubmissionId] = useState("");

  const [submission, setSubmission] = useState<SubmissionReview | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [essayScores, setEssayScores] = useState<Record<string, { score: string; notes: string }>>({});

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const init = async () => {
      const resolved = await params;
      setSessionId(resolved.sessionId);
      setSubmissionId(resolved.submissionId);

      try {
        const response = await fetch(
          `/api/exams/${resolved.sessionId}/submissions/${resolved.submissionId}/manual-grade`,
          { cache: "no-store" }
        );
        const result = (await response.json()) as {
          submission?: SubmissionReview;
          questions?: ExamQuestion[];
          error?: string;
        };

        if (!response.ok) {
          setMessage(result.error ?? "Gagal memuat data review");
          return;
        }

        const nextSubmission = result.submission ?? null;
        const nextQuestions = result.questions ?? [];

        setSubmission(nextSubmission);
        setQuestions(nextQuestions);

        if (nextSubmission) {
          const initialEssayScores = Object.fromEntries(
            nextSubmission.gradingDetail
              .filter((item) => item.questionType === "essay")
              .map((item) => [
                item.questionId,
                {
                  score: String(item.manualScore ?? item.finalScore ?? item.autoScore ?? 0),
                  notes: item.notes ?? "",
                },
              ])
          ) as Record<string, { score: string; notes: string }>;
          setEssayScores(initialEssayScores);
        }
      } catch {
        setMessage("Terjadi kesalahan saat memuat review");
      } finally {
        setIsLoading(false);
      }
    };

    void init();
  }, [params]);

  const detailMap = useMemo(() => {
    const nextMap = new Map<string, SubmissionReview["gradingDetail"][number]>();
    for (const item of submission?.gradingDetail ?? []) {
      nextMap.set(item.questionId, item);
    }
    return nextMap;
  }, [submission]);

  async function handleSaveReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!submission) {
      return;
    }

    setIsSaving(true);
    setMessage("");

    try {
      const payload = {
        reviewerId: "teacher-demo",
        reviewNote: "Reviewed from admin review page",
        essayScores: Object.entries(essayScores).map(([questionId, value]) => ({
          questionId,
          manualScore: Number(value.score),
          notes: value.notes,
        })),
      };

      const response = await fetch(
        `/api/exams/${sessionId}/submissions/${submissionId}/manual-grade`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const result = (await response.json()) as { error?: string; score?: number; status?: string };

      if (!response.ok) {
        setMessage(result.error ?? "Gagal menyimpan review manual");
        return;
      }

      setMessage(`Review tersimpan. Nilai akhir: ${result.score ?? 0} (${result.status ?? "-"})`);
    } catch {
      setMessage("Terjadi kesalahan saat menyimpan review");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-6 py-12">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Review Submission Guru</h1>
        <p className="text-sm opacity-80">
          Tampilan soal sama dengan halaman ujian siswa, ditambah panel koreksi manual essay.
        </p>
        <p className="text-xs opacity-70">
          Session: {sessionId || "..."} • Submission: {submissionId || "..."}
        </p>
      </header>

      {message ? <p className="text-sm">{message}</p> : null}

      {isLoading ? <p className="text-sm">Memuat data review...</p> : null}

      {!isLoading && submission ? (
        <form className="space-y-4" onSubmit={handleSaveReview}>
          {questions.map((question, index) => {
            const detail = detailMap.get(question.id);

            return (
              <section key={question.id} className="space-y-2">
                <QuestionRenderer
                  index={index}
                  question={question}
                  value={submission.answers[question.id]}
                  readOnly
                />

                {detail ? (
                  <div className="rounded-md border p-3 text-sm">
                    <p>
                      Auto score: {detail.autoScore}/{detail.maxScore} • Final: {detail.finalScore}/{detail.maxScore}
                    </p>
                    {detail.notes ? <p className="opacity-80">Catatan: {detail.notes}</p> : null}
                  </div>
                ) : null}

                {question.questionType === "essay" ? (
                  <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-2">
                    <label className="space-y-1 text-sm">
                      <span>Nilai Manual Essay</span>
                      <input
                        type="number"
                        min={0}
                        max={question.maxScore}
                        value={essayScores[question.id]?.score ?? "0"}
                        onChange={(event) =>
                          setEssayScores((prev) => ({
                            ...prev,
                            [question.id]: {
                              score: event.target.value,
                              notes: prev[question.id]?.notes ?? "",
                            },
                          }))
                        }
                        className="w-full rounded-md border px-3 py-2"
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span>Catatan Guru</span>
                      <textarea
                        rows={3}
                        value={essayScores[question.id]?.notes ?? ""}
                        onChange={(event) =>
                          setEssayScores((prev) => ({
                            ...prev,
                            [question.id]: {
                              score: prev[question.id]?.score ?? "0",
                              notes: event.target.value,
                            },
                          }))
                        }
                        className="w-full rounded-md border px-3 py-2"
                      />
                    </label>
                  </div>
                ) : null}
              </section>
            );
          })}

          <button
            type="submit"
            disabled={isSaving}
            className="rounded-md border px-4 py-2 disabled:opacity-50"
          >
            {isSaving ? "Menyimpan review..." : "Simpan Review Manual"}
          </button>
        </form>
      ) : null}
    </main>
  );
}
