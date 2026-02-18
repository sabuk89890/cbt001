"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

type AdminLayoutProps = {
  children: ReactNode;
};

const menuItems = [
  { label: "Dashboard", icon: "📊", href: "/admin" },
  { label: "Pengguna", icon: "👥", href: "/admin/users" },
  { label: "Mata Pelajaran", icon: "📚", href: "/admin/subjects" },
  { label: "Bank Soal", icon: "🗂️", href: "/admin/question-bank" },
  { label: "Review", icon: "✅", href: "/admin/review" },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-slate-200 text-slate-800">
      <aside className="w-72 shrink-0 border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-6">
          <p className="text-2xl font-semibold text-slate-800">CBT SMP Negeri 1 Bukit</p>
          <p className="text-sm text-slate-500">Panel Administrator</p>
        </div>

        <nav className="space-y-2 px-3 py-5">
          {menuItems.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${
                  isActive
                    ? "border-l-4 border-l-blue-500 bg-blue-50 font-medium text-slate-900"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span aria-hidden>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <section className="min-w-0 flex-1">{children}</section>
    </div>
  );
}
