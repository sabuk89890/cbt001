"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

type QuestionBank = {
  id: string;
  title: string;
  subject: string | null;
  targetClasses: string[];
  ownerTeacherId: string;
  ownerTeacherName: string;
  questionCount: number;
};

export default function GuruBankSoalPage() {
  const [questionBanks, setQuestionBanks] = useState<QuestionBank[]>([]);
  const [classOptions, setClassOptions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [targetClasses, setTargetClasses] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingBankId, setEditingBankId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editTargetClasses, setEditTargetClasses] = useState<string[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);

  const currentTeacherId = (() => {
    try {
      const raw = localStorage.getItem("auth:user");
      if (raw) {
        const obj = JSON.parse(raw);
        return String(obj?.id ?? "");
      }
    } catch {}
    return "";
  })();

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const r1 = await fetch("/api/admin/question-banks");
        const banksRes = await r1.json();
        setQuestionBanks(banksRes.data ?? []);

        setClassOptions(banksRes.classOptions ?? []);
      } catch {
        setMessage("Gagal memuat bank soal");
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  function getSelectedValues(event: ChangeEvent<HTMLSelectElement>) {
    return Array.from(event.target.selectedOptions).map((option) => option.value);
  }

  function resetCreateForm() {
    setTitle("");
    setSubject("");
    setTargetClasses([]);
  }

  function handleStartEdit(bank: QuestionBank) {
    setEditingBankId(bank.id);
    setEditTitle(bank.title);
    setEditSubject(bank.subject ?? "");
    setEditTargetClasses(bank.targetClasses ?? []);
    setIsEditOpen(true);
  }

  async function handleCreateQuestionBank(event?: FormEvent<HTMLFormElement>) {
    if (event) event.preventDefault();
    setIsSaving(true);
    setMessage("");
    try {
      const ownerTeacherId = currentTeacherId;
      const response = await fetch("/api/admin/question-banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, subject, targetClasses, ownerTeacherId }),
      });

      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error ?? "Gagal membuat bank soal");
        return;
      }

      // reload
      setIsCreateOpen(false);
      resetCreateForm();
      // reload list
      const r = await fetch("/api/admin/question-banks");
      const payload = await r.json();
      setQuestionBanks(payload.data ?? []);
      setMessage("Bank soal dibuat");
    } catch {
      setMessage("Terjadi kesalahan saat membuat bank soal");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdateQuestionBank(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingBankId) return;
    setIsUpdating(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/question-banks/${editingBankId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, subject: editSubject, targetClasses: editTargetClasses, ownerTeacherId: currentTeacherId }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error ?? "Gagal memperbarui bank soal");
        return;
      }

      setIsEditOpen(false);
      setEditingBankId(null);
      const r = await fetch("/api/admin/question-banks");
      const payload = await r.json();
      setQuestionBanks(payload.data ?? []);
      setMessage(result.message ?? "Bank soal berhasil diperbarui");
    } catch {
      setMessage("Terjadi kesalahan saat memperbarui bank soal");
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleDeleteQuestionBank(bank: QuestionBank) {
    if (bank.ownerTeacherId !== currentTeacherId) {
      alert("Anda tidak memiliki izin untuk menghapus bank soal ini.");
      return;
    }
    const confirmed = window.confirm(`Hapus bank soal ${bank.title}?`);
    if (!confirmed) return;
    setMessage("");
    try {
      const response = await fetch(`/api/admin/question-banks/${bank.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error ?? "Gagal menghapus bank soal");
        return;
      }
      const r = await fetch("/api/admin/question-banks");
      const payload = await r.json();
      setQuestionBanks(payload.data ?? []);
      setMessage(result.message ?? "Bank soal berhasil dihapus");
    } catch {
      setMessage("Terjadi kesalahan saat menghapus bank soal");
    }
  }

  const ownedBanks = useMemo(() => questionBanks.filter((b) => b.ownerTeacherId === currentTeacherId), [questionBanks, currentTeacherId]);

  return (
    <main className="min-h-screen px-6 py-8 text-slate-800">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold">Bank Soal</h1>
            <p className="text-sm text-slate-500">Kelola bank soal milik Anda</p>
          </div>
          <button
            type="button"
            onClick={() => {
              resetCreateForm();
              setIsCreateOpen(true);
            }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
          >
            Buat Bank Soal
          </button>
        </header>

        {message ? <p className="text-sm text-slate-600">{message}</p> : null}

        {isLoading ? <p className="text-sm text-slate-500">Memuat bank soal...</p> : null}
        {!isLoading && ownedBanks.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">Belum ada bank soal milik Anda.</p>
        ) : null}

        {!isLoading && ownedBanks.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {ownedBanks.map((bank) => (
              <article key={bank.id} className="rounded-3xl border-l-4 border-l-violet-500 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xl font-semibold text-slate-800">{bank.title}</p>
                    <p className="mt-1 text-sm text-slate-500">Guru: {bank.ownerTeacherName}</p>
                    <p className="text-sm text-slate-500">Mapel: {bank.subject ?? "Umum"}</p>
                    <p className="text-sm text-slate-500">Kelas: {bank.targetClasses.length > 0 ? bank.targetClasses.join(", ") : "-"}</p>
                  </div>
                  <div className="rounded-2xl bg-violet-100 p-3 text-violet-600">📝</div>
                </div>

                <div className="mt-5">
                  <p className="text-sm text-slate-500">Soal Dibuat</p>
                  <p className="text-5xl font-semibold text-slate-700">{bank.questionCount}</p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {/* Link to question editor (admin route reused). Only teachers who own the bank can create/edit/hapus. */}
                  <Link href={`/admin/question-bank/${bank.id}`} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white">Buat Soal</Link>
                  {bank.ownerTeacherId === currentTeacherId ? (
                    <>
                      <button type="button" onClick={() => handleStartEdit(bank)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs">Edit</button>
                      <button type="button" onClick={() => void handleDeleteQuestionBank(bank)} className="rounded-lg bg-red-600 px-3 py-2 text-xs text-white">Hapus</button>
                    </>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {isCreateOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
            <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-semibold">Buat Bank Soal</h3>
                <button type="button" onClick={() => setIsCreateOpen(false)} className="rounded-md border border-slate-300 px-3 py-1 text-sm">Tutup</button>
              </div>

              <form onSubmit={handleCreateQuestionBank} className="grid gap-3">
                <input type="text" placeholder="Nama Bank Soal" value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2" required />
                <input type="text" placeholder="Mata Pelajaran" value={subject} onChange={(e) => setSubject(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2" />

                <div className="grid gap-1">
                  <label className="text-sm text-slate-600">Pilih Kelas (bisa lebih dari satu)</label>
                  <select multiple value={targetClasses} onChange={(event) => setTargetClasses(getSelectedValues(event))} className="h-32 rounded-lg border border-slate-300 px-3 py-2" required>
                    {classOptions.map((className) => (
                      <option key={className} value={className}>{className}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500">Tekan Ctrl (Windows) untuk pilih beberapa kelas.</p>
                </div>

                <p className="text-xs text-slate-500">Pemilik bank soal akan diisi otomatis sebagai akun guru yang sedang login.</p>

                <button type="submit" disabled={isSaving || classOptions.length === 0} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{isSaving ? "Menyimpan..." : "Simpan Bank Soal"}</button>
              </form>
            </div>
          </div>
        ) : null}

        {isEditOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
            <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-semibold">Edit Bank Soal</h3>
                <button type="button" onClick={() => setIsEditOpen(false)} className="rounded-md border border-slate-300 px-3 py-1 text-sm">Tutup</button>
              </div>

              <form onSubmit={handleUpdateQuestionBank} className="grid gap-3">
                <input type="text" placeholder="Nama Bank Soal" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2" required />
                <input type="text" placeholder="Mata Pelajaran" value={editSubject} onChange={(e) => setEditSubject(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2" />

                <div className="grid gap-1">
                  <label className="text-sm text-slate-600">Pilih Kelas (bisa lebih dari satu)</label>
                  <select multiple value={editTargetClasses} onChange={(event) => setEditTargetClasses(getSelectedValues(event))} className="h-32 rounded-lg border border-slate-300 px-3 py-2" required>
                    {classOptions.map((className) => (
                      <option key={className} value={className}>{className}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500">Tekan Ctrl (Windows) untuk pilih beberapa kelas.</p>
                </div>

                <p className="text-xs text-slate-500">Pemilik bank soal tidak dapat diubah dari halaman guru.</p>

                <button type="submit" disabled={isUpdating || classOptions.length === 0} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{isUpdating ? "Menyimpan..." : "Simpan Perubahan"}</button>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
