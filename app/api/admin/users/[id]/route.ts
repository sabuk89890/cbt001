import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type UpdateUserPayload = {
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

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as UpdateUserPayload;
    const supabase = createSupabaseAdminClient();

    const { data: currentProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    if (!currentProfile) {
      return NextResponse.json({ error: "Profil tidak ditemukan" }, { status: 404 });
    }

    const profileUpdates: Record<string, unknown> = {};

    if (body.role) {
      if (!["guru", "student"].includes(body.role)) {
        return NextResponse.json(
          { error: "role hanya boleh guru atau student" },
          { status: 400 }
        );
      }
      profileUpdates.role = body.role;
      if (body.role === "guru") {
        profileUpdates.class_name = null;
      }
    }

    if (body.username !== undefined) {
      profileUpdates.username = normalizeUsername(body.username);
    }

    if (body.fullName !== undefined) {
      profileUpdates.full_name = body.fullName;
    }

    if (body.className !== undefined) {
      profileUpdates.class_name = body.className;
    }

    if (body.photoUrl !== undefined) {
      profileUpdates.photo_url = body.photoUrl;
    }

    if (Object.keys(profileUpdates).length > 0) {
      let updateProfileError = (
        await supabase
          .from("profiles")
          .update(profileUpdates)
          .eq("id", id)
      ).error;

      if (updateProfileError?.message?.includes("photo_url")) {
        const fallbackUpdates = { ...profileUpdates };
        delete fallbackUpdates.photo_url;

        updateProfileError = (
          await supabase
            .from("profiles")
            .update(fallbackUpdates)
            .eq("id", id)
        ).error;
      }

      if (updateProfileError) {
        return NextResponse.json({ error: updateProfileError.message }, { status: 500 });
      }
    }

    if (body.password || body.email || body.fullName) {
      const { error: updateAuthError } = await supabase.auth.admin.updateUserById(id, {
        ...(body.password ? { password: body.password } : null),
        ...(body.email ? { email: body.email } : null),
        ...(body.fullName
          ? {
              user_metadata: {
                full_name: body.fullName,
              },
            }
          : null),
      });

      if (updateAuthError) {
        return NextResponse.json({ error: updateAuthError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ message: "Data pengguna berhasil diperbarui" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = createSupabaseAdminClient();

    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Akun berhasil dihapus" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
