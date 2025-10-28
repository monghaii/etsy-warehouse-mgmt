import { supabaseAdmin } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, email, role, fullName } = body;

    // Insert into public.users (email is NOT stored here, only in auth.users)
    const { data, error } = await supabaseAdmin
      .from("users")
      .upsert(
        {
          id: userId,
          role: role || "admin",
          full_name: fullName || email.split("@")[0],
          is_active: true,
        },
        { onConflict: "id" }
      )
      .select()
      .single();

    if (error) {
      console.error("Error creating user profile:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, user: data });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
