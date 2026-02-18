import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type CreateUserPayload = {
  role?: "guru" | "student";
  username?: string;
  fullName?: string;
  className?: string | null;
  password?: string;
  email?: string;
  photoUrl?: string | null;
};

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

function buildAuthEmail(username: string, providedEmail?: string) {
  const trimmed = providedEmail?.trim().toLowerCase();
  if (trimmed) {
    return trimmed;
  }

  return `${normalizeUsername(username)}@cbt.local`;
}

export async function GET(request: Request) {
  try {
    const supabase = createSupabaseAdminClient();
    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role");
    const className = searchParams.get("className");

    let query = supabase
      .from("profiles")
      .select("id, role, username, full_name, class_name, photo_url, created_at")
      .order("created_at", { ascending: false });

    if (role) {
      query = query.eq("role", role);
    }

    if (className) {
      query = query.eq("class_name", className);
    }

    const { data, error } = await query;

    if (error?.message?.includes("photo_url")) {
      let fallbackQuery = supabase
        .from("profiles")
        .select("id, role, username, full_name, class_name, created_at")
        .order("created_at", { ascending: false });

      if (role) {
        fallbackQuery = fallbackQuery.eq("role", role);
      }

      if (className) {
        fallbackQuery = fallbackQuery.eq("class_name", className);
      }

      const fallbackResult = await fallbackQuery;
      if (fallbackResult.error) {
        return NextResponse.json({ error: fallbackResult.error.message }, { status: 500 });
      }

      return NextResponse.json({
        data: (fallbackResult.data ?? []).map((item) => ({
          ...item,
          photo_url: null,
        })),
      });
    }

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
    const body = (await request.json()) as CreateUserPayload;

    if (!body.role || !body.username || !body.fullName) {
      return NextResponse.json(
        { error: "role, username, dan fullName wajib diisi" },
        { status: 400 }
      );
    }

    if (![
      "guru",
      "student",
    ].includes(body.role)) {
      return NextResponse.json(
        { error: "role harus guru atau student" },
        { status: 400 }
      );
    }

    const username = normalizeUsername(body.username);
    const authEmail = buildAuthEmail(username, body.email);
    const password = body.password?.trim() || "10105158";

    const supabase = createSupabaseAdminClient();

    const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: body.fullName,
      },
    });

    if (createUserError || !createdUser.user) {
      const status = createUserError?.status ?? 500;
      return NextResponse.json(
        { error: createUserError?.message ?? "Gagal membuat akun auth" },
        { status }
      );
    }

    let profileError = (
      await supabase.from("profiles").insert({
        id: createdUser.user.id,
        role: body.role,
        username,
        full_name: body.fullName,
        class_name: body.role === "student" ? body.className ?? null : null,
        photo_url: body.photoUrl ?? null,
      })
    ).error;

    if (profileError?.message?.includes("photo_url")) {
      profileError = (
        await supabase.from("profiles").insert({
          id: createdUser.user.id,
          role: body.role,
          username,
          full_name: body.fullName,
          class_name: body.role === "student" ? body.className ?? null : null,
        })
      ).error;
    }

    if (profileError) {
      await supabase.auth.admin.deleteUser(createdUser.user.id);
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        data: {
          id: createdUser.user.id,
          role: body.role,
          username,
          full_name: body.fullName,
          class_name: body.role === "student" ? body.className ?? null : null,
          photo_url: body.photoUrl ?? null,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
