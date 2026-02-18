import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseAuthClient } from "@/lib/supabase/server";

type LoginPayload = {
  username?: string;
  password?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoginPayload;

    if (!body.username || !body.password) {
      return NextResponse.json(
        { error: "username dan password wajib diisi" },
        { status: 400 }
      );
    }

    const authClient = createSupabaseAuthClient();
    const adminClient = createSupabaseAdminClient();

    const rawUsername = body.username.trim();

    const { data: profileByUsername, error: profileLookupError } = await adminClient
      .from("profiles")
      .select("email")
      .eq("username", rawUsername)
      .maybeSingle();

    if (profileLookupError) {
      return NextResponse.json(
        { error: `Gagal mencari username: ${profileLookupError.message}` },
        { status: 500 }
      );
    }

    const emailForAuth = profileByUsername?.email;

    if (!emailForAuth) {
      return NextResponse.json({ error: "Username tidak ditemukan" }, { status: 401 });
    }

    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
      email: emailForAuth,
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

    return NextResponse.json({
      message: "Login berhasil",
      user: {
        id: authData.user.id,
        role: profile.role,
        username: rawUsername,
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
