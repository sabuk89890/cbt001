import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');
    if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.rpc('rpc_get_session_metrics', { sid: sessionId });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
