"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

type MenuItem = { label: string; icon: string; href: string };

export default function Sidebar({
  title = "CBT SMP Negeri 1 Bukit",
  subtitle = "Panel",
  menuItems,
}: {
  title?: string;
  subtitle?: string;
  menuItems: MenuItem[];
}) {
  const pathname = usePathname();

  return (
    <aside className="w-72 shrink-0 border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-6">
        <p className="text-2xl font-semibold text-slate-800">{title}</p>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>

      <nav className="space-y-2 px-3 py-5">
        {menuItems.map((item) => {
          const isActive =
            item.href === pathname || pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${
                isActive
                  ? "border-l-4 border-l-blue-500 bg-blue-50 font-medium text-slate-900"
                  : "text-slate-700 hover:bg-slate-100"
              }`}>
              <span aria-hidden>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-slate-100">
        <div className="mb-3">
          <button
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm w-full text-slate-700 hover:bg-slate-100"
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
          >
            <span>🚪</span>
            <span>Keluar</span>
          </button>
        </div>
        <div className="text-xs text-slate-500 px-4">
          <div>@2026 EfKa Studio</div>
          <div>Pengembang Feri Kurniawan</div>
        </div>
      </div>
    </aside>
  );
}
