"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

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
  const [collapsed, setCollapsed] = useState<boolean>(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('sidebar:collapsed');
      setCollapsed(raw === '1');
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('sidebar:collapsed', collapsed ? '1' : '0');
    } catch {}
  }, [collapsed]);

  return (
    <aside className={`${collapsed ? 'w-20' : 'w-72'} shrink-0 border-r border-slate-200 bg-white sticky top-0 h-screen transition-all`}>
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
        <div className="flex items-center gap-3">
          <div onDoubleClick={() => setCollapsed((s) => !s)} className={`relative inline-flex items-center justify-center rounded-md bg-slate-100 overflow-hidden flex-shrink-0 cursor-pointer ${collapsed ? '' : 'mr-2'}`} style={{ width: collapsed ? 32 : 40, height: collapsed ? 32 : 40 }} title="Klik dua kali untuk buka/tutup sidebar">
            <img src="/file.svg" alt="Logo" className="h-full w-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            {/* fallback initials when image not available */}
            <div className="absolute inset-0 flex items-center justify-center text-slate-700 font-semibold text-sm select-none">CBT</div>
          </div>
          <div className={`${collapsed ? 'hidden' : 'min-w-0 overflow-hidden'}`}>
            <p className="text-lg font-semibold text-slate-800 whitespace-nowrap truncate max-w-[13rem]">{title}</p>
            <p className="text-xs text-slate-500 truncate">{subtitle}</p>
          </div>
        </div>

        <button
          aria-label={collapsed ? 'Buka sidebar' : 'Tutup sidebar'}
          title={collapsed ? 'Buka' : 'Tutup'}
          onClick={() => setCollapsed((s) => !s)}
          className="-mr-2 rounded p-1 text-slate-500 hover:bg-slate-100">
          <svg className={`h-5 w-5 transform transition-transform ${collapsed ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M7 5L13 10L7 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <nav className="space-y-2 px-2 py-5">
        {menuItems.map((item) => {
          const isActive =
            item.href === pathname || pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                isActive
                  ? 'border-l-4 border-l-blue-500 bg-blue-50 font-medium text-slate-900'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}>
              <span aria-hidden className="text-lg">{item.icon}</span>
              <span className={`${collapsed ? 'sr-only' : ''}`}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-slate-100">
        <div className="mb-3">
          <button
            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm w-full text-slate-700 hover:bg-slate-100 ${collapsed ? 'justify-center' : ''}`}
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
            <span className={`${collapsed ? 'sr-only' : ''}`}>Keluar</span>
          </button>
        </div>
        <div className={`text-xs text-slate-500 px-4 ${collapsed ? 'hidden' : ''}`}>
          <div>@2026 EfKa Studio</div>
          <div>Pengembang Feri Kurniawan</div>
        </div>
      </div>
    </aside>
  );
}
