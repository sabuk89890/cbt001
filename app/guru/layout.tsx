"use client";

import { ReactNode, useEffect, useState } from "react";
import Sidebar from "@/components/sidebar";

type GuruLayoutProps = { children: ReactNode };

// Restricted menu for Guru: only allowed items and links under /guru
const menuItems = [
  { label: "Dashboard", icon: "📊", href: "/guru" },
  { label: "Bank Soal", icon: "🗂️", href: "/guru/bank-soal" },
  { label: "Jadwal Ujian", icon: "📝", href: "/guru/jadwal" },
  { label: "Penilaian Manual", icon: "✅", href: "/guru/penilaian" },
  { label: "Hasil & Laporan", icon: "📁", href: "/guru/hasil" },
];

export default function GuruLayout({ children }: GuruLayoutProps) {
  const [subtitle, setSubtitle] = useState("Panel Guru");
  useEffect(() => {
    // Defensive cleanup kept only for dev-time issues; harmless otherwise
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

        document.querySelectorAll('[data-base-ui-inert],[data-with-open-in-editor-link],[inert]').forEach((el) => {
          try {
            el.removeAttribute('data-base-ui-inert');
            el.removeAttribute('data-with-open-in-editor-link');
            el.removeAttribute('inert');
            (el as HTMLElement).style.pointerEvents = 'auto';
            hidden.push(`un-inert -> ${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}`);
          } catch {}
        });

        // Only hide full-screen fixed elements that are NOT part of the app root (#__next).
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

        document.body.style.pointerEvents = 'auto';

        if (hidden.length > 0 && typeof console !== 'undefined' && console.info) {
          console.info('[guru layout] overlay cleanup hidden elements:', hidden);
        }
      } catch {}
    }

    // read subtitle from localStorage
    try {
      const raw = localStorage.getItem("auth:user");
      if (raw) {
        const auth = JSON.parse(raw);
        const name = auth?.fullName ?? auth?.username ?? auth?.id ?? "Guru";
        setSubtitle(`Selamat Datang ${name}`);
      }
    } catch {}

    cleanupOverlays();

    const observer = new MutationObserver(() => cleanupOverlays());
    observer.observe(document.body, { childList: true, subtree: true });

    const interval = setInterval(cleanupOverlays, 1000);
    const stopTimeout = setTimeout(() => {
      clearInterval(interval);
      observer.disconnect();
    }, 15000);

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
      document.removeEventListener('pointerdown', pointerFixListener, { capture: true } as any);
    };
  }, []);
  return (
    <div className="flex min-h-screen bg-slate-200 text-slate-800">
      <Sidebar title="CBT SMP Negeri 1 Bukit" subtitle={subtitle} menuItems={menuItems} />
      <section className="min-w-0 flex-1">{children}</section>
    </div>
  );
}
