import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseAuthClient } from "@/lib/supabase/server";

type LoginPayload = {
  identifier?: string;
  password?: string;
  role?: "admin" | "student";
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoginPayload;

    if (!body.identifier || !body.password || !body.role) {
      return NextResponse.json(
        { error: "identifier, password, dan role wajib diisi" },
        { status: 400 }
      );
    }

    const authClient = createSupabaseAuthClient();
    const adminClient = createSupabaseAdminClient();

    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
      email: body.identifier,
      password: body.password,
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message ?? "Gagal login" },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        { error: `Gagal validasi role: ${profileError.message}` },
        { status: 500 }
      );
    }

    if (!profile) {
      return NextResponse.json(
        { error: "Profil user belum terdaftar di tabel profiles" },
        { status: 403 }
      );
    }

    if (profile.role !== body.role) {
      return NextResponse.json(
        { error: `Role tidak sesuai. Ditemukan role '${profile.role}'` },
        { status: 403 }
      );
    }

    return NextResponse.json({
      message: "Login berhasil",
      user: {
        id: authData.user.id,
        role: profile.role,
        identifier: authData.user.email,
      },
      session: {
        accessToken: authData.session?.access_token,
        refreshToken: authData.session?.refresh_token,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
