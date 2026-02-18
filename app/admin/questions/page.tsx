"use client";

import { useEffect, useState } from "react";

type Question = {
  id: string;
  subject?: string;
  prompt: string;
  question_type?: string;
  max_score?: number;
};

export default function QuestionsListPage() {
  const [questions, setQuestions] = useState<Question[]>([]);

  async function load() {
    const res = await fetch('/api/admin/questions');
    if (res.ok) setQuestions(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function remove(id: string) {
    if (!confirm('Hapus soal ini?')) return;
    const res = await fetch(`/api/admin/questions/${id}`, { method: 'DELETE' });
    if (res.ok) load();
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold">Daftar Soal</h1>
          <div className="space-x-2">
            <a href="/admin/questions/import" className="btn">Import CSV</a>
            <a href="/admin/questions/create" className="btn btn-primary">Buat Soal</a>
          </div>
        </div>

        <div className="space-y-2">
          {questions.map((q) => (
            <div key={q.id} className="rounded border px-4 py-3 flex justify-between">
              <div>
                <div className="font-medium">{q.id} • {q.question_type}</div>
                <div className="text-sm text-slate-600">{q.prompt}</div>
              </div>
              <div className="flex gap-2">
                <a href={`/admin/questions/${q.id}`} className="text-blue-600">Edit</a>
                <button onClick={() => remove(q.id)} className="text-red-600">Hapus</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
