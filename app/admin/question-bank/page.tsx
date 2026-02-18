"use client";

import { FormEvent, useEffect, useState } from "react";
import { QUESTION_TYPES, type QuestionType } from "@/lib/cbt/question-engine";

type Question = {
  id: string;
  subject: string | null;
  prompt: string;
  questionType: QuestionType;
  options: string[];
  correctAnswer: string;
  answerKey: Record<string, unknown>;
  maxScore: number;
};

export default function QuestionBankPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [id, setId] = useState("");
  const [subject, setSubject] = useState("");
  const [prompt, setPrompt] = useState("");
  const [questionType, setQuestionType] = useState<QuestionType>("multiple-choice");
  const [maxScore, setMaxScore] = useState("10");

  const [optionsText, setOptionsText] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [correctAnswersText, setCorrectAnswersText] = useState("");
  const [essayKeywordsText, setEssayKeywordsText] = useState("");
  const [matchingPairsText, setMatchingPairsText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadQuestions() {
    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/questions", { cache: "no-store" });
      const result = (await response.json()) as {
        data?: Question[];
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
  }

  useEffect(() => {
    void loadQuestions();
  }, []);

  function normalizeLines(text: string) {
    return text
      .split("\n")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  function buildQuestionPayload() {
    const score = Number(maxScore);
    if (!Number.isFinite(score) || score <= 0) {
      return { ok: false as const, error: "Max score harus lebih dari 0" };
    }

    if (questionType === "multiple-choice") {
      const options = [...new Set(normalizeLines(optionsText))];
      const normalizedCorrectAnswer = correctAnswer.trim();

      if (options.length < 2) {
        return {
          ok: false as const,
          error: "Pilihan ganda minimal memiliki 2 opsi",
        };
      }

      if (!options.includes(normalizedCorrectAnswer)) {
        return {
          ok: false as const,
          error: "Jawaban benar harus ada di daftar opsi",
        };
      }

      return {
        ok: true as const,
        payload: {
          id,
          subject,
          prompt,
          questionType,
          maxScore: score,
          options,
          correctAnswer: normalizedCorrectAnswer,
        },
      };
    }

    if (questionType === "multiple-choice-complex") {
      const options = [...new Set(normalizeLines(optionsText))];
      const correctAnswers = [...new Set(normalizeLines(correctAnswersText))];

      if (options.length < 2) {
        return {
          ok: false as const,
          error: "Pilihan ganda kompleks minimal memiliki 2 opsi",
        };
      }

      if (correctAnswers.length < 2) {
        return {
          ok: false as const,
          error: "Jawaban benar minimal 2 untuk pilihan ganda kompleks",
        };
      }

      if (correctAnswers.some((answer) => !options.includes(answer))) {
        return {
          ok: false as const,
          error: "Semua jawaban benar harus ada di daftar opsi",
        };
      }

      return {
        ok: true as const,
        payload: {
          id,
          subject,
          prompt,
          questionType,
          maxScore: score,
          options,
          answerKey: { correctAnswers },
        },
      };
    }

    if (questionType === "essay") {
      const keywords = [...new Set(normalizeLines(essayKeywordsText))];
      const modelAnswer = correctAnswer.trim();

      if (!modelAnswer) {
        return { ok: false as const, error: "Model jawaban essay wajib diisi" };
      }

      return {
        ok: true as const,
        payload: {
          id,
          subject,
          prompt,
          questionType,
          maxScore: score,
          correctAnswer: modelAnswer,
          answerKey: {
            modelAnswer,
            keywords,
            minKeywordMatch: 1,
            allowManualReview: true,
          },
        },
      };
    }

    if (questionType === "true-false") {
      const normalized = correctAnswer.trim().toLowerCase();
      if (!["benar", "salah", "true", "false"].includes(normalized)) {
        return {
          ok: false as const,
          error: "Untuk benar/salah, jawaban harus 'Benar' atau 'Salah'",
        };
      }

      return {
        ok: true as const,
        payload: {
          id,
          subject,
          prompt,
          questionType,
          maxScore: score,
          correctAnswer: normalized,
        },
      };
    }

    const pairs = matchingPairsText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        const [left, right] = line.split("=>").map((item) => item.trim());
        return { left, right };
      })
      .filter((item) => item.left && item.right);

    if (pairs.length < 2) {
      return {
        ok: false as const,
        error: "Soal menjodohkan minimal memiliki 2 pasangan (format: kiri => kanan)",
      };
    }

    return {
      ok: true as const,
      payload: {
        id,
        subject,
        prompt,
        questionType,
        maxScore: score,
        answerKey: { pairs },
      },
    };
  }

  async function handleCreateQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsSubmitting(true);

    try {
      const build = buildQuestionPayload();
      if (!build.ok) {
        setMessage(build.error);
        return;
      }

      const response = await fetch("/api/questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(build.payload),
      });

      const result = (await response.json()) as {
        data?: Question;
        error?: string;
      };

      if (!response.ok) {
        setMessage(result.error ?? "Gagal menambah soal");
        return;
      }

      setId("");
      setSubject("");
      setPrompt("");
      setQuestionType("multiple-choice");
      setMaxScore("10");
      setOptionsText("");
      setCorrectAnswer("");
      setCorrectAnswersText("");
      setEssayKeywordsText("");
      setMatchingPairsText("");
      setMessage("Soal berhasil ditambahkan");
      await loadQuestions();
    } catch {
      setMessage("Terjadi kesalahan saat menambah soal");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteQuestion(questionId: string) {
    const confirmed = window.confirm(`Hapus soal ${questionId}?`);
    if (!confirmed) {
      return;
    }

    setMessage("");

    try {
      const response = await fetch(`/api/questions/${questionId}`, {
        method: "DELETE",
      });

      const result = (await response.json()) as { message?: string; error?: string };

      if (!response.ok) {
        setMessage(result.error ?? "Gagal menghapus soal");
        return;
      }

      setMessage(result.message ?? "Soal berhasil dihapus");
      await loadQuestions();
    } catch {
      setMessage("Terjadi kesalahan saat menghapus soal");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-6 py-12">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Bank Soal</h1>
        <p className="text-sm opacity-80">
          Data soal diambil dari Supabase melalui endpoint API.
        </p>
      </header>

      <form onSubmit={handleCreateQuestion} className="space-y-3 rounded-lg border p-4">
        <h2 className="text-lg font-medium">Tambah Soal</h2>
        <input
          type="text"
          placeholder="ID soal (contoh: q-003)"
          value={id}
          onChange={(event) => setId(event.target.value)}
          className="w-full rounded-md border px-3 py-2"
          required
        />
        <input
          type="text"
          placeholder="Mata pelajaran"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          className="w-full rounded-md border px-3 py-2"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <select
            value={questionType}
            onChange={(event) => setQuestionType(event.target.value as QuestionType)}
            className="w-full rounded-md border px-3 py-2"
          >
            {QUESTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            value={maxScore}
            onChange={(event) => setMaxScore(event.target.value)}
            className="w-full rounded-md border px-3 py-2"
            placeholder="Max score"
            required
          />
        </div>
        <textarea
          placeholder="Pertanyaan"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          className="w-full rounded-md border px-3 py-2"
          rows={3}
          required
        />

        {questionType === "multiple-choice" || questionType === "multiple-choice-complex" ? (
          <textarea
            placeholder={"Opsi jawaban, satu baris per opsi\nContoh:\n3\n4\n5\n6"}
            value={optionsText}
            onChange={(event) => setOptionsText(event.target.value)}
            className="w-full rounded-md border px-3 py-2"
            rows={4}
            required
          />
        ) : null}

        <input
          type="text"
          placeholder={
            questionType === "essay"
              ? "Model jawaban otomatis"
              : questionType === "true-false"
                ? "Benar / Salah"
                : "Jawaban benar"
          }
          value={correctAnswer}
          onChange={(event) => setCorrectAnswer(event.target.value)}
          className="w-full rounded-md border px-3 py-2"
          required={questionType !== "matching" && questionType !== "multiple-choice-complex"}
        />

        {questionType === "multiple-choice-complex" ? (
          <textarea
            placeholder={"Jawaban benar, satu baris per item"}
            value={correctAnswersText}
            onChange={(event) => setCorrectAnswersText(event.target.value)}
            className="w-full rounded-md border px-3 py-2"
            rows={3}
            required
          />
        ) : null}

        {questionType === "essay" ? (
          <textarea
            placeholder={"Kata kunci auto-koreksi (opsional), satu baris per kata kunci"}
            value={essayKeywordsText}
            onChange={(event) => setEssayKeywordsText(event.target.value)}
            className="w-full rounded-md border px-3 py-2"
            rows={3}
          />
        ) : null}

        {questionType === "matching" ? (
          <textarea
            placeholder={"Pasangan menjodohkan, format per baris: kiri => kanan"}
            value={matchingPairsText}
            onChange={(event) => setMatchingPairsText(event.target.value)}
            className="w-full rounded-md border px-3 py-2"
            rows={4}
            required
          />
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md border px-4 py-2 disabled:opacity-50"
        >
          {isSubmitting ? "Menyimpan..." : "Simpan Soal"}
        </button>
      </form>

      {message ? <p className="text-sm">{message}</p> : null}

      <section className="rounded-lg border">
        <ul className="divide-y">
          {isLoading ? <li className="p-4 text-sm">Memuat data soal...</li> : null}
          {!isLoading && questions.length === 0 ? (
            <li className="p-4 text-sm">Belum ada soal.</li>
          ) : null}
          {!isLoading
            ? questions.map((question) => (
                <li key={question.id} className="space-y-2 p-4">
                  <p className="text-xs opacity-70">
                    {question.id} • {question.subject ?? "Umum"} • {question.questionType} • max {question.maxScore}
                  </p>
                  <p className="font-medium">{question.prompt}</p>
                  {question.options.length > 0 ? (
                    <ul className="list-disc space-y-1 pl-5 text-sm opacity-80">
                      {question.options.map((option) => (
                        <li key={option}>{option}</li>
                      ))}
                    </ul>
                  ) : null}
                  <pre className="overflow-x-auto rounded-md border p-2 text-xs opacity-80">
                    {JSON.stringify(question.answerKey, null, 2)}
                  </pre>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded-md border px-3 py-1 text-sm"
                      onClick={() => void handleDeleteQuestion(question.id)}
                    >
                      Hapus
                    </button>
                  </div>
                </li>
              ))
            : null}
        </ul>
      </section>
    </main>
  );
}
