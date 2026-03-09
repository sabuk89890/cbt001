"use client";

import { useState, useEffect } from "react";

export default function PengaturanPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [requireExamBrowser, setRequireExamBrowser] = useState<boolean>(false);

  // load current global settings on mount
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const j = await res.json();
          setRequireExamBrowser(!!j.data?.requireExamBrowser);
        }
      } catch {};
    })();
  }, []);

  async function doBackup() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/backup');
      if (!res.ok) throw new Error('Gagal membuat backup');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cbt-backup-${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMessage('Backup berhasil diunduh');
    } catch (e:any) {
      setMessage(e?.message ?? 'Backup gagal');
    } finally { setLoading(false); }
  }

  async function doRestore(file: File | null) {
    if (!file) return;
    if (!confirm('Restore akan menulis data ke database. Lanjutkan?')) return;
    setLoading(true);
    setMessage(null);
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const res = await fetch('/api/admin/backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Restore gagal');
      setMessage('Restore selesai');
    } catch (e:any) {
      setMessage(e?.message ?? 'Restore gagal');
    } finally { setLoading(false); }
  }

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold mb-4">Pengaturan Sistem</h1>

        <section className="rounded border bg-white p-4 mb-4">
          <h2 className="font-medium">Backup Data</h2>
          <p className="text-sm text-slate-600">Unduh snapshot JSON dari beberapa tabel penting.</p>
          <div className="mt-3">
            <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={doBackup} disabled={loading}>Buat Backup</button>
          </div>
        </section>

        <section className="rounded border bg-white p-4 mb-4">
          <h2 className="font-medium">Pengaturan Exambro</h2>
          <p className="text-sm text-slate-600">Jika diaktifkan, siswa hanya dapat mengikuti ujian menggunakan aplikasi Exambro Android atau SafeExamBrowser di komputer; browser biasa akan ditolak.</p>
          <div className="mt-3">
            <label className="inline-flex items-center">
              <input
                type="checkbox"
                checked={requireExamBrowser}
                onChange={async (e) => {
                  const val = e.target.checked;
                  setRequireExamBrowser(val);
                  try {
                    await fetch('/api/admin/settings', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ key: 'requireExamBrowser', value: val }),
                    });
                  } catch {}
                }}
                className="mr-2"
              />
              Aktifkan fitur Exambro
            </label>
          </div>
        </section>

        <section className="rounded border bg-white p-4 mb-4">
          <h2 className="font-medium">Restore Data</h2>
          <p className="text-sm text-slate-600">Unggah file JSON yang dibuat oleh fitur Backup untuk merestore data.</p>
          <div className="mt-3 flex items-center gap-2">
            <input type="file" accept="application/json" id="restoreFile" />
            <button className="px-3 py-1 bg-red-600 text-white rounded" onClick={()=>{
              const el = document.getElementById('restoreFile') as HTMLInputElement | null;
              const file = el?.files?.[0] ?? null;
              void doRestore(file);
            }} disabled={loading}>Restore</button>
          </div>
        </section>

        {message ? <div className="text-sm text-slate-600">{message}</div> : null}
      </div>
    </main>
  );
}
