import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from('system_settings').select('key, value');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const result: Record<string, any> = {};
    (data ?? []).forEach((row) => {
      result[row.key] = row.value;
    });
    return NextResponse.json({ data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
