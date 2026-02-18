const scoreItems = [
  {
    exam: "Tryout Matematika",
    score: 85,
    status: "Lulus",
  },
  {
    exam: "Bahasa Indonesia",
    score: 72,
    status: "Remedial",
  },
];

export default function ScorePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-6 py-12">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Hasil Ujian</h1>
        <p className="text-sm opacity-80">
          Placeholder rekap nilai per siswa / peserta.
        </p>
      </header>

      <section className="rounded-lg border">
        <ul className="divide-y">
          {scoreItems.map((item) => (
            <li key={item.exam} className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">{item.exam}</p>
                <p className="text-sm opacity-70">Status: {item.status}</p>
              </div>
              <p className="text-xl font-semibold">{item.score}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
