import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

function makeRandomToken(length = 5) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let str = "";
  for (let i = 0; i < length; i++) {
    str += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return str;
}

// endpoints for students to check/validate token when starting an exam session

type RouteContext = { params: Promise<{ id: string }> };

// check whether a valid token is currently required
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = createSupabaseAdminClient();
    let { data, error } = await supabase
      .from("exam_tokens")
      .select("token, expires_at, manual, refresh_interval")
      .eq("session_id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116" || error.message?.includes("No rows")) {
        return NextResponse.json({ required: false });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ required: false });
    }

    const now = new Date();
    // if refresh_interval defined and token expired or missing, generate new one
    if (data.refresh_interval && data.refresh_interval > 0) {
      // check expiration
      if (!data.expires_at || new Date(data.expires_at).getTime() <= now.getTime()) {
        const newTok = makeRandomToken(5);
        const newExpiry = new Date(now.getTime() + data.refresh_interval * 60000).toISOString();
        const upd = await supabase
          .from('exam_tokens')
          .update({ token: newTok, expires_at: newExpiry, manual: false })
          .eq('session_id', id);
        if (!upd.error) {
          data.token = newTok;
          data.expires_at = newExpiry;
          data.manual = false;
        }
      }
    }

    if (data.expires_at && new Date(data.expires_at).getTime() < now.getTime()) {
      return NextResponse.json({ required: false });
    }

    return NextResponse.json({ required: true, expiresAt: data.expires_at });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// validate a submitted token string
export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) {
      return NextResponse.json({ ok: false, error: "Token tidak boleh kosong" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("exam_tokens")
      .select("token, expires_at")
      .eq("session_id", id)
      .single();

    if (error || !data) {
      return NextResponse.json({ ok: false, error: "Token tidak diset" }, { status: 400 });
    }

    const now = new Date();
    if (data.expires_at && new Date(data.expires_at).getTime() < now.getTime()) {
      return NextResponse.json({ ok: false, error: "Token sudah kadaluwarsa" }, { status: 400 });
    }

    if (data.token !== token) {
      return NextResponse.json({ ok: false, error: "Token tidak cocok" }, { status: 401 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
