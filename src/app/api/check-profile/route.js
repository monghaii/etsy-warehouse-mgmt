import { supabaseAdmin } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Check if the user exists in public.users
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", "e1ecb862-0e98-40d1-8d38-795dc899b350")
      .single();

    if (error) {
      return NextResponse.json({
        exists: false,
        error: error.message,
        code: error.code,
      });
    }

    return NextResponse.json({
      exists: true,
      user: data,
    });
  } catch (error) {
    return NextResponse.json({
      exists: false,
      error: error.message,
    });
  }
}
