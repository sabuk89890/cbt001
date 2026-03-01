"use client";

import { useEffect, useState } from "react";

export default function AdminTokenPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [tokens, setTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<string>("");

  // form state
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const [formToken, setFormToken] = useState("");
  const [formInterval, setFormInterval] = useState<string>("");

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

  const handleSave = async (sessionId: string) => {
    let body: any = {};
    if (formToken) body.token = formToken;
    const interval = parseInt(formInterval);
    if (!isNaN(interval) && interval > 0) {
      body.refreshInterval = interval;
    }
    const res = await fetch(`/api/admin/exams/${sessionId}/token`, { method: 'POST', headers: { 'content-type':'application/json' }, body: JSON.stringify(body) });
    if (res.ok) {
      alert('Token dibuat / diperbarui');
      setEditingSession(null);
      setFormToken("");
      setFormInterval("");
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
        <h1 className="text-2xl font-semibold mb-4">Token Ujian (Admin)</h1>
        <p className="text-sm text-slate-500 mb-4">Kelola token akses untuk sesi ujian. Token dapat diatur manual atau dibuat otomatis dengan tanggal kadaluwarsa.</p>

        <div className="mb-3 flex items-center gap-2">
          <label className="text-sm">Refresh interval (menit, kosong = manual)</label>
          <input type="number" min="0" value={refreshInterval} onChange={(e)=>setRefreshInterval(e.target.value)} className="input w-24" />
        </div>
        <button className="px-3 py-2 bg-blue-600 text-white rounded mb-4" onClick={loadAll} disabled={loading}>Refresh</button>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
          {/* edit modal/form */}
          {editingSession && (
            <tbody className="bg-gray-50">
              <tr>
                <td colSpan={5} className="p-4">
                  <div className="rounded border p-4 bg-white">
                    <h3 className="font-semibold mb-2">Buat/Ubah Token</h3>
                    <div className="mb-2">
                      <label className="block text-sm">Token</label>
                      <div className="flex gap-2 mt-1">
                        <input value={formToken} onChange={(e)=>setFormToken(e.target.value)} className="input flex-1" />
                        <button type="button" className="btn btn-secondary" onClick={()=>setFormToken(Math.random().toString(36).substring(2,7))}>Generate</button>
                      </div>
                    </div>
                    <div className="mb-2">
                      <label className="block text-sm">Auto-refresh (menit, 0 = manual)</label>
                      <input type="number" min="0" value={formInterval} onChange={(e)=>setFormInterval(e.target.value)} className="input w-24 mt-1" />
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button className="btn btn-primary" onClick={()=>handleSave(editingSession!)}>Simpan</button>
                      <button className="btn btn-secondary" onClick={()=>setEditingSession(null)}>Batal</button>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          )}
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
                return (
                  <tr key={s.id} className="border-b">
                    <td className="py-2">{s.title || s.id}</td>
                    <td className="py-2">{tok ? tok.token : '-'}</td>
                    <td className="py-2">{tok ? (tok.refresh_interval ? `${tok.refresh_interval}m` : 'manual') : '-'}</td>
                    <td className="py-2">{tok ? (tok.manual ? 'Ya' : 'Tidak') : '-'}</td>
                    <td className="py-2">
                      <div className="flex gap-2">
                        <button
                          className="px-2 py-1 bg-green-600 text-white rounded"
                          onClick={() => {
                            setEditingSession(s.id);
                            setFormToken(tok?.token ?? '');
                            setFormInterval(tok?.refresh_interval ? String(tok.refresh_interval) : '');
                          }}
                        >
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
