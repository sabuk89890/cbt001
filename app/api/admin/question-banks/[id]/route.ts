import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type UpdateQuestionBankPayload = {
  title?: string;
  subject?: string;
  ownerTeacherId?: string;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from("question_banks")
      .select("id, title, subject, owner_teacher_id, created_at, updated_at")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Bank soal tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as UpdateQuestionBankPayload;

    const title = body.title?.trim();
    const subject = body.subject?.trim() || null;
    const ownerTeacherId = body.ownerTeacherId?.trim();

    if (!title || !ownerTeacherId) {
      return NextResponse.json(
        { error: "title dan ownerTeacherId wajib diisi" },
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

    const { error } = await supabase
      .from("question_banks")
      .update({
        title,
        subject,
        owner_teacher_id: ownerTeacherId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Bank soal berhasil diperbarui" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = createSupabaseAdminClient();

    const { error } = await supabase.from("question_banks").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Bank soal berhasil dihapus" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
