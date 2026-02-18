"use client";

import { useEffect, useMemo, useState } from "react";

type DashboardCardMeta = {
  title: string;
  icon: string;
  accent: string;
  iconBg: string;
};

type LatestExam = {
  id: string;
  title: string;
  createdAt: string;
};

type DashboardSummary = {
  totalGuru: number;
  totalSiswa: number;
  ujianAktif: number;
  totalHasil: number;
  latestExams: LatestExam[];
};

const cardMeta: DashboardCardMeta[] = [
  {
    title: "Total Guru",
    icon: "🏢",
    accent: "border-l-blue-500",
    iconBg: "bg-blue-100 text-blue-600",
  },
  {
    title: "Total Siswa",
    icon: "👥",
    accent: "border-l-emerald-500",
    iconBg: "bg-emerald-100 text-emerald-600",
  },
  {
    title: "Ujian Aktif",
    icon: "📋",
    accent: "border-l-violet-500",
    iconBg: "bg-violet-100 text-violet-600",
  },
  {
    title: "Total Hasil",
    icon: "📶",
    accent: "border-l-orange-500",
    iconBg: "bg-orange-100 text-orange-600",
  },
];

export default function AdminDashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary>({
    totalGuru: 0,
    totalSiswa: 0,
    ujianAktif: 0,
    totalHasil: 0,
    latestExams: [],
  });
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [summaryMessage, setSummaryMessage] = useState("");

  const cards = useMemo(
    () => [
      { ...cardMeta[0], value: summary.totalGuru },
      { ...cardMeta[1], value: summary.totalSiswa },
      { ...cardMeta[2], value: summary.ujianAktif },
      { ...cardMeta[3], value: summary.totalHasil },
    ],
    [summary]
  );

  useEffect(() => {
    async function loadSummary() {
      setIsLoadingSummary(true);
      setSummaryMessage("");

      try {
        const response = await fetch("/api/admin/dashboard-summary", {
          cache: "no-store",
        });
        const result = (await response.json()) as {
          data?: DashboardSummary;
          error?: string;
        };

        if (!response.ok) {
          setSummaryMessage(result.error ?? "Gagal memuat statistik dashboard");
          return;
        }

        if (result.data) {
          setSummary(result.data);
        }
      } catch {
        setSummaryMessage("Terjadi kesalahan saat memuat statistik dashboard");
      } finally {
        setIsLoadingSummary(false);
      }
    }

    void loadSummary();
  }, []);

  function formatDate(value: string) {
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  }

  return (
    <main className="min-h-screen px-7 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <h1 className="text-4xl font-semibold text-slate-800">Dashboard Administrator</h1>
          <p className="mt-1 text-xl text-slate-500">Selamat datang, Administrator</p>
        </header>

        <div className="grid gap-5 lg:grid-cols-2">
          {cards.map((card) => (
            <article
              key={card.title}
              className={`rounded-3xl border border-slate-200 border-l-8 ${card.accent} bg-white px-8 py-7 shadow-sm`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xl text-slate-500">{card.title}</p>
                  <p className="mt-1 text-5xl font-semibold text-slate-800">
                    {isLoadingSummary ? "..." : card.value}
                  </p>
                </div>
                <div
                  className={`flex h-16 w-16 items-center justify-center rounded-2xl text-3xl ${card.iconBg}`}
                >
                  <span aria-hidden>{card.icon}</span>
                </div>
              </div>
            </article>
          ))}
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white px-8 py-7 shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-800">Ujian Terbaru</h2>
          {summaryMessage ? <p className="mt-3 text-sm text-red-500">{summaryMessage}</p> : null}
          {isLoadingSummary ? <p className="mt-3 text-sm text-slate-400">Memuat data...</p> : null}
          {!isLoadingSummary && summary.latestExams.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">Belum ada ujian</p>
          ) : null}
          {!isLoadingSummary && summary.latestExams.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {summary.latestExams.map((exam) => (
                <li
                  key={exam.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3"
                >
                  <span className="text-sm font-medium text-slate-700">{exam.title}</span>
                  <span className="text-sm text-slate-500">{formatDate(exam.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </main>
  );
}
