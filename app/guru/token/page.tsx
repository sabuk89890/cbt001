"use client";

import { useEffect, useState } from "react";

export default function GuruTokenPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [tokens, setTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const sRes = await fetch('/api/exams');
      const sJson = await sRes.json();
      setSessions(sJson.data ?? []);

      const tRes = await fetch('/api/admin/exam-tokens');
      const tJson = await tRes.json();
      setTokens(tJson.data ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadAll(); }, []);

  const findToken = (sessionId: string) => {
    return tokens.find((t) => t.session_id === sessionId) || null;
  };

  const handleGenerate = async (sessionId: string) => {
    const expiresAt = prompt('Masukkan tanggal kadaluwarsa (YYYY-MM-DD HH:MM) atau kosong untuk tanpa kadaluwarsa');
    let body: any = {};
    if (expiresAt) body.expiresAt = new Date(expiresAt).toISOString();
    const res = await fetch(`/api/admin/exams/${sessionId}/token`, { method: 'POST', headers: { 'content-type':'application/json' }, body: JSON.stringify(body) });
    if (res.ok) {
      alert('Token dibuat / diperbarui');
      await loadAll();
    } else {
      const j = await res.json();
      alert('Gagal: ' + (j.error || '')); 
    }
  };

  const handleClear = async (sessionId: string) => {
    if (!confirm('Hapus token untuk sesi ini?')) return;
    const res = await fetch(`/api/admin/exams/${sessionId}/token`, { method: 'DELETE' });
    if (res.ok) {
      alert('Token dihapus');
      await loadAll();
    } else {
      const j = await res.json();
      alert('Gagal: ' + (j.error || ''));
    }
  };

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-semibold mb-4">Token Ujian</h1>
        <p className="text-sm text-slate-500 mb-4">Kelola token akses untuk sesi ujian. Token dapat diatur manual atau dibuat otomatis dengan tanggal kadaluwarsa.</p>

        <button className="px-3 py-2 bg-blue-600 text-white rounded mb-4" onClick={loadAll} disabled={loading}>Refresh</button>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-slate-600 border-b">
                <th className="py-2">Sesi</th>
                <th className="py-2">Token</th>
                <th className="py-2">Kadaluarsa</th>
                <th className="py-2">Manual</th>
                <th className="py-2">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const tok = findToken(s.id);
                const expired = tok && tok.expires_at && new Date(tok.expires_at) < new Date();
                return (
                  <tr key={s.id} className="border-b">
                    <td className="py-2">{s.title || s.id}</td>
                    <td className="py-2">{tok ? tok.token : '-'}</td>
                    <td className="py-2">{tok ? (tok.expires_at ? new Date(tok.expires_at).toLocaleString() : '—') : '-'}</td>
                    <td className="py-2">{tok ? (tok.manual ? 'Ya' : 'Tidak') : '-'}</td>
                    <td className="py-2">
                      <div className="flex gap-2">
                        <button className="px-2 py-1 bg-green-600 text-white rounded" onClick={()=>handleGenerate(s.id)}>
                          {tok ? 'Ubah' : 'Buat'}
                        </button>
                        {tok && (
                          <button className="px-2 py-1 bg-red-600 text-white rounded" onClick={()=>handleClear(s.id)}>
                            Hapus
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
