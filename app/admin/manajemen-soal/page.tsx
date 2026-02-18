import Link from "next/link";

export default function ManajemenSoalPage() {
  return (
    <div className="p-8">
      <div className="max-w-4xl">
        <h1 className="text-2xl font-semibold mb-4">Manajemen Soal</h1>
        <p className="text-sm text-slate-600 mb-6">Halaman untuk mengelola soal, unggah batch, dan atur bank soal.</p>

        <div className="space-y-3">
          <Link href="/admin/question-bank" className="block rounded-lg border px-4 py-3 hover:bg-slate-50">
            Lihat Bank Soal
          </Link>

          <Link href="/admin/questions/create" className="block rounded-lg border px-4 py-3 hover:bg-slate-50">
            Buat Soal Baru
          </Link>

          <Link href="/admin/questions/import" className="block rounded-lg border px-4 py-3 hover:bg-slate-50">
            Import dari CSV
          </Link>
        </div>
      </div>
    </div>
  );
}
