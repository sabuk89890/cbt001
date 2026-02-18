import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type ExamSessionRow = {
  id: string;
  title: string | null;
  created_at: string;
};

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();

    const [guruResult, siswaResult, ujianResult, hasilResult, latestExamResult] =
      await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "guru"),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student"),
        supabase.from("exam_sessions").select("id", { count: "exact", head: true }),
        supabase.from("exam_submissions").select("id", { count: "exact", head: true }),
        supabase
          .from("exam_sessions")
          .select("id, title, created_at")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

    const firstError =
      guruResult.error ??
      siswaResult.error ??
      ujianResult.error ??
      hasilResult.error ??
      latestExamResult.error;

    if (firstError) {
      return NextResponse.json({ error: firstError.message }, { status: 500 });
    }

    const latestExams = ((latestExamResult.data as ExamSessionRow[] | null) ?? []).map((item) => ({
      id: item.id,
      title: item.title ?? item.id,
      createdAt: item.created_at,
    }));

    return NextResponse.json({
      data: {
        totalGuru: guruResult.count ?? 0,
        totalSiswa: siswaResult.count ?? 0,
        ujianAktif: ujianResult.count ?? 0,
        totalHasil: hasilResult.count ?? 0,
        latestExams,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
