import Link from "next/link";
import EssayGradeButton from '@/components/admin/essay-grade-button';
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type AdminReviewPageProps = {
  searchParams: Promise<{
    kelas?: string;
    bank?: string;
    q?: string;
  }>;
};

type GradingItem = { questionId?: string };

export default async function AdminReviewPage({ searchParams }: AdminReviewPageProps) {
  const { kelas = "all", bank = "all", q = "" } = await searchParams;
  const supabase = createSupabaseAdminClient();

  // helper: format seconds -> human friendly (s/m/h m)
  const formatDuration = (secs: number | null | undefined) => {
    if (secs === null || secs === undefined) return '-';
    const s = Number(secs || 0);
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s/60)}m`;
    const h = Math.floor(s/3600);
    const m = Math.floor((s % 3600)/60);
    return `${h}h ${m}m`;
  };

  let query = supabase
    .from("exam_submissions")
    .select("id, session_id, student_id, score, status, review_status, needs_manual_review, grading_detail, created_at")
    .order("created_at", { ascending: false })
    .limit(50);



  const { data, error } = await query;

  const submissions = data ?? [];
  const studentIds = [...new Set(submissions.map((item) => item.student_id).filter(Boolean))] as string[];

  let studentProfiles = new Map<string, { fullName: string | null; className: string | null }>();

  if (studentIds.length > 0) {
    const withClass = await supabase
      .from("profiles")
      .select("id, full_name, class_name")
      .in("id", studentIds);

    if (withClass.error) {
      const fallback = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", studentIds);

      if (!fallback.error) {
        studentProfiles = new Map(
          (fallback.data ?? []).map((item) => [
            item.id,
            { fullName: item.full_name, className: null },
          ])
        );
      }
    } else {
      studentProfiles = new Map(
        (withClass.data ?? []).map((item) => [
          item.id,
          {
            fullName: item.full_name,
            className: (item as { class_name?: string | null }).class_name ?? null,
          },
        ])
      );
    }
  }

  const questionIds = [
    ...new Set(
      submissions
        .flatMap((item) => (Array.isArray(item.grading_detail) ? (item.grading_detail as GradingItem[]) : []))
        .map((detail) => detail.questionId)
        .filter((id): id is string => typeof id === "string")
    ),
  ];

  const subjectByQuestionId = new Map<string, string>();
  if (questionIds.length > 0) {
    const { data: questionRows } = await supabase
      .from("questions")
      .select("id, subject")
      .in("id", questionIds);

    for (const row of questionRows ?? []) {
      subjectByQuestionId.set(row.id, row.subject ?? "Umum");
    }
  }

  const enrichedRows = submissions.map((item) => {
    const details = Array.isArray(item.grading_detail) ? (item.grading_detail as GradingItem[]) : [];
    const subjects = [
      ...new Set(
        details
          .map((detail) => (detail.questionId ? subjectByQuestionId.get(detail.questionId) : null))
          .filter((subject): subject is string => Boolean(subject))
      ),
    ];

    const profile = item.student_id ? studentProfiles.get(item.student_id) : undefined;
    const className = profile?.className ?? "-";

    return {
      ...item,
      subjects,
      studentName: profile?.fullName ?? null,
      className,
    };
  });

  // build bank options (show all banks) and map session->bank; also compute per-participant duration
  const sessionIds = [...new Set(enrichedRows.map((r) => r.session_id).filter(Boolean))];
  const studentIdsForSubs = [...new Set(enrichedRows.map((r) => r.student_id).filter(Boolean))];

  // map session -> bank (for item lookup)
  let bankBySession = new Map<string, { id: string; title: string }>();

  if (sessionIds.length > 0) {
    const { data: sessions } = await supabase
      .from('exam_sessions')
      .select('id, bank_id')
      .in('id', sessionIds as string[]);

    const bankIds = [...new Set((sessions ?? []).map((s: any) => s.bank_id).filter(Boolean))];
    if (bankIds.length > 0) {
      const { data: banks } = await supabase.from('question_banks').select('id, title').in('id', bankIds as string[]);
      const bankMap = new Map((banks ?? []).map((b: any) => [b.id, b.title]));
      for (const s of sessions ?? []) {
        bankBySession.set(s.id, { id: s.bank_id, title: bankMap.get(s.bank_id) ?? '-' });
      }
    }
  }

  // fetch ALL banks for filter dropdown (so buttons are always available)
  const { data: allBanks } = await supabase.from('question_banks').select('id, title');
  const bankList = (allBanks ?? []).map((b: any) => ({ id: b.id, title: b.title }));

  // fetch profiles/classes for kelas filter (show all known classes)
  const { data: profileClasses } = await supabase.from('profiles').select('class_name').not('class_name', 'is', null);
  const kelasOptions = Array.from(new Set((profileClasses ?? []).map((p: any) => p.class_name).filter(Boolean))).sort();

  // fetch participant timing rows so we can compute duration_seconds per submission
  const participantMap = new Map<string, any>();
  if (sessionIds.length && studentIdsForSubs.length) {
    const { data: parts } = await supabase
      .from('exam_participants')
      .select('session_id, student_id, started_at, finished_at, created_at')
      .in('session_id', sessionIds as string[])
      .in('student_id', studentIdsForSubs as string[]);
    (parts ?? []).forEach((p: any) => participantMap.set(`${p.session_id}::${p.student_id}`, p));
  }

  // attach duration_seconds to enriched rows
  const enrichedWithDuration = (enrichedRows ?? []).map((item) => {
    const part = participantMap.get(`${item.session_id}::${item.student_id}`) ?? null;
    let durationSeconds: number | null = null;
    try {
      const started = part?.started_at ? Date.parse(String(part.started_at)) : null;
      const finished = part?.finished_at ? Date.parse(String(part.finished_at)) : Date.parse(String(item.created_at));
      if (started && finished) durationSeconds = Math.max(0, Math.round((finished - started) / 1000));
    } catch (e) {
      durationSeconds = null;
    }
    return { ...item, duration_seconds: durationSeconds };
  });

  const filteredRows = enrichedWithDuration.filter((item) => {
    const classOk = kelas === "all" ? true : item.className === kelas;
    const bankForItem = bankBySession.get(item.session_id)?.id ?? null;
    const bankOk = bank === "all" ? true : bankForItem === bank;
    const qOk = !q ? true : (item.studentName ?? "").toLowerCase().includes(String(q).toLowerCase()) || (item.student_id ?? "").toLowerCase().includes(String(q).toLowerCase());
    return classOk && bankOk && qOk;
  });

  function buildFilterHref(next: { kelas?: string; bank?: string; q?: string } = {}) {
    const params = new URLSearchParams({
      kelas,
      bank,
      q: String(q ?? ""),
      ...next,
    } as Record<string,string>);
    return `/admin/review?${params.toString()}`;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-6 py-12">
      <header className="space-y-2">
            <h1 className="text-2xl font-semibold">Review Manual Guru</h1>
            <p className="text-sm opacity-80">
              Filter review berdasarkan kelas dan bank.
            </p>
          </header>

      <section className="space-y-3 rounded-lg border p-4">


          <form method="get" className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <span className="px-1 py-1 opacity-70">Kelas:</span>
            <select name="kelas" defaultValue={kelas} className="rounded border px-3 py-2 text-sm">
              <option value="all">Semua</option>
              {kelasOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <span className="px-1 py-1 opacity-70">Bank:</span>
            <select name="bank" defaultValue={bank} className="rounded border px-3 py-2 text-sm">
              <option value="all">Semua</option>
              {bankList.map((b) => (
                <option key={b.id} value={b.id}>{b.title}</option>
              ))}
            </select>
          </label>

          <div className="ml-auto flex items-center gap-2">
            <input name="q" defaultValue={String(q)} placeholder="Cari nama atau id siswa" className="rounded border px-3 py-2 text-sm w-72" />
            <button type="submit" className="rounded-md border px-3 py-2 text-sm">Cari</button>
          </div>
        </form>
      </section>

      {error ? <p className="text-sm">Gagal memuat data: {error.message}</p> : null}

      <section className="rounded-lg border">
        <ul className="divide-y">
          {filteredRows.map((item) => (
            <li key={item.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">Submission {item.id}</p>
                <p className="text-xs opacity-70">
                  Session: {item.session_id} • Student: {item.studentName ?? item.student_id ?? "anon"}
                </p>
                <p className="text-xs opacity-70">
                  Score: {item.score} • Status: {item.status} • Review: {item.review_status} • Kelas: {item.className} • Durasi: {formatDuration(item.duration_seconds)}
                </p>
                <p className="text-xs opacity-70">
                  Mapel: {item.subjects.length > 0 ? item.subjects.join(", ") : "-"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {(Array.isArray(item.grading_detail) && item.grading_detail.some((d:any)=>d.questionType === 'essay')) ? (
                  <EssayGradeButton sessionId={item.session_id} submissionId={item.id} studentName={item.studentName ?? item.student_id} />
                ) : null}

                <Link
                  href={`/admin/review/${item.session_id}/${item.id}`}
                  className="rounded-md border px-3 py-1 text-sm"
                >
                  Buka Review
                </Link>
              </div>
            </li>
          ))}
          {!error && filteredRows.length === 0 ? (
            <li className="p-4 text-sm">Tidak ada data review untuk filter yang dipilih.</li>
          ) : null}
        </ul>
      </section>
    </main>
  );
}
