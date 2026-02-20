"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type SessionRow = {
  id: string;
  title?: string | null;
  bank_id?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  duration_minutes?: number | null;
  created_at?: string | null;
  settings?: any;
};

export default function GuruJadwalPage() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string| null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/exams');
        const j = await res.json();
        if (!res.ok) {
          setError(j.error ?? 'Gagal memuat jadwal');
          setSessions([]);
        } else {
          setSessions(j.data ?? []);
        }
      } catch (e: any) {
        setError(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold mb-4">Jadwal Ujian</h1>

        <div className="mb-6">
          <div>
            <h2 className="text-lg font-medium">Jadwal Ujian</h2>
          </div>
        </div>

        {loading ? <p className="text-sm">Memuat...</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {sessions.map((s) => (
            <div key={s.id} className="rounded-lg bg-white shadow p-4 relative">
              <div className="absolute -left-3 top-3 h-full w-2 bg-gradient-to-b from-purple-400 to-violet-600 rounded-l"></div>
              <div className="pl-3">
                <div className="flex justify-between items-start">
                  <h3 className="text-lg font-semibold">{s.title ?? s.id}</h3>
                  <div className="text-xs text-slate-500">{s.duration_minutes != null ? `${s.duration_minutes}m` : ''}</div>
                </div>
                <div className="text-sm text-slate-500 mt-2">ID: {s.id}</div>
                <div className="mt-4 text-sm text-slate-600">Mulai Ujian</div>
                <div className="text-base font-medium mt-1">
                  {(() => {
                    const raw = s.starts_at ?? (s.settings && s.settings.startsAt) ?? null;
                    if (!raw) return <span className="text-slate-400">Belum dijadwalkan</span>;
                    try {
                      const dt = new Date(raw);
                      return dt.toLocaleString();
                    } catch (e) {
                      return <span className="text-slate-400">Belum dijadwalkan</span>;
                    }
                  })()}
                </div>

                <div className="mt-4 text-sm text-slate-600">Selesai</div>
                <div className="text-base font-medium mt-1">
                  {(() => {
                    const raw = s.ends_at ?? (s.settings && s.settings.endsAt) ?? null;
                    if (!raw) return <span className="text-slate-400">-</span>;
                    try {
                      const dt = new Date(raw);
                      return dt.toLocaleString();
                    } catch (e) {
                      return <span className="text-slate-400">-</span>;
                    }
                  })()}
                </div>

                <div className="mt-4">
                  <div className="text-sm text-slate-500">Bank: {s.bank_id ?? '-'}</div>
                </div>

              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
