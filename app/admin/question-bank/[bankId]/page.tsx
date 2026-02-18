"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

type PageProps = {
  params: Promise<{ bankId: string }>;
};

type QuestionBankDetail = {
  id: string;
  title: string;
  subject: string | null;
  owner_teacher_id: string;
  target_classes?: string[];
};

type EssayQuestion = {
  id: string;
  bankId?: string | null;
  subject: string | null;
  prompt: string;
  questionType: string;
  correctAnswer: string;
  maxScore: number;
  answerKey: Record<string, unknown>;
};

const MAX_IMAGE_SIZE = 100 * 1024;

export default function QuestionBankDetailPage({ params }: PageProps) {
  const [bankId, setBankId] = useState("");
  const [bank, setBank] = useState<QuestionBankDetail | null>(null);
  const [questions, setQuestions] = useState<EssayQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [questionId, setQuestionId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [answerKeySlash, setAnswerKeySlash] = useState("");
  const [maxScore, setMaxScore] = useState("10");
  const [imageUrl, setImageUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const essayQuestions = useMemo(
    () => questions.filter((item) => item.questionType === "essay" && item.bankId === bankId),
    [bankId, questions]
  );

  useEffect(() => {
    async function init() {
      const resolved = await params;
      setBankId(resolved.bankId);
      setQuestionId(`essay-${Date.now()}`);

      try {
        const [bankResponse, questionsResponse] = await Promise.all([
          fetch(`/api/admin/question-banks/${resolved.bankId}`, { cache: "no-store" }),
          fetch("/api/questions", { cache: "no-store" }),
        ]);

        const bankResult = (await bankResponse.json()) as {
          data?: QuestionBankDetail;
          error?: string;
        };

        if (!bankResponse.ok) {
          setMessage(bankResult.error ?? "Gagal memuat detail bank soal");
          return;
        }

        setBank(bankResult.data ?? null);

        const questionResult = (await questionsResponse.json()) as {
          data?: EssayQuestion[];
          error?: string;
        };

        if (!questionsResponse.ok) {
          setMessage(questionResult.error ?? "Gagal memuat daftar soal");
          return;
        }

        setQuestions(questionResult.data ?? []);
      } catch {
        setMessage("Terjadi kesalahan saat memuat data");
      } finally {
        setIsLoading(false);
      }
    }

    void init();
  }, [params]);

  function resetForm() {
    setQuestionId(`essay-${Date.now()}`);
    setPrompt("");
    setAnswerKeySlash("");
    setMaxScore("10");
    setImageUrl("");
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setMessage("Ukuran gambar melebihi 100KB. Silakan pilih file yang lebih kecil.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImageUrl(typeof reader.result === "string" ? reader.result : "");
      setMessage("");
    };
    reader.readAsDataURL(file);
  }

  async function handleCreateEssayQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!bankId) {
      setMessage("Bank soal tidak valid");
      return;
    }

    setIsSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: questionId,
          bankId,
          subject: bank?.subject ?? "",
          prompt,
          questionType: "essay",
          correctAnswer: answerKeySlash,
          maxScore: Number(maxScore),
          answerKey: {
            imageUrl,
          },
        }),
      });

      const result = (await response.json()) as {
        data?: EssayQuestion;
        error?: string;
      };

      if (!response.ok) {
        setMessage(result.error ?? "Gagal membuat soal essay");
        return;
      }

      setMessage("Soal essay berhasil dibuat");
      resetForm();

      const listResponse = await fetch("/api/questions", { cache: "no-store" });
      const listResult = (await listResponse.json()) as { data?: EssayQuestion[]; error?: string };
      if (listResponse.ok) {
        setQuestions(listResult.data ?? []);
      }
    } catch {
      setMessage("Terjadi kesalahan saat membuat soal essay");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="min-h-screen px-6 py-8 text-slate-800">
      <div className="mx-auto w-full max-w-5xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Buat Soal Essay</h1>
            <p className="text-sm text-slate-500">Bank Soal: {bank?.title ?? bankId}</p>
          </div>
          <Link href="/admin/question-bank" className="rounded-lg border border-slate-300 px-4 py-2 text-sm">
            Kembali ke Bank Soal
          </Link>
        </header>

        {message ? <p className="text-sm text-slate-600">{message}</p> : null}

        {isLoading ? <p className="text-sm text-slate-500">Memuat data...</p> : null}

        {!isLoading ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold">Form Soal Essay</h2>
            <form onSubmit={handleCreateEssayQuestion} className="grid gap-3">
              <input
                type="text"
                placeholder="ID Soal"
                value={questionId}
                onChange={(event) => setQuestionId(event.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2"
                required
              />

              <textarea
                placeholder="Tulis pertanyaan essay"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                rows={4}
                className="rounded-lg border border-slate-300 px-3 py-2"
                required
              />

              <input
                type="text"
                placeholder="Kunci jawaban dipisah '/' contoh: ayam/sapi/kuda"
                value={answerKeySlash}
                onChange={(event) => setAnswerKeySlash(event.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2"
                required
              />

              <input
                type="number"
                min={1}
                placeholder="Bobot penilaian"
                value={maxScore}
                onChange={(event) => setMaxScore(event.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2"
                required
              />

              <label className="grid gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600">
                Upload Gambar Soal (maksimal 100KB)
                <input type="file" accept="image/*" onChange={handleImageChange} className="text-xs" />
              </label>

              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt="Preview gambar soal"
                  className="max-h-56 rounded-lg border object-contain"
                />
              ) : null}

              <button
                type="submit"
                disabled={isSaving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {isSaving ? "Menyimpan..." : "Simpan Soal Essay"}
              </button>
            </form>
          </section>
        ) : null}

        {!isLoading ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold">Daftar Soal Essay di Bank Ini</h2>
            {essayQuestions.length === 0 ? (
              <p className="text-sm text-slate-500">Belum ada soal essay</p>
            ) : (
              <ul className="space-y-3">
                {essayQuestions.map((item, index) => (
                  <li key={item.id} className="rounded-xl border border-slate-200 p-3">
                    <p className="text-xs text-slate-500">
                      {index + 1}. {item.id} • Bobot {item.maxScore}
                    </p>
                    <p className="text-sm font-medium text-slate-700">{item.prompt}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </div>
    </main>
  );
}
