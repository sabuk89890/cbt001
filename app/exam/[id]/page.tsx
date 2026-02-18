"use client";

import { FormEvent, useEffect, useState } from "react";
import { QuestionRenderer } from "@/components/cbt/question-renderer";
import type { ExamQuestion } from "@/lib/cbt/types";

type ExamSessionPageProps = {
  params: Promise<{ id: string }>;
};

export default function ExamSessionPage({ params }: ExamSessionPageProps) {
  const [sessionId, setSessionId] = useState("");
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const init = async () => {
      const resolved = await params;
      setSessionId(resolved.id);

      try {
        const response = await fetch("/api/questions", { cache: "no-store" });
        const result = (await response.json()) as {
          data?: ExamQuestion[];
          error?: string;
        };

        if (!response.ok) {
          setMessage(result.error ?? "Gagal memuat soal");
          return;
        }

        setQuestions(result.data ?? []);
      } catch {
        setMessage("Terjadi kesalahan saat memuat soal");
      } finally {
        setIsLoading(false);
      }
    };

    void init();
  }, [params]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    try {
      const response = await fetch(`/api/exams/${sessionId}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          answers,
        }),
      });

      const result = (await response.json()) as {
        score?: number;
        status?: string;
        submissionId?: string;
        needsManualReview?: boolean;
        error?: string;
      };

      if (!response.ok) {
        setMessage(result.error ?? "Submit gagal");
        return;
      }

      setMessage(
        `Submit berhasil. Nilai: ${result.score ?? 0} (${result.status ?? "-"})${
          result.needsManualReview ? " • Essay menunggu review guru" : ""
        } • Submission: ${result.submissionId ?? "-"}`
      );
    } catch {
      setMessage("Terjadi kesalahan saat submit ujian");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-6 py-12">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Sesi Ujian: {sessionId || "..."}</h1>
        <p className="text-sm opacity-80">
          Tampilan soal siswa dipakai juga oleh halaman review guru.
        </p>
      </header>

      {message ? <p className="text-sm">{message}</p> : null}

      {isLoading ? <p className="text-sm">Memuat soal...</p> : null}

      {!isLoading ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          {questions.map((question, index) => (
            <QuestionRenderer
              key={question.id}
              index={index}
              question={question}
              value={answers[question.id]}
              onChange={(nextValue) =>
                setAnswers((prev) => ({
                  ...prev,
                  [question.id]: nextValue,
                }))
              }
            />
          ))}

          <button
            type="submit"
            disabled={isSubmitting || questions.length === 0}
            className="rounded-md border px-4 py-2 disabled:opacity-50"
          >
            {isSubmitting ? "Mengirim..." : "Submit Jawaban"}
          </button>
        </form>
      ) : null}
    </main>
  );
}
