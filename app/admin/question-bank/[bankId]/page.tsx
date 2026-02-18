"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type PageProps = {
  params: Promise<{ bankId: string }>;
};

type QuestionBankDetail = {
  id: string;
  title: string;
  subject: string | null;
  owner_teacher_id: string;
};

export default function QuestionBankDetailPage({ params }: PageProps) {
  const [bankId, setBankId] = useState("");
  const [bank, setBank] = useState<QuestionBankDetail | null>(null);
  const [message, setMessage] = useState("Memuat bank soal...");

  useEffect(() => {
    async function load() {
      const resolved = await params;
      setBankId(resolved.bankId);

      try {
        const response = await fetch(`/api/admin/question-banks/${resolved.bankId}`, {
          cache: "no-store",
        });
        const result = (await response.json()) as {
          data?: QuestionBankDetail;
          error?: string;
        };

        if (!response.ok) {
          setMessage(result.error ?? "Gagal memuat detail bank soal");
          return;
        }

        setBank(result.data ?? null);
        setMessage("");
      } catch {
        setMessage("Terjadi kesalahan saat memuat detail bank soal");
      }
    }

    void load();
  }, [params]);

  return (
    <main className="min-h-screen px-6 py-8 text-slate-800">
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Buat Soal</h1>
            <p className="text-sm text-slate-500">ID Bank: {bankId}</p>
          </div>
          <Link href="/admin/question-bank" className="rounded-lg border border-slate-300 px-4 py-2 text-sm">
            Kembali ke Bank Soal
          </Link>
        </header>

        {message ? (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">{message}</p>
        ) : null}

        {bank ? (
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Bank Soal</p>
            <p className="text-lg font-semibold">{bank.title}</p>
            <p className="text-sm text-slate-500">Mapel: {bank.subject ?? "Umum"}</p>
            <p className="mt-3 text-sm text-slate-600">
              Halaman pembuatan soal per bank sudah disiapkan. Tahap selanjutnya kita lanjutkan fitur input soal di sini.
            </p>
          </section>
        ) : null}
      </div>
    </main>
  );
}
