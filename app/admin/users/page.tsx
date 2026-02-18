"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

type UserRole = "guru" | "student";

type UserRow = {
  id: string;
  role: UserRole | "admin";
  username: string | null;
  full_name: string | null;
  class_name: string | null;
  photo_url: string | null;
  created_at?: string;
};

type SavePayload = {
  role: UserRole;
  username: string;
  fullName: string;
  className?: string | null;
  password?: string;
  email?: string;
  photoUrl?: string | null;
};

function parseCsv(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    return [] as Array<Record<string, string>>;
  }

  const headers = lines[0].split(",").map((item) => item.trim());

  return lines.slice(1).map((line) => {
    const values = line.split(",").map((item) => item.trim());
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });

    return row;
  });
}

export default function AdminUsersPage() {
  const [activeRole, setActiveRole] = useState<UserRole>("guru");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [className, setClassName] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteClassName, setDeleteClassName] = useState("");
  const [csvFileName, setCsvFileName] = useState("");

  async function loadUsers(role: UserRole) {
    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/users?role=${role}`, { cache: "no-store" });
      const result = (await response.json()) as { data?: UserRow[]; error?: string };

      if (!response.ok) {
        setMessage(result.error ?? "Gagal memuat data pengguna");
        return;
      }

      setUsers(result.data ?? []);
      setSelectedIds([]);
    } catch {
      setMessage("Terjadi kesalahan saat memuat data pengguna");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers(activeRole);
  }, [activeRole]);

  function resetForm() {
    setEditingId(null);
    setUsername("");
    setFullName("");
    setClassName("");
    setPassword("");
    setEmail("");
    setPhotoUrl("");
  }

  function handleEdit(user: UserRow) {
    setEditingId(user.id);
    setUsername(user.username ?? "");
    setFullName(user.full_name ?? "");
    setClassName(user.class_name ?? "");
    setPassword("");
    setEmail("");
    setPhotoUrl(user.photo_url ?? "");
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsSaving(true);

    try {
      const payload: SavePayload = {
        role: activeRole,
        username,
        fullName,
        className: activeRole === "student" ? className : null,
        password: password || undefined,
        email: email || undefined,
        photoUrl: photoUrl || null,
      };

      const response = await fetch(
        editingId ? `/api/admin/users/${editingId}` : "/api/admin/users",
        {
          method: editingId ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const result = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        setMessage(result.error ?? "Gagal menyimpan data pengguna");
        return;
      }

      setMessage(editingId ? "Data berhasil diperbarui" : "Data berhasil ditambahkan");
      resetForm();
      await loadUsers(activeRole);
    } catch {
      setMessage("Terjadi kesalahan saat menyimpan data pengguna");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Yakin ingin menghapus akun ini?")) {
      return;
    }

    setMessage("");

    try {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        setMessage(result.error ?? "Gagal menghapus akun");
        return;
      }

      setMessage(result.message ?? "Akun berhasil dihapus");
      await loadUsers(activeRole);
    } catch {
      setMessage("Terjadi kesalahan saat menghapus akun");
    }
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPhotoUrl(typeof reader.result === "string" ? reader.result : "");
    };
    reader.readAsDataURL(file);
  }

  function toggleSelection(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  async function handleBulkDeleteSelected() {
    if (selectedIds.length === 0) {
      setMessage("Pilih murid yang akan dihapus terlebih dahulu");
      return;
    }

    if (!window.confirm(`Hapus ${selectedIds.length} murid terpilih?`)) {
      return;
    }

    try {
      const response = await fetch("/api/admin/users/bulk-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mode: "ids", ids: selectedIds }),
      });

      const result = (await response.json()) as { deleted?: number; failed?: number; error?: string };
      if (!response.ok) {
        setMessage(result.error ?? "Gagal menghapus data murid terpilih");
        return;
      }

      setMessage(`Hapus massal selesai. Berhasil: ${result.deleted ?? 0}, Gagal: ${result.failed ?? 0}`);
      await loadUsers(activeRole);
    } catch {
      setMessage("Terjadi kesalahan saat hapus massal");
    }
  }

  async function handleDeleteByClass() {
    if (!deleteClassName.trim()) {
      setMessage("Isi nama kelas yang ingin dihapus");
      return;
    }

    if (!window.confirm(`Hapus semua murid di kelas ${deleteClassName}?`)) {
      return;
    }

    try {
      const response = await fetch("/api/admin/users/bulk-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mode: "class", className: deleteClassName.trim() }),
      });

      const result = (await response.json()) as { deleted?: number; failed?: number; error?: string };
      if (!response.ok) {
        setMessage(result.error ?? "Gagal menghapus data murid per kelas");
        return;
      }

      setMessage(`Hapus per kelas selesai. Berhasil: ${result.deleted ?? 0}, Gagal: ${result.failed ?? 0}`);
      await loadUsers(activeRole);
    } catch {
      setMessage("Terjadi kesalahan saat hapus per kelas");
    }
  }

  async function handleImportCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setCsvFileName(file.name);

    try {
      const text = await file.text();
      const rows = parseCsv(text).map((row) => ({
        username: row.username,
        fullName: row.fullName,
        className: row.className,
        password: row.password,
        email: row.email,
        photoUrl: row.photoUrl,
      }));

      const response = await fetch("/api/admin/users/import-students", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rows }),
      });

      const result = (await response.json()) as {
        imported?: number;
        failed?: number;
        error?: string;
      };

      if (!response.ok) {
        setMessage(result.error ?? "Gagal import murid dari CSV");
        return;
      }

      setMessage(`Import CSV selesai. Berhasil: ${result.imported ?? 0}, Gagal: ${result.failed ?? 0}`);
      await loadUsers("student");
      setActiveRole("student");
    } catch {
      setMessage("Terjadi kesalahan saat memproses file CSV");
    }
  }

  const canManageStudentBulk = useMemo(() => activeRole === "student", [activeRole]);

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8 text-slate-800">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Manajemen Pengguna</h1>
            <p className="text-sm text-slate-500">Kelola akun guru dan murid</p>
          </div>
          <Link href="/admin" className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">
            Kembali ke Dashboard
          </Link>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex gap-2">
            <button
              type="button"
              onClick={() => setActiveRole("guru")}
              className={`rounded-lg px-4 py-2 text-sm ${
                activeRole === "guru" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              Guru
            </button>
            <button
              type="button"
              onClick={() => setActiveRole("student")}
              className={`rounded-lg px-4 py-2 text-sm ${
                activeRole === "student" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              Murid
            </button>
          </div>

          <form onSubmit={handleSave} className="grid gap-3 md:grid-cols-2">
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2"
              required
            />
            <input
              type="text"
              placeholder="Nama Lengkap"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2"
              required
            />
            {activeRole === "student" ? (
              <input
                type="text"
                placeholder="Kelas (contoh: IX-A)"
                value={className}
                onChange={(event) => setClassName(event.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2"
                required
              />
            ) : (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                Guru tidak memerlukan kelas
              </div>
            )}
            <input
              type="password"
              placeholder={editingId ? "Password baru (opsional)" : "Password (default 10105158)"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
            <input
              type="email"
              placeholder="Email auth opsional (jika kosong auto @cbt.local)"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
            <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600">
              Upload Foto
              <input type="file" accept="image/*" onChange={handlePhotoChange} className="text-xs" />
            </label>

            <div className="md:col-span-2 flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {isSaving ? "Menyimpan..." : editingId ? "Update" : `Tambah ${activeRole === "guru" ? "Guru" : "Murid"}`}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
              >
                Reset Form
              </button>
            </div>
          </form>

          {photoUrl ? (
            <div className="mt-3">
              <p className="mb-2 text-sm text-slate-500">Preview foto:</p>
              <img src={photoUrl} alt="Preview foto" className="h-16 w-16 rounded-full object-cover" />
            </div>
          ) : null}
        </section>

        {canManageStudentBulk ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Fitur Murid: CSV & Hapus Massal</h2>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm text-slate-600">Entry murid melalui file CSV.</p>
                <a
                  href="/templates/student-import-template.csv"
                  download
                  className="inline-block rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  Download Format CSV
                </a>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleImportCsv}
                  className="block w-full text-sm"
                />
                {csvFileName ? <p className="text-xs text-slate-500">File: {csvFileName}</p> : null}
              </div>

              <div className="space-y-2">
                <p className="text-sm text-slate-600">Hapus massal murid per kelas.</p>
                <input
                  type="text"
                  placeholder="Kelas (contoh: IX-A)"
                  value={deleteClassName}
                  onChange={(event) => setDeleteClassName(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
                <button
                  type="button"
                  onClick={handleDeleteByClass}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white"
                >
                  Hapus Semua Murid Kelas Ini
                </button>
              </div>
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Daftar {activeRole === "guru" ? "Guru" : "Murid"}</h2>
            {canManageStudentBulk ? (
              <button
                type="button"
                onClick={handleBulkDeleteSelected}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white"
              >
                Hapus Massal ({selectedIds.length})
              </button>
            ) : null}
          </div>

          {message ? <p className="mb-3 text-sm text-slate-600">{message}</p> : null}

          {isLoading ? (
            <p className="text-sm text-slate-500">Memuat data...</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-slate-500">Belum ada data</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    {canManageStudentBulk ? <th className="px-2 py-2">Pilih</th> : null}
                    <th className="px-2 py-2">Foto</th>
                    <th className="px-2 py-2">Username</th>
                    <th className="px-2 py-2">Nama</th>
                    <th className="px-2 py-2">Kelas</th>
                    <th className="px-2 py-2">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-slate-100">
                      {canManageStudentBulk ? (
                        <td className="px-2 py-2">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(user.id)}
                            onChange={() => toggleSelection(user.id)}
                          />
                        </td>
                      ) : null}
                      <td className="px-2 py-2">
                        {user.photo_url ? (
                          <img
                            src={user.photo_url}
                            alt={`Foto ${user.full_name ?? user.username ?? "user"}`}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-xs text-slate-400">No foto</span>
                        )}
                      </td>
                      <td className="px-2 py-2">{user.username ?? "-"}</td>
                      <td className="px-2 py-2">{user.full_name ?? "-"}</td>
                      <td className="px-2 py-2">{user.class_name ?? "-"}</td>
                      <td className="px-2 py-2">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(user)}
                            className="rounded border border-slate-300 px-2 py-1 text-xs"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(user.id)}
                            className="rounded bg-red-600 px-2 py-1 text-xs text-white"
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
      </div>
    </main>
  );
}
