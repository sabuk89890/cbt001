import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type ImportRow = {
  username?: string;
  fullName?: string;
  className?: string;
  password?: string;
  email?: string;
  photoUrl?: string;
};

type ImportPayload = {
  rows?: ImportRow[];
};

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

function buildEmail(username: string, email?: string) {
  const cleaned = email?.trim().toLowerCase();
  return cleaned && cleaned.length > 0 ? cleaned : `${normalizeUsername(username)}@cbt.local`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ImportPayload;
    const rows = body.rows ?? [];

    if (rows.length === 0) {
      return NextResponse.json({ error: "rows wajib diisi" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const failures: Array<{ row: number; message: string }> = [];
    let successCount = 0;

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];

      if (!row.username || !row.fullName || !row.className) {
        failures.push({
          row: index + 1,
          message: "username, fullName, dan className wajib diisi",
        });
        continue;
      }

      const username = normalizeUsername(row.username);
      const email = buildEmail(username, row.email);
      const password = row.password?.trim() || "10105158";

      const { data: authUserData, error: createAuthError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: row.fullName,
        },
      });

      if (createAuthError || !authUserData.user) {
        failures.push({
          row: index + 1,
          message: createAuthError?.message ?? "Gagal membuat user auth",
        });
        continue;
      }

      let profileError = (
        await supabase.from("profiles").insert({
          id: authUserData.user.id,
          role: "student",
          username,
          full_name: row.fullName,
          class_name: row.className,
          photo_url: row.photoUrl ?? null,
        })
      ).error;

      if (profileError?.message?.includes("photo_url")) {
        profileError = (
          await supabase.from("profiles").insert({
            id: authUserData.user.id,
            role: "student",
            username,
            full_name: row.fullName,
            class_name: row.className,
          })
        ).error;
      }

      if (profileError) {
        await supabase.auth.admin.deleteUser(authUserData.user.id);
        failures.push({ row: index + 1, message: profileError.message });
        continue;
      }

      successCount += 1;
    }

    return NextResponse.json({
      imported: successCount,
      failed: failures.length,
      failures,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
