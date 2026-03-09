"use client";

import { ReactNode, useEffect } from "react";
import Sidebar from "@/components/sidebar";

type AdminLayoutProps = {
  children: ReactNode;
};

const menuItems = [
  { label: "Dashboard", icon: "📊", href: "/admin" },
  { label: "Pengguna", icon: "👥", href: "/admin/users" },
  { label: "Bank Soal", icon: "🗂️", href: "/admin/question-bank" },
  { label: "Jadwal Ujian", icon: "📝", href: "/admin/exams" },
  { label: "Pelaksanaan", icon: "🎯", href: "/admin/pelaksanaan" },
  { label: "Penilaian Manual", icon: "✅", href: "/admin/review" },
  { label: "Hasil & Laporan", icon: "📁", href: "/admin/hasil" },
  { label: "Token", icon: "🔑", href: "/admin/token" },
  { label: "Pengaturan Sistem", icon: "⚙️", href: "/admin/pengaturan" },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  useEffect(() => {
    // redirect to login if not authenticated as admin
    try {
      const raw = localStorage.getItem('auth:user');
      const auth = raw ? JSON.parse(raw) : null;
      if (!auth || auth.role !== 'admin') {
        window.location.assign('/auth/admin');
        return;
      }
    } catch {
      window.location.assign('/auth/admin');
      return;
    }

    function cleanupOverlays() {
      try {
        const hidden: string[] = [];
        const selectors = [
          '[data-nextjs-dialog-backdrop]',
          '[data-nextjs-dialog-overlay]',
          '.nextjs-overlay-backdrop',
        ];

        selectors.forEach((sel) => {
          document.querySelectorAll(sel).forEach((el) => {
            try {
              (el as HTMLElement).style.display = 'none';
              (el as HTMLElement).style.visibility = 'hidden';
              (el as HTMLElement).style.pointerEvents = 'none';
              hidden.push(`${sel} -> ${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${el.className ? `.${(el.className as string).split(/\s+/).join('.')}` : ''}`);
            } catch {}
          });
        });

        // Only hide full-screen fixed elements that are NOT part of the app (`#__next`).
        // This prevents hiding legitimate in-app modals which live inside the React root.
        document.querySelectorAll('body > *').forEach((el) => {
          try {
            if ((el as Element).closest && (el as Element).closest('#__next')) return;
            const rect = (el as HTMLElement).getBoundingClientRect();
            const style = window.getComputedStyle(el as Element);
            if (style.position === 'fixed' && rect.width >= window.innerWidth - 2 && rect.height >= window.innerHeight - 2) {
              (el as HTMLElement).style.display = 'none';
              (el as HTMLElement).style.pointerEvents = 'none';
              hidden.push(`fixed-full-external -> ${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${el.className ? `.${(el.className as string).split(/\s+/).join('.')}` : ''}`);
            }
          } catch {}
        });

        document.querySelectorAll('[data-base-ui-inert],[data-with-open-in-editor-link],[inert]').forEach((el) => {
          try {
            el.removeAttribute('data-base-ui-inert');
            el.removeAttribute('data-with-open-in-editor-link');
            el.removeAttribute('inert');
            (el as HTMLElement).style.pointerEvents = 'auto';
            hidden.push(`un-inert -> ${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}`);
          } catch {}
        });

        // also hide full-screen fixed elements that cover viewport
        document.querySelectorAll('body > *').forEach((el) => {
          try {
            const rect = (el as HTMLElement).getBoundingClientRect();
            const style = window.getComputedStyle(el as Element);
            if (style.position === 'fixed' && rect.width >= window.innerWidth - 2 && rect.height >= window.innerHeight - 2) {
              (el as HTMLElement).style.display = 'none';
              (el as HTMLElement).style.pointerEvents = 'none';
              hidden.push(`fixed-full -> ${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${el.className ? `.${(el.className as string).split(/\s+/).join('.')}` : ''}`);
            }
          } catch {}
        });

        document.body.style.pointerEvents = 'auto';

        if (hidden.length > 0 && typeof console !== 'undefined' && console.info) {
          console.info('[admin layout] overlay cleanup hidden elements:', hidden);
        }
      } catch {}
    }

    cleanupOverlays();

    // observe DOM mutations to remove overlays that appear later
    const observer = new MutationObserver(() => cleanupOverlays());
    observer.observe(document.body, { childList: true, subtree: true });

    // repeat cleanup for a short period in case overlays are injected asynchronously
    const interval = setInterval(cleanupOverlays, 1000);
    const stopTimeout = setTimeout(() => {
      clearInterval(interval);
      observer.disconnect();
    }, 15000);
    // pointer-fix: if an overlay still intercepts pointer, try to click underlying button
    function pointerFixListener(ev: PointerEvent) {
      try {
        const x = ev.clientX;
        const y = ev.clientY;
        const elems = document.elementsFromPoint(x, y);
        if (!elems || elems.length <= 1) return;
        for (const el of elems) {
          if (!el) continue;
          const tag = (el.tagName || '').toUpperCase();
          if (tag === 'BUTTON' || (tag === 'A' && (el as HTMLAnchorElement).href)) {
            const btn = el as HTMLElement;
            // only trigger if element is inside our app main area
            if (btn.closest('main') || btn.closest('body')) {
              if (btn !== ev.target) {
                try { btn.click(); } catch {}
                ev.stopPropagation();
                ev.preventDefault();
                return;
              }
            }
          }
        }
      } catch {}
    }

    document.addEventListener('pointerdown', pointerFixListener, { capture: true });

    return () => {
      clearInterval(interval);
      clearTimeout(stopTimeout);
      observer.disconnect();
      // cast required because TS expects different event handler type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    document.removeEventListener('pointerdown', pointerFixListener, { capture: true } as any);
    };
  }, []);

  return (
    <div className="flex min-h-screen bg-slate-200 text-slate-800">
      <Sidebar title="CBT SMP Negeri 1 Bukit" subtitle="Panel Administrator" menuItems={menuItems} />
      <section className="min-w-0 flex-1">{children}</section>
    </div>
  );
}
