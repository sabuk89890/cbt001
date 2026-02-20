"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

export default function EditQuestionPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/admin/questions/${id}`);
      if (res.ok) setData(await res.json());
    }
    if (id) load();
  }, [id]);

  async function save(e: any) {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.target) as any);
    const payload = { ...form, options: JSON.parse(form.options) };
    const res = await fetch(`/api/admin/questions/${id}`, { method: 'PATCH', headers: { 'content-type':'application/json' }, body: JSON.stringify(payload) });
    if (res.ok) router.push('/admin/questions');
    else alert('Gagal menyimpan');
  }

  if (!data) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold mb-4">Edit Soal</h1>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="block text-sm">ID</label>
            <input name="id" defaultValue={data.id} disabled className="input" />
          </div>
          <div>
            <label className="block text-sm">Prompt</label>
            <textarea name="prompt" defaultValue={data.prompt} className="input" />
          </div>
          <div>
            <label className="block text-sm">Options (JSON)</label>
            <textarea name="options" defaultValue={JSON.stringify(data.options || [])} className="input" />
          </div>
          <div>
            <button className="btn btn-primary">Simpan</button>
          </div>
        </form>
      </div>
    </div>
  );
}
