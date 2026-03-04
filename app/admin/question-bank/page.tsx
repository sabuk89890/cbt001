"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

type TeacherOption = {
  id: string;
  full_name: string | null;
  username: string | null;
};

type QuestionBank = {
  id: string;
  title: string;
  subject: string | null;
  targetClasses: string[];
  ownerTeacherId: string;
  ownerTeacherName: string;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
};

function teacherLabel(teacher: TeacherOption) {
  return teacher.full_name ?? teacher.username ?? "Guru";
}

export default function QuestionBankPage() {
  const [questionBanks, setQuestionBanks] = useState<QuestionBank[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [classOptions, setClassOptions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [targetClasses, setTargetClasses] = useState<string[]>([]);
  const [ownerTeacherId, setOwnerTeacherId] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingBankId, setEditingBankId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editTargetClasses, setEditTargetClasses] = useState<string[]>([]);
  const [editOwnerTeacherId, setEditOwnerTeacherId] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const teacherMap = useMemo(
    () => new Map(teachers.map((teacher) => [teacher.id, teacherLabel(teacher)])),
    [teachers]
  );

  async function loadQuestionBanks(options?: { preserveMessage?: boolean }) {
    setIsLoading(true);
    if (!options?.preserveMessage) {
      setMessage("");
    }

    try {
      const response = await fetch("/api/admin/question-banks", { cache: "no-store" });
      const result = (await response.json()) as {
        data?: QuestionBank[];
        classOptions?: string[];
        error?: string;
      };

      if (!response.ok) {
        setMessage(result.error ?? "Gagal memuat bank soal");
        return;
      }

      setQuestionBanks(result.data ?? []);
      setClassOptions(result.classOptions ?? []);
    } catch {
      setMessage("Terjadi kesalahan saat memuat bank soal");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadTeachers() {
    try {
      const response = await fetch("/api/admin/users?role=guru", { cache: "no-store" });
      const result = (await response.json()) as { data?: TeacherOption[]; error?: string };

      if (!response.ok) {
        setMessage(result.error ?? "Gagal memuat daftar guru");
        return;
      }

      const teacherData = result.data ?? [];
      setTeachers(teacherData);

      if (teacherData.length > 0) {
        setOwnerTeacherId((current) => current || teacherData[0].id);
      }
    } catch {
      setMessage("Terjadi kesalahan saat memuat daftar guru");
    }
  }

  useEffect(() => {
    void loadQuestionBanks();
    void loadTeachers();
  }, []);

  const [backupStatus, setBackupStatus] = useState<string | null>(null);

  const handleBackupAll = async () => {
    setBackupStatus('starting');
    try {
      const res = await fetch('/api/questions');
      const json = await res.json();
      const data = json.data ?? [];
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-soal-all-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setBackupStatus('done');
    } catch (_e) {
      alert('Gagal membuat backup');
      setBackupStatus('error');
    }
  };

  // when backing up a specific bank we now include the bank metadata as
  // well as the list of questions. this allows the restore endpoint to
  // recreate the bank automatically, which makes it possible to delete a
  // bank and then restore it from the exported file without running into a
  // foreign‑key error.
  const handleBackupBank = async (bank: QuestionBank) => {
    setBackupStatus(`starting-${bank.id}`);
    try {
      const res = await fetch('/api/questions');
      const json = await res.json();
      // json.data is typed as unknown by the fetch result; narrow to any[]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const questions = ((json.data as any[]) ?? []).filter((q) => (q as any).bankId === bank.id);

      const payload = {
        bank: {
          id: bank.id,
          title: bank.title,
          subject: bank.subject,
          // the api expects the `targetClasses` key, not the snake_case
          // column name.
          targetClasses: bank.targetClasses,
          ownerTeacherId: bank.ownerTeacherId,
        },
        questions,
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-soal-${bank.title.replace(/\s+/g,'_')}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setBackupStatus(`done-${bank.id}`);
    } catch (_e) {
      alert(`Gagal membuat backup untuk bank soal ${bank.title}`);
      setBackupStatus(`error-${bank.id}`);
    }
  };

  const handleRestoreAll = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      // a parse result can be anything, so start with unknown
      let payload: unknown;
      try {
        payload = JSON.parse(text);
      } catch (_parseErr) {
        // we don't care about the error itself
        throw new Error('File bukan JSON yang valid');
      }

      // payload may be a plain array (legacy) or an object containing
      // { bank?, questions? }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = payload as any; // narrow for the checks below
      if (
        !Array.isArray(p) &&
        !(p && typeof p === 'object' && Array.isArray(p.questions))
      ) {
        throw new Error('Data JSON bukan array soal atau objek restore');
      }

      const res = await fetch('/api/admin/questions/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let msg = '';
        if (res.status === 405) {
          msg = 'metode tidak diizinkan pada server – pastikan endpoint restore telah deploy';
        } else {
          msg = await res.text();
        }
        console.error('restore failed status', res.status, msg);
        throw new Error(msg || `Server error ${res.status}`);
      }

      const j = await res.json();
      alert('Soal berhasil direstore: ' + (j.data?.inserted ?? 0) + ' item');
      await loadQuestionBanks();
    } catch (err) {
      console.error('restore error', err);
      alert('Gagal restore: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleBackup = async () => {
    try {
      const res = await fetch('/api/questions');
      const json = await res.json();
      const data = json.data ?? [];
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-soal-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Gagal membuat backup');
    }
  };


  function resetCreateForm() {
    setTitle("");
    setSubject("");
    setTargetClasses([]);
    setOwnerTeacherId(teachers[0]?.id ?? "");
  }

  function getSelectedValues(event: ChangeEvent<HTMLSelectElement>) {
    return Array.from(event.target.selectedOptions).map((option) => option.value);
  }

  function handleStartEdit(bank: QuestionBank) {
    setEditingBankId(bank.id);
    setEditTitle(bank.title);
    setEditSubject(bank.subject ?? "");
    setEditTargetClasses(bank.targetClasses ?? []);
    setEditOwnerTeacherId(bank.ownerTeacherId);
    setIsEditOpen(true);
  }

  async function handleCreateQuestionBank(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/question-banks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          subject,
          targetClasses,
          ownerTeacherId,
        }),
      });

      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(result.error ?? "Gagal membuat bank soal");
        return;
      }

      setMessage("Bank soal berhasil dibuat");
      setIsCreateOpen(false);
      resetCreateForm();
      await loadQuestionBanks({ preserveMessage: true });
    } catch {
      setMessage("Terjadi kesalahan saat membuat bank soal");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdateQuestionBank(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingBankId) {
      return;
    }

    setIsUpdating(true);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/question-banks/${editingBankId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: editTitle,
          subject: editSubject,
          targetClasses: editTargetClasses,
          ownerTeacherId: editOwnerTeacherId,
        }),
      });

      const result = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        setMessage(result.error ?? "Gagal memperbarui bank soal");
        return;
      }

      setMessage(result.message ?? "Bank soal berhasil diperbarui");
      setIsEditOpen(false);
      setEditingBankId(null);
      await loadQuestionBanks({ preserveMessage: true });
    } catch {
      setMessage("Terjadi kesalahan saat memperbarui bank soal");
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleDeleteQuestionBank(bank: QuestionBank) {
    const confirmed = window.confirm(`Hapus bank soal ${bank.title}?`);
    if (!confirmed) {
      return;
    }

    setMessage("");

    try {
      const response = await fetch(`/api/admin/question-banks/${bank.id}`, {
        method: "DELETE",
      });

      const result = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        setMessage(result.error ?? "Gagal menghapus bank soal");
        return;
      }

      setMessage(result.message ?? "Bank soal berhasil dihapus");
      await loadQuestionBanks({ preserveMessage: true });
    } catch {
      setMessage("Terjadi kesalahan saat menghapus bank soal");
    }
  }

  return (
    <main className="min-h-screen px-6 py-8 text-slate-800">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold">Manajemen Soal</h1>
            <p className="text-sm text-slate-500">Kelola bank soal dan pemilik guru</p>
            <p className="mt-1 text-xs text-slate-400">
              File backup bank soal sekarang menyertakan metadata bank. Anda bisa
              menghapus bank kemudian me-restore file yang sama untuk membuat
              kembali bank dan soalnya secara otomatis.
            </p>
          </div>
          <div className="flex gap-2">
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
            <button
              type="button"
              onClick={handleBackupAll}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white"
            >
              Backup Soal
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white"
            >
              Restore Soal
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={handleRestoreAll}
            />
          </div>
        </header>

        {message ? <p className="text-sm text-slate-600">{message}</p> : null}

        {isLoading ? <p className="text-sm text-slate-500">Memuat bank soal...</p> : null}
        {!isLoading && questionBanks.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
            Belum ada bank soal.
          </p>
        ) : null}

        {!isLoading && questionBanks.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {questionBanks.map((bank) => (
              <article
                key={bank.id}
                className="rounded-3xl border-l-4 border-l-violet-500 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xl font-semibold text-slate-800">{bank.title}</p>
                    <p className="mt-1 text-sm text-slate-500">Guru: {bank.ownerTeacherName}</p>
                    <p className="text-sm text-slate-500">Mapel: {bank.subject ?? "Umum"}</p>
                    <p className="text-sm text-slate-500">
                      Kelas: {bank.targetClasses.length > 0 ? bank.targetClasses.join(", ") : "-"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-violet-100 p-3 text-violet-600">📝</div>
                </div>

                <div className="mt-5">
                  <p className="text-sm text-slate-500">Soal Dibuat</p>
                  <p className="text-5xl font-semibold text-slate-700">{bank.questionCount}</p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 items-center">
                  <button
                    type="button"
                    onClick={() => handleBackupBank(bank)}
                    className="rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white"
                  >
                    Backup
                  </button>
                  {backupStatus === `starting-${bank.id}` && (
                    <span className="text-xs text-blue-600">Downloading…</span>
                  )}
                  {backupStatus === `done-${bank.id}` && (
                    <span className="text-xs text-green-600">Selesai</span>
                  )}
                  {backupStatus === `error-${bank.id}` && (
                    <span className="text-xs text-red-600">Gagal</span>
                  )}
                  <Link
                    href={`/admin/question-bank/${bank.id}`}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white"
                  >
                    Buat Soal
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleStartEdit(bank)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteQuestionBank(bank)}
                    className="rounded-lg bg-red-600 px-3 py-2 text-xs text-white"
                  >
                    Hapus
                  </button>
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
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-md border border-slate-300 px-3 py-1 text-sm"
                >
                  Tutup
                </button>
              </div>

              <form onSubmit={handleCreateQuestionBank} className="grid gap-3">
                <input
                  type="text"
                  placeholder="Nama Bank Soal"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  required
                />
                <input
                  type="text"
                  placeholder="Mata Pelajaran"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                />
                <select
                  value={ownerTeacherId}
                  onChange={(event) => setOwnerTeacherId(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  required
                >
                  {teachers.length === 0 ? <option value="">Belum ada guru</option> : null}
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacherLabel(teacher)}
                    </option>
                  ))}
                </select>

                <div className="grid gap-1">
                  <label className="text-sm text-slate-600">Pilih Kelas (bisa lebih dari satu)</label>
                  <select
                    multiple
                    value={targetClasses}
                    onChange={(event) => setTargetClasses(getSelectedValues(event))}
                    className="h-32 rounded-lg border border-slate-300 px-3 py-2"
                    required
                  >
                    {classOptions.map((className) => (
                      <option key={className} value={className}>
                        {className}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500">Tekan Ctrl (Windows) untuk pilih beberapa kelas.</p>
                </div>

                <button
                  type="submit"
                  disabled={isSaving || teachers.length === 0 || classOptions.length === 0}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {isSaving ? "Menyimpan..." : "Simpan Bank Soal"}
                </button>
              </form>
            </div>
          </div>
        ) : null}

        {isEditOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
            <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-semibold">Edit Bank Soal</h3>
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="rounded-md border border-slate-300 px-3 py-1 text-sm"
                >
                  Tutup
                </button>
              </div>

              <form onSubmit={handleUpdateQuestionBank} className="grid gap-3">
                <input
                  type="text"
                  placeholder="Nama Bank Soal"
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  required
                />
                <input
                  type="text"
                  placeholder="Mata Pelajaran"
                  value={editSubject}
                  onChange={(event) => setEditSubject(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                />
                <select
                  value={editOwnerTeacherId}
                  onChange={(event) => setEditOwnerTeacherId(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  required
                >
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacherMap.get(teacher.id) ?? "Guru"}
                    </option>
                  ))}
                </select>

                <div className="grid gap-1">
                  <label className="text-sm text-slate-600">Pilih Kelas (bisa lebih dari satu)</label>
                  <select
                    multiple
                    value={editTargetClasses}
                    onChange={(event) => setEditTargetClasses(getSelectedValues(event))}
                    className="h-32 rounded-lg border border-slate-300 px-3 py-2"
                    required
                  >
                    {classOptions.map((className) => (
                      <option key={className} value={className}>
                        {className}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500">Tekan Ctrl (Windows) untuk pilih beberapa kelas.</p>
                </div>

                <button
                  type="submit"
                  disabled={isUpdating || classOptions.length === 0}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {isUpdating ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
