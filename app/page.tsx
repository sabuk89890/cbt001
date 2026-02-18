import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-12">
        <header className="space-y-3">
          <h1 className="text-3xl font-semibold">CBT Platform Starter</h1>
          <p className="text-sm opacity-80">
            Starter project untuk ujian berbasis komputer: autentikasi, bank
            soal, sesi ujian, dan penilaian.
          </p>
        </header>

        <section className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/auth/admin"
            className="rounded-lg border px-4 py-3 hover:bg-foreground/5"
          >
            Login Admin
          </Link>
          <Link
            href="/auth/student"
            className="rounded-lg border px-4 py-3 hover:bg-foreground/5"
          >
            Login Siswa
          </Link>
          <Link
            href="/admin/question-bank"
            className="rounded-lg border px-4 py-3 hover:bg-foreground/5"
          >
            Bank Soal (CRUD Placeholder)
          </Link>
          <Link
            href="/admin/review"
            className="rounded-lg border px-4 py-3 hover:bg-foreground/5"
          >
            Review Manual Guru
          </Link>
          <Link
            href="/exam/demo-session"
            className="rounded-lg border px-4 py-3 hover:bg-foreground/5"
          >
            Mulai Ujian (Demo Session)
          </Link>
          <Link
            href="/score"
            className="rounded-lg border px-4 py-3 hover:bg-foreground/5"
          >
            Lihat Nilai
          </Link>
        </section>
      </main>
    </div>
  );
}
