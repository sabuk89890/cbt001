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

type BankQuestion = {
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

type CreateMode = "essay" | "multiple-choice-complex";

export default function QuestionBankDetailPage({ params }: PageProps) {
  const [bankId, setBankId] = useState("");
  const [bank, setBank] = useState<QuestionBankDetail | null>(null);
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [createMode, setCreateMode] = useState<CreateMode>("essay");
  const [questionId, setQuestionId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [answerKeySlash, setAnswerKeySlash] = useState("");
  const [maxScore, setMaxScore] = useState("10");
  const [imageUrl, setImageUrl] = useState("");

  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [optionC, setOptionC] = useState("");
  const [optionD, setOptionD] = useState("");
  const [selectedCorrectOptions, setSelectedCorrectOptions] = useState<string[]>([]);

  const [isSaving, setIsSaving] = useState(false);

  const bankQuestions = useMemo(
    () => questions.filter((item) => item.bankId === bankId),
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
          data?: BankQuestion[];
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

  function resetForm(mode: CreateMode) {
    setCreateMode(mode);
    setQuestionId(`${mode === "essay" ? "essay" : "pgk"}-${Date.now()}`);
    setPrompt("");
    setAnswerKeySlash("");
    setMaxScore("10");
    setImageUrl("");
    setOptionA("");
    setOptionB("");
    setOptionC("");
    setOptionD("");
    setSelectedCorrectOptions([]);
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

  function toggleCorrectOption(option: string) {
    setSelectedCorrectOptions((prev) =>
      prev.includes(option) ? prev.filter((item) => item !== option) : [...prev, option]
    );
  }

  async function refreshQuestions() {
    const listResponse = await fetch("/api/questions", { cache: "no-store" });
    const listResult = (await listResponse.json()) as { data?: BankQuestion[]; error?: string };
    if (listResponse.ok) {
      setQuestions(listResult.data ?? []);
    }
  }

  async function handleCreateQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!bankId) {
      setMessage("Bank soal tidak valid");
      return;
    }

    if (createMode === "multiple-choice-complex") {
      const options = [optionA.trim(), optionB.trim(), optionC.trim(), optionD.trim()];
      if (options.some((item) => item.length === 0)) {
        setMessage("Pilihan ganda kompleks wajib memiliki 4 opsi terisi");
        return;
      }

      if (selectedCorrectOptions.length < 2) {
        setMessage("Kunci jawaban benar minimal 2");
        return;
      }
    }

    setIsSaving(true);
    setMessage("");

    try {
      const payload =
        createMode === "essay"
          ? {
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
            }
          : {
              id: questionId,
              bankId,
              subject: bank?.subject ?? "",
              prompt,
              questionType: "multiple-choice-complex",
              maxScore: Number(maxScore),
              options: [optionA.trim(), optionB.trim(), optionC.trim(), optionD.trim()],
              answerKey: {
                correctAnswers: selectedCorrectOptions,
                imageUrl,
              },
            };

      const response = await fetch("/api/questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as {
        data?: BankQuestion;
        error?: string;
      };

      if (!response.ok) {
        setMessage(result.error ?? `Gagal membuat soal ${createMode === "essay" ? "essay" : "PG kompleks"}`);
        return;
      }

      setMessage(
        createMode === "essay"
          ? "Soal essay berhasil dibuat"
          : "Soal pilihan ganda kompleks berhasil dibuat"
      );
      resetForm(createMode);
      await refreshQuestions();
    } catch {
      setMessage("Terjadi kesalahan saat membuat soal");
    } finally {
      setIsSaving(false);
    }
  }

  const complexOptions = [optionA.trim(), optionB.trim(), optionC.trim(), optionD.trim()].filter(
    (item) => item.length > 0
  );

  return (
    <main className="min-h-screen px-6 py-8 text-slate-800">
      <div className="mx-auto w-full max-w-5xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Buat Soal per Bank</h1>
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
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => resetForm("essay")}
                className={`rounded-lg px-4 py-2 text-sm ${
                  createMode === "essay" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                Soal Essay
              </button>
              <button
                type="button"
                onClick={() => resetForm("multiple-choice-complex")}
                className={`rounded-lg px-4 py-2 text-sm ${
                  createMode === "multiple-choice-complex"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                Pilihan Ganda Kompleks
              </button>
            </div>

            <form onSubmit={handleCreateQuestion} className="grid gap-3">
              <input
                type="text"
                placeholder="ID Soal"
                value={questionId}
                onChange={(event) => setQuestionId(event.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2"
                required
              />

              <textarea
                placeholder={
                  createMode === "essay"
                    ? "Tulis pertanyaan essay"
                    : "Tulis pertanyaan pilihan ganda kompleks"
                }
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                rows={4}
                className="rounded-lg border border-slate-300 px-3 py-2"
                required
              />

              {createMode === "essay" ? (
                <input
                  type="text"
                  placeholder="Kunci jawaban dipisah '/' contoh: ayam/sapi/kuda"
                  value={answerKeySlash}
                  onChange={(event) => setAnswerKeySlash(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  required
                />
              ) : (
                <div className="grid gap-2">
                  <p className="text-sm font-medium text-slate-700">4 Opsi Jawaban (wajib 4)</p>
                  <input
                    type="text"
                    placeholder="Opsi A"
                    value={optionA}
                    onChange={(event) => setOptionA(event.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-2"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Opsi B"
                    value={optionB}
                    onChange={(event) => setOptionB(event.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-2"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Opsi C"
                    value={optionC}
                    onChange={(event) => setOptionC(event.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-2"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Opsi D"
                    value={optionD}
                    onChange={(event) => setOptionD(event.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-2"
                    required
                  />

                  <div className="mt-1 grid gap-1">
                    <p className="text-sm font-medium text-slate-700">Kunci Jawaban Benar (minimal 2)</p>
                    {complexOptions.map((option) => (
                      <label key={option} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedCorrectOptions.includes(option)}
                          onChange={() => toggleCorrectOption(option)}
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                </div>
              )}

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
                {isSaving
                  ? "Menyimpan..."
                  : createMode === "essay"
                    ? "Simpan Soal Essay"
                    : "Simpan Soal Pilihan Ganda Kompleks"}
              </button>
            </form>
          </section>
        ) : null}

        {!isLoading ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold">Daftar Soal di Bank Ini</h2>
            {bankQuestions.length === 0 ? (
              <p className="text-sm text-slate-500">Belum ada soal</p>
            ) : (
              <ul className="space-y-3">
                {bankQuestions.map((item, index) => (
                  <li key={item.id} className="rounded-xl border border-slate-200 p-3">
                    <p className="text-xs text-slate-500">
                      {index + 1}. {item.id} • {item.questionType} • Bobot {item.maxScore}
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
