# CBT Platform Starter

Starter project CBT (Computer Based Test) dengan Next.js App Router + TypeScript + Tailwind.

## Fitur Awal

- Login admin dan siswa via Supabase Auth + validasi role
- Bank soal tersimpan di Supabase Postgres
- Dukungan tipe soal: pilihan ganda, pilihan ganda kompleks, essay, benar/salah, menjodohkan
- Submit ujian dengan auto-grading lintas tipe soal
- Essay mendukung koreksi otomatis dan koreksi ulang manual oleh guru
- API route untuk auth, bank soal, submit ujian, dan manual regrading

## Jalankan Lokal

1. Install dependency:

```bash
npm install
```

2. Buat file environment:

```bash
copy .env.example .env.local
```

3. Jalankan dev server:

```bash
npm run dev
```

4. Buka `http://localhost:3000`

## Setup Supabase

1. Buat project Supabase dan isi variabel `.env.local`.
2. Jalankan SQL di [supabase/schema.sql](supabase/schema.sql) melalui Supabase SQL Editor.
3. Jalankan seed data awal di [supabase/seed.sql](supabase/seed.sql).
4. Tambahkan user di Supabase Auth (email + password).
5. Isi tabel `profiles` dengan `id` user auth, `role`, dan `username`.
6. Login aplikasi menggunakan `username + password`.

Contoh SQL siap pakai ada di [supabase/seed-profiles.sql](supabase/seed-profiles.sql).

## Variabel Environment

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Endpoint API

- `GET /api/questions`
- `POST /api/questions`
- `PUT /api/questions/:id`
- `DELETE /api/questions/:id`
- `POST /api/auth/login`
- `POST /api/exams/:sessionId/submit`
- `PATCH /api/exams/:sessionId/submissions/:submissionId/manual-grade`

## Format Jawaban Submit

- `multiple-choice`: string
- `multiple-choice-complex`: string[]
- `essay`: string
- `true-false`: `"Benar" | "Salah" | true | false`
- `matching`: `{ left: string; right: string }[]`

## Manual Regrade Essay

Gunakan endpoint manual grade dengan payload:

```json
{
	"reviewerId": "guru-001",
	"reviewNote": "Koreksi ulang setelah peninjauan",
	"essayScores": [
		{
			"questionId": "q-003",
			"manualScore": 25,
			"notes": "Jawaban cukup baik"
		}
	]
}
```

## Halaman Review Guru

- Daftar submission butuh review: `/admin/review`
- Detail review per submission: `/admin/review/:sessionId/:submissionId`
- Tampilan soal di review menggunakan renderer yang sama dengan halaman ujian siswa.
- Daftar review mendukung filter status (`pending/reviewed/all`), mapel, dan kelas.

## Deploy ke GitHub + Vercel

1. Push project ini ke repository GitHub.
2. Import repository ke Vercel.
3. Tambahkan environment variables sesuai `.env.example` di dashboard Vercel.
4. Deploy.

## Sinkron Otomatis GitHub

- Workflow CI ada di `.github/workflows/ci.yml` dan akan jalan otomatis saat `push`/`pull request` ke `main`.
- Jika repository ini sudah terhubung ke Vercel, setiap push ke `main` otomatis trigger deploy baru.

## Catatan Lanjutan

- Tambahkan penyimpanan session berbasis cookie/JWT untuk proteksi halaman.
- Lengkapi RLS policy per role untuk operasi insert/update/delete.
- Tambahkan relasi siswa ke `exam_submissions.student_id`.
