"use client";

import { useState } from "react";

export default function CreateQuestionPage() {
  const [id, setId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [questionType, setQuestionType] = useState("multiple-choice");
  const [optionsJson, setOptionsJson] = useState("[]");
  const [correctAnswer, setCorrectAnswer] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { id, prompt, question_type: questionType, options: JSON.parse(optionsJson), correct_answer: correctAnswer };
    const res = await fetch('/api/admin/questions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.ok) {
      alert('Soal dibuat');
      location.href = '/admin/questions';
    } else {
      alert('Gagal membuat soal');
    }
  }

  return (
    <div className="p-8">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold mb-4">Buat Soal Baru</h1>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm">ID (unik)</label>
            <input value={id} onChange={(e)=>setId(e.target.value)} className="input" />
          </div>
          <div>
            <label className="block text-sm">Tipe Soal</label>
            <select value={questionType} onChange={(e)=>setQuestionType(e.target.value)} className="input">
              <option value="multiple-choice">Multiple Choice</option>
              <option value="essay">Essay</option>
              <option value="matching">Matching</option>
            </select>
          </div>
          <div>
            <label className="block text-sm">Prompt</label>
            <textarea value={prompt} onChange={(e)=>setPrompt(e.target.value)} className="input" />
          </div>
          <div>
            <label className="block text-sm">Options (JSON)</label>
            <textarea value={optionsJson} onChange={(e)=>setOptionsJson(e.target.value)} className="input" />
          </div>
          <div>
            <label className="block text-sm">Correct Answer</label>
            <input value={correctAnswer} onChange={(e)=>setCorrectAnswer(e.target.value)} className="input" />
          </div>
          <div>
            <button type="submit" className="btn btn-primary">Simpan</button>
          </div>
        </form>
      </div>
    </div>
  );
}
