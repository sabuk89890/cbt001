"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type SubmissionItem = { id: string; sessionId: string; title: string; score: number | null; status: string; createdAt: string };

export default function ScorePage() {
  const [items, setItems] = useState<SubmissionItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [studentName, setStudentName] = useState<string | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('auth:user');
      if (raw) {
        const parsed = JSON.parse(raw);
        setStudentName(parsed?.fullName ?? parsed?.username ?? 'Siswa');
      }
    } catch {}
  }, []);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const raw = localStorage.getItem('auth:user');
        const studentId = raw ? (JSON.parse(raw)?.id ?? null) : null;
        if (!studentId) {
          if (mounted) setItems([]);
          return;
        }

        const res = await fetch(`/api/student/submissions?studentId=${studentId}`);
        const j = await res.json();
        if (!res.ok) throw new Error(j.error ?? 'Gagal memuat hasil ujian');
        if (mounted) setItems(j.data ?? []);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => { mounted = false; };
  }, []);

  return (
    <main
      className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-6 py-12"
      style={{
        backgroundImage: "url('/backgrounds/exam-bg.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: 'rgba(0,0,0,0.22)',
        backgroundBlendMode: 'multiply',
      }}
    >
      <header className="bg-gradient-to-r from-sky-600 to-blue-800 px-6 py-4 text-white rounded-md mb-6 shadow-sm">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image src="https://iili.io/fynLLYJ.png" alt="Logo" width={56} height={56} className="h-12 w-12 rounded-full object-contain" />
            <div>
              <p className="text-2xl font-semibold">CBT SMP Negeri 1 Bukit</p>
              <p className="text-sm opacity-80">Hasil Ujian</p>
              <p className="text-sm opacity-90 mt-1">{studentName || 'Siswa'}</p>
            </div>
          </div>

          <div className="text-sm text-white text-right flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                try {
                  const raw = localStorage.getItem('auth:user');
                  const role = raw ? JSON.parse(raw)?.role : null;
                  localStorage.removeItem('auth:user');
                  window.location.assign(role ? `/auth/${role}` : '/auth/student');
                } catch (e) {
                  localStorage.removeItem('auth:user');
                  window.location.assign('/auth/student');
                }
              }}
              className="rounded-full bg-white/10 px-3 py-1 text-sm font-medium hover:bg-white/20"
            >
              Keluar
            </button>

            <div>
              <div>@2026 EfKa Studio</div>
              <div className="text-xs opacity-80">By Feri Kurniawan, M.Pd.</div>
            </div>
          </div>
        </div>
      </header>

      <section className="rounded-lg border bg-white">
        {loading ? (
          <div className="p-6 text-sm text-slate-500">Memuat hasil ujian...</div>
        ) : error ? (
          <div className="p-6 text-sm text-rose-600">{error}</div>
        ) : !items || items.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">Belum ada hasil ujian untuk akun ini.</div>
        ) : (
          <ul className="divide-y">
            {items.map((it) => (
              <li key={it.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{it.title}</p>
                  <p className="text-sm opacity-70">Status: {it.status} • {new Date(it.createdAt).toLocaleString()}</p>
                </div>
                <p className="text-xl font-semibold">{it.score ?? '-'}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
