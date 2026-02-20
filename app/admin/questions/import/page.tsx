"use client";

import { useState } from "react";

export default function ImportQuestionsPage() {
  const [file, setFile] = useState<File | null>(null);

  function parseCSV(text: string) {
    const lines = text.split(/\r?\n/).filter(Boolean);
    const rows = lines.map((l) => l.split(',').map((c) => c.trim()));
    const objs = rows.map((cols) => {
      // expected: id,subject,question_type,prompt,options_json,correct_answer,max_score,bank_id
      return {
        id: cols[0],
        subject: cols[1],
        question_type: cols[2],
        prompt: cols[3],
        options: JSON.parse(cols[4] || '[]'),
        correct_answer: cols[5],
        max_score: parseInt(cols[6] || '1', 10) || 1,
        bank_id: cols[7] || null,
      };
    });
    return objs;
  }

  async function upload() {
    if (!file) return alert('Pilih file CSV');
    const txt = await file.text();
    const data = parseCSV(txt);
    const res = await fetch('/api/admin/questions/import', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rows: data }) });
    if (res.ok) {
      alert('Import sukses');
      location.href = '/admin/questions';
    } else {
      alert('Import gagal');
    }
  }

  return (
    <div className="p-8">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold mb-4">Import Soal dari CSV</h1>
        <p className="text-sm text-slate-600 mb-4">Format CSV: id,subject,question_type,prompt,options_json,correct_answer,max_score,bank_id</p>
        <input type="file" accept=".csv" onChange={(e)=>setFile(e.target.files?.[0] ?? null)} />
        <div className="mt-4">
          <button onClick={upload} className="btn btn-primary">Upload</button>
        </div>
      </div>
    </div>
  );
}
