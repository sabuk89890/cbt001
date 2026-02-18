"use client";

import { useMemo, useState } from "react";

type DashboardCard = {
  title: string;
  value: number;
  icon: string;
  accent: string;
  iconBg: string;
};

const menuItems = [
  { label: "Dashboard", icon: "📊", active: true },
  { label: "Pengguna", icon: "👥" },
  { label: "Ujian", icon: "📝" },
  { label: "Laporan", icon: "📈" },
  { label: "Pengaturan", icon: "⚙️" },
];

const cards: DashboardCard[] = [
  {
    title: "Total Guru",
    value: 0,
    icon: "🏢",
    accent: "border-l-blue-500",
    iconBg: "bg-blue-100 text-blue-600",
  },
  {
    title: "Total Siswa",
    value: 0,
    icon: "👥",
    accent: "border-l-emerald-500",
    iconBg: "bg-emerald-100 text-emerald-600",
  },
  {
    title: "Ujian Aktif",
    value: 0,
    icon: "📋",
    accent: "border-l-violet-500",
    iconBg: "bg-violet-100 text-violet-600",
  },
  {
    title: "Total Hasil",
    value: 0,
    icon: "📶",
    accent: "border-l-orange-500",
    iconBg: "bg-orange-100 text-orange-600",
  },
];

export default function AdminDashboardPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const sidebarWidthClass = useMemo(
    () => (isSidebarOpen ? "w-80" : "w-28"),
    [isSidebarOpen]
  );

  return (
    <main className="min-h-screen bg-slate-200">
      <div className="flex min-h-screen">
        <aside
          className={`${sidebarWidthClass} flex shrink-0 flex-col border-r border-slate-200 bg-white transition-all duration-300`}
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-6">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-500 text-2xl text-white">
                ⚡
              </div>
              {isSidebarOpen ? (
                <div>
                  <p className="text-3xl font-semibold text-slate-800">CBT SMP Negeri 1 Bukit</p>
                  <p className="text-lg text-slate-500">Versi 3.0.9</p>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              className="rounded-lg p-2 text-2xl text-slate-600 hover:bg-slate-100"
              aria-label={isSidebarOpen ? "Tutup sidebar" : "Buka sidebar"}
            >
              {isSidebarOpen ? "‹" : "›"}
            </button>
          </div>

          <nav className="flex-1 space-y-2 px-3 py-5">
            {menuItems.map((item) => {
              const isActive = item.active;
              return (
                <button
                  key={item.label}
                  type="button"
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-left text-xl transition ${
                    isActive
                      ? "border-l-4 border-l-blue-500 bg-blue-100 text-slate-900"
                      : "text-slate-700 hover:bg-slate-100"
                  } ${isSidebarOpen ? "justify-start" : "justify-center"}`}
                >
                  <span className="text-2xl" aria-hidden>
                    {item.icon}
                  </span>
                  {isSidebarOpen ? <span>{item.label}</span> : null}
                </button>
              );
            })}
          </nav>

          <div className="border-t border-slate-200 p-3">
            <div className="flex items-center gap-3 rounded-2xl bg-slate-100 px-3 py-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xl font-semibold text-white">
                A
              </div>
              {isSidebarOpen ? (
                <div>
                  <p className="text-lg font-medium text-slate-800">Administrator</p>
                  <p className="text-base text-slate-500">Pengembang Feri Kurniawan, M.Pd,</p>
                </div>
              ) : null}
            </div>
          </div>
        </aside>

        <section className="flex-1 overflow-y-auto px-7 py-8">
          <div className="mx-auto max-w-6xl space-y-6">
            <header>
              <h1 className="text-6xl font-semibold text-slate-800">Dashboard Administrator</h1>
              <p className="mt-1 text-4xl text-slate-500">Selamat datang, Administrator</p>
            </header>

            <div className="grid gap-5 lg:grid-cols-2">
              {cards.map((card) => (
                <article
                  key={card.title}
                  className={`rounded-3xl border border-slate-200 border-l-8 ${card.accent} bg-white px-8 py-7 shadow-sm`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-4xl text-slate-500">{card.title}</p>
                      <p className="mt-1 text-7xl font-semibold text-slate-800">{card.value}</p>
                    </div>
                    <div
                      className={`flex h-20 w-20 items-center justify-center rounded-3xl text-4xl ${card.iconBg}`}
                    >
                      <span aria-hidden>{card.icon}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <section className="rounded-3xl border border-slate-200 bg-white px-8 py-7 shadow-sm">
              <h2 className="text-5xl font-semibold text-slate-800">Ujian Terbaru</h2>
              <p className="mt-3 text-4xl text-slate-400">Belum ada ujian</p>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}