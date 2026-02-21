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
      .select("id, role, full_name")
      .eq("username", rawUsername)
      .maybeSingle();

    if (profileLookupError) {
      return NextResponse.json(
        { error: `Gagal mencari username: ${profileLookupError.message}` },
        { status: 500 }
      );
    }

    const profileId = profileByUsername?.id;

    if (!profileId) {
      return NextResponse.json({ error: "Username tidak ditemukan" }, { status: 401 });
    }

    const { data: authUserData, error: authUserError } = await adminClient.auth.admin.getUserById(
      profileId
    );

    if (authUserError) {
      return NextResponse.json(
        { error: `Gagal mencari akun auth: ${authUserError.message}` },
        { status: 500 }
      );
    }

    const emailForAuth = authUserData.user?.email;

    if (!emailForAuth) {
      return NextResponse.json({ error: "Akun auth untuk username tidak ditemukan" }, { status: 401 });
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

    return NextResponse.json({
      message: "Login berhasil",
      user: {
        id: authData.user.id,
        role: profileByUsername.role,
        username: rawUsername,
        fullName: profileByUsername.full_name ?? null,
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
