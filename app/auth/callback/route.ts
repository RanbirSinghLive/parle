import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/conversation";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Check if profile exists, create if not (for OAuth users)
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", data.user.id)
        .single();

      if (!existingProfile) {
        // Create profile for OAuth user
        const { error: profileError } = await supabase.from("profiles").insert({
          id: data.user.id,
          email: data.user.email || "",
          display_name:
            data.user.user_metadata?.full_name ||
            data.user.user_metadata?.name ||
            data.user.email?.split("@")[0] ||
            "Learner",
          current_level: "A1",
          vocabulary: [],
          grammar: [],
          topics: [],
          strengths: [],
          weaknesses: [],
          total_practice_minutes: 0,
          streak_days: 0,
          settings: {
            correction_style: "during_pauses",
            default_mode: "free_conversation",
            tts_speed: 0.9,
            target_level: "B1",
            daily_goal_minutes: 15,
          },
        });

        if (profileError) {
          console.error("Profile creation error:", profileError);
          // Continue anyway - profile can be created later
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
