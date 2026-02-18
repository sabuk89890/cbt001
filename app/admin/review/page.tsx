import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type AdminReviewPageProps = {
  searchParams: Promise<{
    status?: "pending" | "reviewed" | "all";
    mapel?: string;
    kelas?: string;
  }>;
};

type GradingItem = { questionId?: string };

export default async function AdminReviewPage({ searchParams }: AdminReviewPageProps) {
  const { status = "pending", mapel = "all", kelas = "all" } = await searchParams;
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from("exam_submissions")
    .select("id, session_id, student_id, score, status, review_status, needs_manual_review, grading_detail, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (status === "pending") {
    query = query.eq("needs_manual_review", true);
  }

  if (status === "reviewed") {
    query = query.eq("review_status", "reviewed");
  }

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

  const kelasOptions = [...new Set(enrichedRows.map((item) => item.className).filter((v) => v && v !== "-"))].sort();
  const mapelOptions = [...new Set(enrichedRows.flatMap((item) => item.subjects))].sort();

  const filteredRows = enrichedRows.filter((item) => {
    const classOk = kelas === "all" ? true : item.className === kelas;
    const mapelOk = mapel === "all" ? true : item.subjects.includes(mapel);
    return classOk && mapelOk;
  });

  function buildFilterHref(next: { status?: string; mapel?: string; kelas?: string }) {
    const params = new URLSearchParams({
      status,
      mapel,
      kelas,
      ...next,
    });
    return `/admin/review?${params.toString()}`;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-6 py-12">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Review Manual Guru</h1>
        <p className="text-sm opacity-80">
          Filter review berdasarkan status, mapel, dan kelas.
        </p>
      </header>

      <section className="space-y-3 rounded-lg border p-4">
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href={buildFilterHref({ status: "pending" })} className="rounded-md border px-3 py-1">
            Pending
          </Link>
          <Link href={buildFilterHref({ status: "reviewed" })} className="rounded-md border px-3 py-1">
            Reviewed
          </Link>
          <Link href={buildFilterHref({ status: "all" })} className="rounded-md border px-3 py-1">
            Semua
          </Link>
        </div>

        <div className="flex flex-wrap gap-2 text-sm">
          <span className="px-1 py-1 opacity-70">Mapel:</span>
          <Link href={buildFilterHref({ mapel: "all" })} className="rounded-md border px-3 py-1">
            Semua
          </Link>
          {mapelOptions.map((item) => (
            <Link key={item} href={buildFilterHref({ mapel: item })} className="rounded-md border px-3 py-1">
              {item}
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 text-sm">
          <span className="px-1 py-1 opacity-70">Kelas:</span>
          <Link href={buildFilterHref({ kelas: "all" })} className="rounded-md border px-3 py-1">
            Semua
          </Link>
          {kelasOptions.map((item) => (
            <Link key={item} href={buildFilterHref({ kelas: item })} className="rounded-md border px-3 py-1">
              {item}
            </Link>
          ))}
        </div>
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
                  Score: {item.score} • Status: {item.status} • Review: {item.review_status} • Kelas: {item.className}
                </p>
                <p className="text-xs opacity-70">
                  Mapel: {item.subjects.length > 0 ? item.subjects.join(", ") : "-"}
                </p>
              </div>
              <Link
                href={`/admin/review/${item.session_id}/${item.id}`}
                className="rounded-md border px-3 py-1 text-sm"
              >
                Buka Review
              </Link>
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
