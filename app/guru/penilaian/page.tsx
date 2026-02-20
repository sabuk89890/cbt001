"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SubmissionRow = {
  id: string;
  session_id: string;
  student_id: string;
  score?: number | null;
  needs_manual_review?: boolean;
  review_status?: string | null;
  reviewed_by?: string | null;
  created_at?: string | null;
};

export default function GuruPenilaianPage() {
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<"pending" | "reviewed" | "all">("pending");
  const [kelasFilter, setKelasFilter] = useState<string>("all");
  const [bankFilter, setBankFilter] = useState<string>("all");
  const [qFilter, setQFilter] = useState<string>("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const raw = localStorage.getItem("auth:user");
        if (!raw) {
          setError("Belum login sebagai guru");
          setRows([]);
          setLoading(false);
          return;
        }
        const auth = JSON.parse(raw);
        const teacherId = auth?.id;
        if (!teacherId) {
          setError("ID guru tidak ditemukan");
          setRows([]);
          setLoading(false);
          return;
        }

        const res = await fetch(`/api/guru/submissions?teacherId=${encodeURIComponent(teacherId)}`);
        const payload = await res.json();
        if (!res.ok) {
          setError(payload.error ?? "Gagal memuat submission");
          setRows([]);
        } else {
          const data = (payload.data ?? []) as SubmissionRow[];
          // store raw rows and supporting data
          setRows(data);
          setSessions(payload.sessions ?? []);
          setBanks(payload.banks ?? []);
        }
      } catch (err: any) {
        setError(err?.message ?? String(err));
        setRows([]);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-6 py-12">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">Penilaian Manual</h1>
        <p className="text-sm text-slate-600">Daftar submission yang memerlukan penilaian manual (essay). Hanya submission untuk bank soal Anda akan ditampilkan.</p>
      </header>

      {loading ? <p className="text-sm">Memuat...</p> : null}
      {error ? <p className="text-sm text-red-600">Gagal memuat: {error}</p> : null}

      <section className="space-y-3 rounded-lg border p-4">
        <div className="flex flex-wrap gap-2 text-sm">
          <button onClick={() => setStatusFilter("pending")} className="rounded-md border px-3 py-1">Pending</button>
          <button onClick={() => setStatusFilter("reviewed")} className="rounded-md border px-3 py-1">Reviewed</button>
          <button onClick={() => setStatusFilter("all")} className="rounded-md border px-3 py-1">Semua</button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="px-1 py-1 opacity-70">Kelas:</span>
            <button onClick={() => setKelasFilter("all")} className="rounded-md border px-3 py-1">Semua</button>
            {Array.from(new Set(rows.map((r) => r.className).filter((v) => v && v !== "null"))).map((item) => (
              <button key={item} onClick={() => setKelasFilter(item ?? "all")} className="rounded-md border px-3 py-1">{item}</button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="px-1 py-1 opacity-70">Bank:</span>
            <button onClick={() => setBankFilter("all")} className="rounded-md border px-3 py-1">Semua</button>
            {sessions && banks ? (
              Array.from(new Map(sessions.map((s: any) => {
                const bank = banks.find((b: any) => b.id === s.bank_id);
                return [s.id, { id: bank?.id, title: bank?.title ?? "-" }];
              })).values()).map((b: any) => (
                <button key={b.id} onClick={() => setBankFilter(b.id)} className="rounded-md border px-3 py-1">{b.title}</button>
              ))
            ) : null}
          </div>

          <form onSubmit={(e) => { e.preventDefault(); const form = e.target as HTMLFormElement; const fd = new FormData(form); setQFilter(String(fd.get('q') ?? '')); }} className="ml-auto flex items-center gap-2">
            <input name="q" defaultValue={qFilter} placeholder="Cari nama atau id siswa" className="rounded border px-3 py-1 text-sm" />
            <button type="submit" className="rounded-md border px-3 py-1 text-sm">Cari</button>
          </form>
        </div>
      </section>

      <section className="rounded-lg border">
        <ul className="divide-y">
          {rows
            .filter((item) => {
              const statusOk = statusFilter === "all" ? true : (statusFilter === "pending" ? (item.needs_manual_review ?? false) : (item.review_status === "reviewed"));
              const kelasOk = kelasFilter === "all" ? true : (item.className === kelasFilter);
              const bankForItem = sessions.find((s) => s.id === item.session_id)?.bank_id ?? null;
              const bankOk = bankFilter === "all" ? true : bankForItem === bankFilter;
              const qOk = !qFilter ? true : ((item.studentName ?? "").toLowerCase().includes(qFilter.toLowerCase()) || (item.student_id ?? "").toLowerCase().includes(qFilter.toLowerCase()));
              return statusOk && kelasOk && bankOk && qOk;
            })
            .map((item) => (
              <li key={item.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">Submission {item.id}</p>
                  <p className="text-xs opacity-70">Session: {item.session_id} • Student: {item.studentName ?? item.student_id ?? 'anon'}</p>
                  <p className="text-xs opacity-70">Score: {item.score} • Status: {item.status} • Review: {item.review_status} • Kelas: {item.className ?? '-'}</p>
                </div>
                <Link href={`/guru/review/${item.session_id}/${item.id}`} className="rounded-md border px-3 py-1 text-sm">Buka Penilaian</Link>
              </li>
            ))}
          {(!error && rows.filter((item) => {
            const statusOk = statusFilter === "all" ? true : (statusFilter === "pending" ? (item.needs_manual_review ?? false) : (item.review_status === "reviewed"));
            const kelasOk = kelasFilter === "all" ? true : (item.className === kelasFilter);
            const bankForItem = sessions.find((s) => s.id === item.session_id)?.bank_id ?? null;
            const bankOk = bankFilter === "all" ? true : bankForItem === bankFilter;
            const qOk = !qFilter ? true : ((item.studentName ?? "").toLowerCase().includes(qFilter.toLowerCase()) || (item.student_id ?? "").toLowerCase().includes(qFilter.toLowerCase()));
            return statusOk && kelasOk && bankOk && qOk;
          }).length === 0) ? (
            <li className="p-4 text-sm">Tidak ada data review untuk filter yang dipilih.</li>
          ) : null}
        </ul>
      </section>
    </main>
  );
}
