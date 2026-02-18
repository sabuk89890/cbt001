"use client";

import Link from "next/link";
import { useEffect, useState } from "react";



export default function AdminSubjectsPage() {
  const [subjects, setSubjects] = useState<{ id: string; code: string; name: string; created_at: string }[]>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editSubjectId, setEditSubjectId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editName, setEditName] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  async function loadSubjects() {
    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/subjects", { cache: "no-store" });
      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error ?? "Gagal memuat mata pelajaran");
        return;
      }

      setSubjects(result.data ?? []);
    } catch {
      setMessage("Terjadi kesalahan saat memuat mata pelajaran");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadSubjects();
  }, []);

  async function handleCreate() {
    setIsSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/subjects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code, name }),
      });

      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error ?? "Gagal menambah mata pelajaran");
        return;
      }

      setCode("");
      setName("");
      setMessage("Mata pelajaran berhasil ditambahkan");
      await loadSubjects();
    } catch {
      setMessage("Terjadi kesalahan saat menambah mata pelajaran");
    } finally {
      setIsSaving(false);
    }
  }

  /**
   * @param {{ id: string; name?: string }} subject
   */


  async function handleUpdateSubject() {
    if (!editSubjectId) {
      return;
    }

    setIsUpdating(true);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/subjects/${editSubjectId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: editCode, name: editName }),
      });

      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error ?? "Gagal memperbarui mata pelajaran");
        return;
      }

      setMessage(result.message ?? "Mata pelajaran berhasil diperbarui");
      setIsEditModalOpen(false);
      setEditSubjectId(null);
      await loadSubjects();
    } catch {
      setMessage("Terjadi kesalahan saat memperbarui mata pelajaran");
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8 text-slate-800">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Mata Pelajaran</h1>
            <p className="text-sm text-slate-500">Buat dan hapus mata pelajaran</p>
          </div>
          <Link href="/admin" className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">
            Kembali ke Dashboard
          </Link>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Tambah Mata Pelajaran</h2>
          <form onSubmit={(event) => { event.preventDefault(); void handleCreate(); }} className="grid gap-3 md:grid-cols-2">
            <input
              type="text"
              placeholder="Kode (contoh: MTK)"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2"
              required
            />
            <input
              type="text"
              placeholder="Nama Mata Pelajaran"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2"
              required
            />
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {isSaving ? "Menyimpan..." : "Tambah Mata Pelajaran"}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Daftar Mata Pelajaran</h2>
          {message ? <p className="mb-3 text-sm text-slate-600">{message}</p> : null}

          {isLoading ? (
            <p className="text-sm text-slate-500">Memuat data...</p>
          ) : subjects.length === 0 ? (
            <p className="text-sm text-slate-500">Belum ada mata pelajaran</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="px-2 py-2">Kode</th>
                    <th className="px-2 py-2">Nama</th>
                    <th className="px-2 py-2">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((subject) => (
                    <tr key={subject.id} className="border-b border-slate-100">
                      <td className="px-2 py-2">{subject.code}</td>
                      <td className="px-2 py-2">{subject.name}</td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => { setEditSubjectId(subject.id); setEditCode(subject.code); setEditName(subject.name); setIsEditModalOpen(true); }}
                            className="rounded border border-slate-300 px-3 py-1 text-xs"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const confirmed = window.confirm(`Hapus mata pelajaran ${subject.name}?`);
                              if (!confirmed) return;
                              setMessage("");
                              try {
                                const response = await fetch(`/api/admin/subjects/${subject.id}`, { method: "DELETE" });
                                const result = await response.json();
                                if (!response.ok) {
                                  setMessage(result.error ?? "Gagal menghapus mata pelajaran");
                                  return;
                                }
                                setMessage(result.message ?? "Mata pelajaran berhasil dihapus");
                                await loadSubjects();
                              } catch {
                                setMessage("Terjadi kesalahan saat menghapus mata pelajaran");
                              }
                            }}
                            className="rounded bg-red-600 px-3 py-1 text-xs text-white"
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {isEditModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
            <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-semibold">Edit Mata Pelajaran</h3>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="rounded-md border border-slate-300 px-3 py-1 text-sm"
                >
                  Tutup
                </button>
              </div>

              <form onSubmit={(event) => { event.preventDefault(); void handleUpdateSubject(); }} className="grid gap-3">
                <input
                  type="text"
                  placeholder="Kode"
                  value={editCode}
                  onChange={(event) => setEditCode(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  required
                />
                <input
                  type="text"
                  placeholder="Nama Mata Pelajaran"
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  required
                />

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {isUpdating ? "Menyimpan..." : "Simpan Perubahan"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
                  >
                    Batal
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
