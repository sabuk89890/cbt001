"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

export default function EditQuestionPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [data, setData] = useState<any>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [message, setMessage] = useState("");
  const MAX_IMAGE_SIZE = 100 * 1024;

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/admin/questions/${id}`);
      if (res.ok) {
        const d = await res.json();
        setData(d);
        setImageUrl(typeof d.answerKey?.imageUrl === 'string' ? d.answerKey.imageUrl : '');
      }
    }
    if (id) load();
  }, [id]);

  function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_SIZE) {
      setMessage("Ukuran gambar melebihi 100KB");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImageUrl(typeof reader.result === "string" ? reader.result : "");
      setMessage("");
    };
    reader.readAsDataURL(file);
  }

  async function save(e: any) {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.target) as any);
    const payload: any = { ...form, options: JSON.parse(form.options) };
    if (imageUrl) payload.answer_key = { imageUrl };
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
          {message ? <p className="text-sm text-red-600">{message}</p> : null}
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
            <label className="block text-sm">Upload Gambar (opsional, max 100KB)</label>
            <input type="file" accept="image/*" onChange={handleImageChange} className="input" />
            {imageUrl && (
              <div className="mt-2">
                <img src={imageUrl} alt="Preview" className="max-h-40" />
                <button type="button" onClick={()=>setImageUrl("")} className="text-sm text-red-600">Hapus</button>
              </div>
            )}
          </div>
          <div>
            <button className="btn btn-primary">Simpan</button>
          </div>
        </form>
      </div>
    </div>
  );
}
