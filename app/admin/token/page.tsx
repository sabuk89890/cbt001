"use client";

import { useEffect, useState } from "react";

export default function AdminTokenPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // editing form state
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const [formToken, setFormToken] = useState("");
  const [formInterval, setFormInterval] = useState<string>("");

  const loadSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/exams');
      const j = await res.json();
      setSessions(j.data ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSessions();
  }, []);

  const findToken = (sessionId: string) => {
    const s = sessions.find((x) => x.id === sessionId);
    if (!s) return null;
    return {
      token: s.settings?.token ?? null,
      refresh_interval: s.settings?.refreshInterval ?? null,
      manual: !(s.settings?.refreshInterval && s.settings?.refreshInterval > 0),
    };
  };

  const makeRandomToken = (length = 6) => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let str = "";
    for (let i = 0; i < length; i++) {
      str += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return str;
  };

  const handleSave = async (sessionId: string) => {
    const sess = sessions.find((x) => x.id === sessionId);
    if (!sess) return;
    const newSettings = { ...(sess.settings || {}) };
    if (formToken !== undefined) newSettings.token = formToken || null;
    if (formInterval !== "") {
      const iv = parseInt(formInterval);
      newSettings.refreshInterval = !isNaN(iv) && iv > 0 ? iv : null;
    } else {
      newSettings.refreshInterval = null;
    }

    const res = await fetch(`/api/exams/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: newSettings }),
    });
    if (res.ok) {
      alert('Token diperbarui');
      setEditingSession(null);
      setFormToken('');
      setFormInterval('');
      await loadSessions();
    } else {
      const j = await res.json();
      alert('Gagal: ' + (j.error || ''));
    }
  };

  const handleRefresh = async (sessionId: string) => {
    const tok = makeRandomToken(5);
    setEditingSession(sessionId);
    setFormToken(tok);
    // keep existing interval
    const current = findToken(sessionId);
    setFormInterval(current?.refresh_interval ? String(current.refresh_interval) : '');
    await handleSave(sessionId);
  };

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-semibold mb-4">Token Ujian (Admin)</h1>
        <p className="text-sm text-slate-500 mb-4">
          Kelola token akses untuk sesi ujian. Token dapat diatur manual dan/atau
          diubah secara berkala.
        </p>
        <button
          className="px-3 py-2 bg-blue-600 text-white rounded mb-4"
          onClick={loadSessions}
          disabled={loading}
        >
          Refresh
        </button>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            {editingSession && (
              <tbody className="bg-gray-50">
                <tr>
                  <td colSpan={5} className="p-4">
                    <div className="rounded border p-4 bg-white">
                      <h3 className="font-semibold mb-2">Buat/Ubah Token</h3>
                      <div className="mb-4">
                        <label className="block text-sm font-medium">Token</label>
                        <input
                          value={formToken}
                          onChange={(e) => setFormToken(e.target.value)}
                          placeholder="5 karakter alfanumerik"
                          className="input mt-1 w-full"
                        />
                        <button
                          type="button"
                          className="mt-2 rounded bg-gray-200 px-3 py-1 text-sm"
                          onClick={() => setFormToken(makeRandomToken(5))}
                        >
                          Generate Token
                        </button>
                      </div>
                      <div className="mb-4">
                        <label className="block text-sm font-medium">
                          Back-refresh interval (menit, kosong = manual)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={formInterval}
                          onChange={(e) => setFormInterval(e.target.value)}
                          placeholder="0 untuk manual"
                          className="input mt-1 w-full"
                        />
                      </div>
                      <div className="flex gap-2 mt-4">
                        <button
                          className="rounded bg-blue-600 px-4 py-2 text-white"
                          onClick={() => handleSave(editingSession!)}
                        >
                          Simpan
                        </button>
                        <button
                          className="rounded border px-4 py-2"
                          onClick={() => setEditingSession(null)}
                        >
                          Batal
                        </button>
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
                <th className="py-2">Interval</th>
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
                    <td className="py-2">{tok?.token ?? '-'}</td>
                    <td className="py-2">
                      {tok?.refresh_interval ? `${tok.refresh_interval}m` : '-'}
                    </td>
                    <td className="py-2">{tok?.manual ? 'Ya' : 'Tidak'}</td>
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
                        <button
                          className="px-2 py-1 bg-blue-500 text-white rounded"
                          onClick={() => handleRefresh(s.id)}
                        >
                          Refresh
                        </button>
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
