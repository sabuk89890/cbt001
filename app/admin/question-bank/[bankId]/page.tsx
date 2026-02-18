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
  correctAnswer?: string;
  options?: string[];
  maxScore: number;
  answerKey: Record<string, unknown>;
};

type CreateMode = "essay" | "multiple-choice" | "multiple-choice-complex" | "true-false" | "matching";

type TrueFalseRow = {
  id: string;
  text: string;
  answer: "Benar" | "Salah";
};

type MatchingRow = {
  id: string;
  left: string;
  right: string;
};

const MAX_IMAGE_SIZE = 100 * 1024;

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
  const [selectedCorrectSingle, setSelectedCorrectSingle] = useState("");

  const [trueFalseRows, setTrueFalseRows] = useState<TrueFalseRow[]>([
    { id: `tf-${Date.now()}-1`, text: "", answer: "Benar" },
  ]);

  const [matchingRows, setMatchingRows] = useState<MatchingRow[]>([
    { id: `m-${Date.now()}-1`, left: "", right: "" },
    { id: `m-${Date.now()}-2`, left: "", right: "" },
  ]);
  const [extraRightOptions, setExtraRightOptions] = useState<string[]>([""]);
  const [editId, setEditId] = useState<string | null>(null);

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
    setQuestionId(
      `${mode === "essay" ? "essay" : mode === "multiple-choice" ? "pg" : mode === "multiple-choice-complex" ? "pgk" : mode === "true-false" ? "tf" : "match"}-${Date.now()}`
    );
    setPrompt("");
    setAnswerKeySlash("");
    setMaxScore("10");
    setImageUrl("");
    setOptionA("");
    setOptionB("");
    setOptionC("");
    setOptionD("");
    setSelectedCorrectOptions([]);
    setSelectedCorrectSingle("");
    setTrueFalseRows([{ id: `tf-${Date.now()}-1`, text: "", answer: "Benar" }]);
    setMatchingRows([
      { id: `m-${Date.now()}-1`, left: "", right: "" },
      { id: `m-${Date.now()}-2`, left: "", right: "" },
    ]);
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

  function addTrueFalseRow() {
    setTrueFalseRows((prev) => [
      ...prev,
      { id: `tf-${Date.now()}-${prev.length + 1}`, text: "", answer: "Benar" },
    ]);
  }

  function removeTrueFalseRow(id: string) {
    setTrueFalseRows((prev) => (prev.length <= 1 ? prev : prev.filter((item) => item.id !== id)));
  }

  function updateTrueFalseRow(id: string, field: "text" | "answer", value: string) {
    setTrueFalseRows((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: field === "answer" ? (value as "Benar" | "Salah") : value,
            }
          : item
      )
    );
  }

  function addMatchingRow() {
    setMatchingRows((prev) => [...prev, { id: `m-${Date.now()}-${prev.length + 1}`, left: "", right: "" }]);
  }

  function removeMatchingRow(id: string) {
    setMatchingRows((prev) => (prev.length <= 2 ? prev : prev.filter((r) => r.id !== id)));
  }

  function updateMatchingRow(id: string, field: "left" | "right", value: string) {
    setMatchingRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function addExtraRightOption() {
    setExtraRightOptions((prev) => [...prev, ""]);
  }

  function updateExtraRightOption(index: number, value: string) {
    setExtraRightOptions((prev) => prev.map((v, i) => (i === index ? value : v)));
  }

  function removeExtraRightOption(index: number) {
    setExtraRightOptions((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  async function refreshQuestions() {
    const listResponse = await fetch("/api/questions", { cache: "no-store" });
    const listResult = (await listResponse.json()) as { data?: BankQuestion[]; error?: string };
    if (listResponse.ok) {
      setQuestions(listResult.data ?? []);
    }
  }
  function populateFormForEdit(item: BankQuestion) {
    console.log("populateFormForEdit", item.id, item.questionType);
    setEditId(item.id);
    setQuestionId(item.id);
    setPrompt(item.prompt ?? "");
    setMaxScore(String(item.maxScore ?? 10));
    setImageUrl(typeof (item.answerKey as any)?.imageUrl === "string" ? (item.answerKey as any).imageUrl : "");

    if (item.questionType === "multiple-choice-complex") {
      const opts = Array.isArray(item.options) ? (item.options as string[]) : [];
      setOptionA(opts[0] ?? "");
      setOptionB(opts[1] ?? "");
      setOptionC(opts[2] ?? "");
      setOptionD(opts[3] ?? "");
      setSelectedCorrectOptions(Array.isArray(item.answerKey?.correctAnswers) ? (item.answerKey.correctAnswers as string[]) : []);
      setCreateMode("multiple-choice-complex");
      return;
    }

    if (item.questionType === "multiple-choice") {
      const opts = Array.isArray(item.options) ? (item.options as string[]) : [];
      setOptionA(opts[0] ?? "");
      setOptionB(opts[1] ?? "");
      setOptionC(opts[2] ?? "");
      setOptionD(opts[3] ?? "");
      const correct = typeof item.answerKey?.correctAnswer === "string" ? (item.answerKey.correctAnswer as string) : typeof item.correctAnswer === "string" ? item.correctAnswer : "";
      setSelectedCorrectSingle(correct);
      setCreateMode("multiple-choice");
      return;
    }

    if (item.questionType === "true-false") {
      const stm = Array.isArray(item.answerKey?.statements) ? (item.answerKey.statements as any[]) : [];
      setTrueFalseRows(
        stm.map((s, i) => ({ id: `tf-edit-${i}`, text: String(s.text ?? ""), answer: s.isTrue ? "Benar" : "Salah" }))
      );
      setCreateMode("true-false");
      return;
    }

    if (item.questionType === "matching") {
      const pairs = Array.isArray(item.answerKey?.pairs) ? (item.answerKey.pairs as any[]) : [];
      setMatchingRows(
        pairs.map((p, i) => ({ id: `m-edit-${i}`, left: String(p.left ?? ""), right: String(p.right ?? "") }))
      );
      const extra = Array.isArray(item.answerKey?.extraRightOptions) ? (item.answerKey.extraRightOptions as string[]) : [];
      setExtraRightOptions(extra.length > 0 ? extra : [""]);
      setCreateMode("matching");
      return;
    }

    // default to essay
    setCreateMode("essay");
    setAnswerKeySlash(typeof item.correctAnswer === "string" ? item.correctAnswer : "");
    // bring form into view when editing
    try {
      const el = document.getElementById("question-form");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {
      /* ignore in SSR */
    }
  }

  async function handleDeleteQuestion(id: string) {
    try {
      const res = await fetch(`/api/questions/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.error ?? "Gagal menghapus soal");
        return;
      }
      setMessage("Soal berhasil dihapus");
      await refreshQuestions();
    } catch (e) {
      setMessage("Terjadi kesalahan saat menghapus soal");
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

    if (createMode === "multiple-choice") {
      const options = [optionA.trim(), optionB.trim(), optionC.trim(), optionD.trim()];
      if (options.some((item) => item.length === 0)) {
        setMessage("Pilihan ganda wajib memiliki 4 opsi terisi");
        return;
      }

      if (!selectedCorrectSingle || !options.includes(selectedCorrectSingle)) {
        setMessage("Pilih jawaban benar untuk soal pilihan ganda");
        return;
      }
    }

    if (createMode === "true-false") {
      const validRows = trueFalseRows.filter((item) => item.text.trim().length > 0);
      if (validRows.length === 0) {
        setMessage("Soal benar/salah minimal memiliki 1 baris pertanyaan");
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
            : createMode === "multiple-choice-complex"
            ? {
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
              }
            : createMode === "multiple-choice"
              ? {
                  id: questionId,
                  bankId,
                  subject: bank?.subject ?? "",
                  prompt,
                  questionType: "multiple-choice",
                  maxScore: Number(maxScore),
                  options: [optionA.trim(), optionB.trim(), optionC.trim(), optionD.trim()],
                  correctAnswer: selectedCorrectSingle,
                  answerKey: {
                    correctAnswer: selectedCorrectSingle,
                    imageUrl,
                  },
                }
            : createMode === "matching"
              ? {
                  id: questionId,
                  bankId,
                  subject: bank?.subject ?? "",
                  prompt,
                  questionType: "matching",
                  maxScore: Number(maxScore),
                  // answerKey.pairs expected by question-engine
                  answerKey: {
                    pairs: matchingRows
                      .filter((r) => r.left.trim().length > 0 && r.right.trim().length > 0)
                      .map((r) => ({ left: r.left.trim(), right: r.right.trim() })),
                    imageUrl,
                    extraRightOptions: extraRightOptions.filter((v) => v.trim().length > 0),
                  },
                }
              : {
                  id: questionId,
                  bankId,
                  subject: bank?.subject ?? "",
                  prompt,
                  questionType: "true-false",
                  maxScore: Number(maxScore),
                  options: trueFalseRows.filter((item) => item.text.trim().length > 0).map((item) => item.text.trim()),
                  answerKey: {
                    statements: trueFalseRows
                      .filter((item) => item.text.trim().length > 0)
                      .map((item) => ({
                        text: item.text.trim(),
                        isTrue: item.answer === "Benar",
                      })),
                    imageUrl,
                  },
                };

      const method = editId ? "PUT" : "POST";
      const url = editId ? `/api/questions/${editId}` : "/api/questions";
      const response = await fetch(url, {
        method,
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
        setMessage(result.error ?? "Gagal membuat soal");
        return;
      }

      if (editId) {
        setMessage("Soal berhasil diperbarui");
      } else {
        setMessage(
          createMode === "essay"
            ? "Soal essay berhasil dibuat"
            : createMode === "multiple-choice-complex"
              ? "Soal pilihan ganda kompleks berhasil dibuat"
              : createMode === "matching"
                ? "Soal menjodohkan berhasil dibuat"
                : "Soal benar/salah berhasil dibuat"
        );
      }
      setEditId(null);
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
              <button
                type="button"
                onClick={() => resetForm("multiple-choice")}
                className={`rounded-lg px-4 py-2 text-sm ${
                  createMode === "multiple-choice" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                Pilihan Ganda
              </button>
              <button
                type="button"
                onClick={() => resetForm("matching")}
                className={`rounded-lg px-4 py-2 text-sm ${
                  createMode === "matching" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                Menjodohkan
              </button>
              <button
                type="button"
                onClick={() => resetForm("true-false")}
                className={`rounded-lg px-4 py-2 text-sm ${
                  createMode === "true-false" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                Benar / Salah
              </button>
            </div>

            <form id="question-form" onSubmit={handleCreateQuestion} className="grid gap-3">
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
                    : createMode === "multiple-choice-complex"
                      ? "Tulis pertanyaan pilihan ganda kompleks"
                      : "Instruksi soal benar/salah"
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
              ) : createMode === "multiple-choice" ? (
                <div className="grid gap-2">
                  <p className="text-sm font-medium text-slate-700">4 Opsi Jawaban (1 benar)</p>
                  <div className="grid gap-2">
                    {[{v:optionA,onChange:setOptionA,placeholder:'Opsi A'},{v:optionB,onChange:setOptionB,placeholder:'Opsi B'},{v:optionC,onChange:setOptionC,placeholder:'Opsi C'},{v:optionD,onChange:setOptionD,placeholder:'Opsi D'}].map((opt,i)=>(
                      <label key={i} className="flex items-center gap-2">
                        <input type="radio" name="single-correct" checked={selectedCorrectSingle===opt.v} onChange={()=>setSelectedCorrectSingle(opt.v)} />
                        <input type="text" placeholder={opt.placeholder} value={opt.v} onChange={(e)=>opt.onChange(e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-3 py-2" required />
                      </label>
                    ))}
                  </div>
                </div>
              ) : createMode === "multiple-choice-complex" ? (
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
              ) : createMode === "matching" ? (
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-700">Daftar Pasangan (kiri → kanan)</p>
                    <button
                      type="button"
                      onClick={addMatchingRow}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                    >
                      Tambah Baris
                    </button>
                  </div>

                    {matchingRows.map((row) => (
                    <div key={row.id} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
                      <input
                        type="text"
                        placeholder="Teks kiri"
                        value={row.left}
                        onChange={(event) => updateMatchingRow(row.id, "left", event.target.value)}
                        className="rounded-lg border border-slate-300 px-3 py-2"
                        required
                      />
                      <input
                        type="text"
                        placeholder="Teks kanan"
                        value={row.right}
                        onChange={(event) => updateMatchingRow(row.id, "right", event.target.value)}
                        className="rounded-lg border border-slate-300 px-3 py-2"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => removeMatchingRow(row.id)}
                        className="rounded-lg border border-red-300 px-3 py-2 text-xs text-red-600"
                      >
                        Hapus
                      </button>
                    </div>
                  ))}
                  <div className="mt-3">
                    <p className="text-sm font-medium text-slate-700">Opsi Kanan Tambahan (boleh lebih banyak satu)</p>
                    <div className="space-y-2 mt-2">
                      {extraRightOptions.map((val, i) => (
                        <div key={i} className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Opsi kanan tambahan"
                            value={val}
                            onChange={(e) => updateExtraRightOption(i, e.target.value)}
                            className="flex-1 rounded-lg border border-slate-300 px-3 py-2"
                          />
                          <button type="button" className="text-red-500" onClick={() => removeExtraRightOption(i)}>
                            ✕
                          </button>
                        </div>
                      ))}
                      <div>
                        <button type="button" onClick={addExtraRightOption} className="rounded-lg px-3 py-1 bg-slate-100 text-sm">
                          Tambah Opsi Kanan
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-700">Daftar Benar / Salah</p>
                    <button
                      type="button"
                      onClick={addTrueFalseRow}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                    >
                      Tambah Baris
                    </button>
                  </div>

                  {trueFalseRows.map((row) => (
                    <div key={row.id} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_180px_auto]">
                      <input
                        type="text"
                        placeholder="Teks pernyataan"
                        value={row.text}
                        onChange={(event) => updateTrueFalseRow(row.id, "text", event.target.value)}
                        className="rounded-lg border border-slate-300 px-3 py-2"
                        required
                      />
                      <select
                        value={row.answer}
                        onChange={(event) => updateTrueFalseRow(row.id, "answer", event.target.value)}
                        className="rounded-lg border border-slate-300 px-3 py-2"
                      >
                        <option value="Benar">Benar</option>
                        <option value="Salah">Salah</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => removeTrueFalseRow(row.id)}
                        className="rounded-lg border border-red-300 px-3 py-2 text-xs text-red-600"
                      >
                        Hapus
                      </button>
                    </div>
                  ))}
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
                <div className="flex items-start gap-3">
                  <img src={imageUrl} alt="Preview gambar soal" className="max-h-56 rounded-lg border object-contain" />
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setImageUrl("")}
                      className="rounded-md border border-red-300 px-3 py-1 text-sm text-red-600"
                    >
                      Hapus Gambar
                    </button>
                  </div>
                </div>
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
                    : createMode === "multiple-choice"
                      ? "Simpan Soal Pilihan Ganda"
                      : createMode === "multiple-choice-complex"
                        ? "Simpan Soal Pilihan Ganda Kompleks"
                        : createMode === "matching"
                          ? "Simpan Soal Menjodohkan"
                          : "Simpan Soal Benar / Salah"}
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
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-slate-500">
                          {index + 1}. {item.id} • {item.questionType} • Bobot {item.maxScore}
                        </p>
                        <p className="text-sm font-medium text-slate-700">{item.prompt}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="rounded-md border px-3 py-1 text-sm"
                          onClick={() => populateFormForEdit(item)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-red-300 px-3 py-1 text-sm text-red-600"
                          onClick={() => handleDeleteQuestion(item.id)}
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
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
