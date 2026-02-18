"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

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
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedClassView, setSelectedClassView] = useState("");

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<UserRole>("guru");
  const [editUsername, setEditUsername] = useState("");
  const [editFullName, setEditFullName] = useState("");
  const [editClassName, setEditClassName] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhotoUrl, setEditPhotoUrl] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

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

  const classOptions = useMemo(() => {
    if (activeRole !== "student") {
      return [] as string[];
    }

    return [...new Set(users.map((user) => user.class_name).filter((value): value is string => Boolean(value)))].sort(
      (a, b) => a.localeCompare(b)
    );
  }, [activeRole, users]);

  const studentsInSelectedClass = useMemo(
    () => users.filter((user) => activeRole === "student" && user.class_name === selectedClassView),
    [activeRole, selectedClassView, users]
  );

  useEffect(() => {
    if (activeRole !== "student") {
      setSelectedClassView("");
      return;
    }

    if (classOptions.length === 0) {
      setSelectedClassView("");
      return;
    }

    if (!classOptions.includes(selectedClassView)) {
      setSelectedClassView(classOptions[0]);
    }
  }, [activeRole, classOptions, selectedClassView]);

  function resetForm() {
    setUsername("");
    setFullName("");
    setClassName("");
    setPassword("");
    setEmail("");
    setPhotoUrl("");
  }

  function handleEdit(user: UserRow) {
    if (user.role !== "guru" && user.role !== "student") {
      setMessage("Akun admin tidak bisa diedit dari menu ini");
      return;
    }

    setEditUserId(user.id);
    setEditRole(user.role);
    setEditUsername(user.username ?? "");
    setEditFullName(user.full_name ?? "");
    setEditClassName(user.class_name ?? "");
    setEditPassword("");
    setEditEmail("");
    setEditPhotoUrl(user.photo_url ?? "");
    setIsEditModalOpen(true);
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

      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        setMessage(result.error ?? "Gagal menyimpan data pengguna");
        return;
      }

      setMessage("Data berhasil ditambahkan");
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

  function handleEditPhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setEditPhotoUrl(typeof reader.result === "string" ? reader.result : "");
    };
    reader.readAsDataURL(file);
  }

  async function handleUpdateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editUserId) {
      return;
    }

    setIsUpdating(true);
    setMessage("");

    try {
      const payload: SavePayload = {
        role: editRole,
        username: editUsername,
        fullName: editFullName,
        className: editRole === "student" ? editClassName : null,
        password: editPassword || undefined,
        email: editEmail || undefined,
        photoUrl: editPhotoUrl || null,
      };

      const response = await fetch(`/api/admin/users/${editUserId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        setMessage(result.error ?? "Gagal memperbarui data pengguna");
        return;
      }

      setMessage(result.message ?? "Data berhasil diperbarui");
      setIsEditModalOpen(false);
      setEditUserId(null);
      await loadUsers(activeRole);
    } catch {
      setMessage("Terjadi kesalahan saat memperbarui data pengguna");
    } finally {
      setIsUpdating(false);
    }
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
          <div className="mb-4 flex flex-wrap gap-2">
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
              placeholder="Password (default 10105158)"
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
                {isSaving ? "Menyimpan..." : `Tambah ${activeRole === "guru" ? "Guru" : "Murid"}`}
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
                <div className="flex flex-wrap gap-2">
                  <a
                    href="/templates/student-import-template.csv"
                    download
                    className="inline-block rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    Download Format CSV
                  </a>
                  <button
                    type="button"
                    onClick={() => csvInputRef.current?.click()}
                    className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-700"
                  >
                    Upload File CSV
                  </button>
                  <input
                    ref={csvInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleImportCsv}
                    className="hidden"
                  />
                </div>
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

        {canManageStudentBulk ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Lihat Siswa per Kelas</h2>
            {classOptions.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">Belum ada data kelas untuk ditampilkan.</p>
            ) : (
              <>
                <div className="mt-3 flex flex-wrap gap-2">
                  {classOptions.map((classOption) => (
                    <button
                      key={classOption}
                      type="button"
                      onClick={() => setSelectedClassView(classOption)}
                      className={`rounded-lg px-3 py-2 text-sm ${
                        selectedClassView === classOption
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {classOption}
                    </button>
                  ))}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {studentsInSelectedClass.map((student) => (
                    <article
                      key={student.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                    >
                      <div className="flex items-center gap-3">
                        {student.photo_url ? (
                          <img
                            src={student.photo_url}
                            alt={`Foto ${student.full_name ?? student.username ?? "murid"}`}
                            className="h-12 w-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 text-xs text-slate-500">
                            No Foto
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-slate-800">
                            {student.full_name ?? "Tanpa Nama"}
                          </p>
                          <p className="text-xs text-slate-500">{student.username ?? "-"}</p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}
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

        {isEditModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
            <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-semibold">Edit Pengguna</h3>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="rounded-md border border-slate-300 px-3 py-1 text-sm"
                >
                  Tutup
                </button>
              </div>

              <form onSubmit={handleUpdateUser} className="grid gap-3 md:grid-cols-2">
                <select
                  value={editRole}
                  onChange={(event) => setEditRole(event.target.value as UserRole)}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                >
                  <option value="guru">Guru</option>
                  <option value="student">Murid</option>
                </select>
                <input
                  type="text"
                  placeholder="Username"
                  value={editUsername}
                  onChange={(event) => setEditUsername(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  required
                />
                <input
                  type="text"
                  placeholder="Nama Lengkap"
                  value={editFullName}
                  onChange={(event) => setEditFullName(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  required
                />
                {editRole === "student" ? (
                  <input
                    type="text"
                    placeholder="Kelas"
                    value={editClassName}
                    onChange={(event) => setEditClassName(event.target.value)}
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
                  placeholder="Password baru (opsional)"
                  value={editPassword}
                  onChange={(event) => setEditPassword(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                />
                <input
                  type="email"
                  placeholder="Email auth opsional"
                  value={editEmail}
                  onChange={(event) => setEditEmail(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                />
                <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600">
                  Upload Foto
                  <input type="file" accept="image/*" onChange={handleEditPhotoChange} className="text-xs" />
                </label>
                <div className="md:col-span-2 flex items-center gap-2">
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

              {editPhotoUrl ? (
                <div className="mt-3">
                  <p className="mb-1 text-sm text-slate-500">Preview foto:</p>
                  <img src={editPhotoUrl} alt="Preview foto edit" className="h-14 w-14 rounded-full object-cover" />
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
