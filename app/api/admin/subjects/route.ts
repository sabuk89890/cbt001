import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type CreateSubjectPayload = {
  code?: string;
  name?: string;
};

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("subjects")
      .select("id, code, name, created_at")
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateSubjectPayload;
    const code = body.code?.trim();
    const name = body.name?.trim();

    if (!code || !name) {
      return NextResponse.json(
        { error: "code dan name wajib diisi" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("subjects")
      .insert({
        code: normalizeCode(code),
        name,
      })
      .select("id, code, name, created_at")
      .single();

    if (error) {
      const status = error.message.includes("duplicate") ? 409 : 500;
      return NextResponse.json({ error: error.message }, { status });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
