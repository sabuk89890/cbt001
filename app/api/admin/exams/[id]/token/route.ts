import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

// allow admin to read/update/delete token for a specific session

type RouteContext = { params: Promise<{ id: string }> };

function makeRandomToken(length = 6) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let str = "";
  for (let i = 0; i < length; i++) {
    str += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return str;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("exam_tokens")
      .select("token, expires_at, manual, created_at")
      .eq("session_id", id)
      .single();
    if (error && error.code !== "PGRST116") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data: data ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const rawToken = typeof body.token === "string" ? body.token.trim() : "";
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    const refreshInterval = typeof body.refreshInterval === 'number' ? body.refreshInterval : null;
    // if an interval is provided and greater than zero, we treat as automatic (manual=false)
    const manual = !(refreshInterval && refreshInterval > 0);

    const token = rawToken || makeRandomToken(5);

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("exam_tokens")
      .upsert({
        session_id: id,
        token,
        expires_at: expiresAt,
        refresh_interval: refreshInterval,
        manual,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("exam_tokens").delete().eq("session_id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
