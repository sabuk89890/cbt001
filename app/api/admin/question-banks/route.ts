import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type CreateQuestionBankPayload = {
  title?: string;
  subject?: string;
  targetClasses?: string[];
  ownerTeacherId?: string;
};

type QuestionBankRow = {
  id: string;
  title: string;
  subject: string | null;
  target_classes: string[] | null;
  owner_teacher_id: string;
  created_at: string;
  updated_at: string;
};

function normalizeClassList(values: string[] | undefined) {
  if (!values) {
    return [] as string[];
  }

  return [...new Set(values.map((item) => item.trim()).filter((item) => item.length > 0))];
}

function mapOwnerName(fullName: string | null, username: string | null) {
  return fullName ?? username ?? "Guru";
}

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();

    const { data: banks, error: banksError } = await supabase
      .from("question_banks")
      .select("id, title, subject, target_classes, owner_teacher_id, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (banksError) {
      return NextResponse.json({ error: banksError.message }, { status: 500 });
    }

    const bankRows = (banks ?? []) as QuestionBankRow[];
    const ownerIds = [...new Set(bankRows.map((item) => item.owner_teacher_id))];

    let ownerMap = new Map<string, { full_name: string | null; username: string | null }>();
    if (ownerIds.length > 0) {
      const { data: owners, error: ownersError } = await supabase
        .from("profiles")
        .select("id, full_name, username")
        .in("id", ownerIds);

      if (ownersError) {
        return NextResponse.json({ error: ownersError.message }, { status: 500 });
      }

      ownerMap = new Map(
        (owners ?? []).map((owner) => [owner.id as string, {
          full_name: (owner as { full_name: string | null }).full_name,
          username: (owner as { username: string | null }).username,
        }])
      );
    }

    let questionCountMap = new Map<string, number>();
    const questionResult = await supabase.from("questions").select("bank_id");

    if (!questionResult.error) {
      questionCountMap = new Map<string, number>();
      for (const question of questionResult.data ?? []) {
        const bankId = (question as { bank_id?: string | null }).bank_id;
        if (!bankId) {
          continue;
        }

        questionCountMap.set(bankId, (questionCountMap.get(bankId) ?? 0) + 1);
      }
    }

    const { data: classesData, error: classesError } = await supabase
      .from("profiles")
      .select("class_name")
      .eq("role", "student")
      .not("class_name", "is", null);

    if (classesError) {
      return NextResponse.json({ error: classesError.message }, { status: 500 });
    }

    const classOptions = [...new Set(
      (classesData ?? [])
        .map((item) => (item as { class_name: string | null }).class_name)
        .filter((value): value is string => Boolean(value))
    )].sort((a, b) => a.localeCompare(b));

    return NextResponse.json({
      data: bankRows.map((item) => {
        const owner = ownerMap.get(item.owner_teacher_id);

        return {
          id: item.id,
          title: item.title,
          subject: item.subject,
          targetClasses: item.target_classes ?? [],
          ownerTeacherId: item.owner_teacher_id,
          ownerTeacherName: mapOwnerName(owner?.full_name ?? null, owner?.username ?? null),
          questionCount: questionCountMap.get(item.id) ?? 0,
          createdAt: item.created_at,
          updatedAt: item.updated_at,
        };
      }),
      classOptions,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateQuestionBankPayload;

    const title = body.title?.trim();
    const subject = body.subject?.trim() || null;
    const targetClasses = normalizeClassList(body.targetClasses);
    const ownerTeacherId = body.ownerTeacherId?.trim();

    if (!title || !ownerTeacherId || targetClasses.length === 0) {
      return NextResponse.json(
        { error: "title, targetClasses, dan ownerTeacherId wajib diisi" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    const { data: owner, error: ownerError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", ownerTeacherId)
      .maybeSingle();

    if (ownerError) {
      return NextResponse.json({ error: ownerError.message }, { status: 500 });
    }

    if (!owner || owner.role !== "guru") {
      return NextResponse.json({ error: "Pemilik bank soal harus guru" }, { status: 400 });
    }

    const { data: existingClasses, error: classError } = await supabase
      .from("profiles")
      .select("class_name")
      .eq("role", "student")
      .in("class_name", targetClasses);

    if (classError) {
      return NextResponse.json({ error: classError.message }, { status: 500 });
    }

    const validClassSet = new Set(
      (existingClasses ?? [])
        .map((item) => (item as { class_name: string | null }).class_name)
        .filter((value): value is string => Boolean(value))
    );

    if (targetClasses.some((item) => !validClassSet.has(item))) {
      return NextResponse.json({ error: "Ada kelas yang tidak valid" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("question_banks")
      .insert({
        title,
        subject,
        target_classes: targetClasses,
        owner_teacher_id: ownerTeacherId,
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
