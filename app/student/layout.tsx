"use client";

import Image from "next/image";
import { ReactNode, useEffect, useState } from "react";

type StudentLayoutProps = { children: ReactNode };

export default function StudentLayout({ children }: StudentLayoutProps) {
  const [subtitle, setSubtitle] = useState("Panel Siswa");

  useEffect(() => {
    // redirect unauthenticated students back to login
    try {
      const raw = localStorage.getItem("auth:user");
      const auth = raw ? JSON.parse(raw) : null;
      if (!auth || auth.role !== 'student') {
        window.location.assign('/auth/student');
        return;
      }
    } catch {
      window.location.assign('/auth/student');
      return;
    }

    try {
      const raw = localStorage.getItem("auth:user");
      if (raw) {
        const auth = JSON.parse(raw);
        const name = auth?.fullName ?? auth?.username ?? auth?.id ?? "Siswa";
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSubtitle(name);
      }
    } catch {}

    // lightweight defensive overlay cleanup (same approach as guru/admin)
    function cleanup() {
      try {
        document.body.style.pointerEvents = 'auto';

        // common dev / platform overlay selectors we want to neutralize
        const selectors = [
          '[data-nextjs-dialog-backdrop]',
          '[data-nextjs-dialog-overlay]',
          '.nextjs-overlay-backdrop',
          '[data-nextjs-overlay]',
          '.react-dev-overlay',
          '.next-overlay',
          '[data-overlay]',
          '.screenshot-overlay',
          '.snipping-tool-overlay',
          '.dev-overlay',
          '.modal-backdrop',
          '[data-modal-backdrop]',
          '[data-backdrop]'
        ];

        selectors.forEach((s) => document.querySelectorAll(s).forEach((el) => {
          try { (el as HTMLElement).style.display = 'none'; (el as HTMLElement).style.pointerEvents = 'none'; } catch {}
        }));

        // heuristic: hide any full-screen fixed element with very large z-index (likely dev overlay)
        document.querySelectorAll('body > *').forEach((el) => {
          try {
            const cs = getComputedStyle(el as Element);
            const z = parseInt(cs.zIndex || '0', 10) || 0;
            const isFullScreen = (el as HTMLElement).clientWidth >= window.innerWidth && (el as HTMLElement).clientHeight >= window.innerHeight;
            if (cs.position === 'fixed' && isFullScreen && z > 1000) {
              // avoid touching app-owned overlays explicitly marked with data-app-overlay
              if (!(el as HTMLElement).hasAttribute('data-app-overlay')) {
                (el as HTMLElement).style.display = 'none';
                (el as HTMLElement).style.pointerEvents = 'none';
              }
            }
          } catch {}
        });
      } catch {}
    }

    cleanup();
    const obs = new MutationObserver(() => cleanup());
    obs.observe(document.body, { childList: true, subtree: true });
    const iv = setInterval(cleanup, 1000);
    const to = setTimeout(() => { clearInterval(iv); obs.disconnect(); }, 10000);

    return () => {
      clearInterval(iv);
      clearTimeout(to);
      obs.disconnect();
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-200 text-slate-800">
      <header className="border-b bg-white px-6 py-5">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image
              src="https://iili.io/fynLLYJ.png"
              alt="Logo CBT SMP Negeri 1 Bukit"
              width={56}
              height={56}
              className="h-14 w-14 rounded-full bg-white/10 object-contain p-1"
            />
            <div>
              <p className="text-2xl font-semibold">CBT SMP Negeri 1 Bukit</p>
              <p className="text-sm text-slate-500">{subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-sm text-slate-500 text-right">
            <button
              className="flex items-center gap-1 rounded-lg px-3 py-2 hover:bg-slate-100"
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
              🚪
              <span className="text-xs">Logout</span>
            </button>
            <div>
              <div>@2026 EfKa Studio</div>
              <div>By Feri Kurniawan, M.Pd.</div>
            </div>
          </div>
        </div>
      </header>

      <main className="min-w-0 flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
