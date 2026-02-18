import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type BulkDeletePayload = {
  mode?: "ids" | "class";
  ids?: string[];
  className?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as BulkDeletePayload;
    const supabase = createSupabaseAdminClient();

    let targetIds: string[] = [];

    if (body.mode === "ids") {
      targetIds = (body.ids ?? []).filter(Boolean);
    } else if (body.mode === "class") {
      if (!body.className) {
        return NextResponse.json({ error: "className wajib diisi" }, { status: 400 });
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "student")
        .eq("class_name", body.className);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      targetIds = (data ?? []).map((item) => item.id as string);
    } else {
      return NextResponse.json({ error: "mode harus ids atau class" }, { status: 400 });
    }

    if (targetIds.length === 0) {
      return NextResponse.json({ message: "Tidak ada data yang dihapus", deleted: 0 });
    }

    const failedIds: string[] = [];
    for (const id of targetIds) {
      const { error } = await supabase.auth.admin.deleteUser(id);
      if (error) {
        failedIds.push(id);
      }
    }

    return NextResponse.json({
      deleted: targetIds.length - failedIds.length,
      failed: failedIds.length,
      failedIds,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
