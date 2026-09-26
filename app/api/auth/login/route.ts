import { NextResponse } from "next/server";
import { createSessionToken } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password, isCoach, mode } = body;

    const cleanNick = (username || "").trim();
    if (!cleanNick) {
      return NextResponse.json({ error: "Wpisz swój nick!" }, { status: 400 });
    }

    const envTeamPassword = process.env.AUTH_TEAM_PASSWORD || "Kawashi2026";
    const envCoachPin = process.env.AUTH_COACH_PIN || "1234";

    // Weryfikacja hasła po stronie serwera – brak wycieku do przeglądarki
    if (isCoach) {
      if (password !== envCoachPin) {
        return NextResponse.json({ error: "Błędny PIN Trenera!" }, { status: 401 });
      }
    } else {
      if (password !== envTeamPassword) {
        return NextResponse.json({ error: "Błędne hasło drużyny!" }, { status: 401 });
      }
    }

    const assignedRole: "athlete" | "coach" = isCoach ? "coach" : "athlete";

    if (mode === "register") {
      const { error: insertErr } = await supabase
        .from("athlete_profiles")
        .insert([{ username: cleanNick, role: assignedRole }]);

      if (insertErr) {
        if (insertErr.code === "23505") {
          return NextResponse.json(
            { error: "Ten nick jest już zajęty! Jeśli to Twoje konto, kliknij 'Zaloguj się'." },
            { status: 409 }
          );
        }
        return NextResponse.json({ error: insertErr.message }, { status: 500 });
      }
    } else {
      const { data: userProfile, error: fetchErr } = await supabase
        .from("athlete_profiles")
        .select("*")
        .eq("username", cleanNick)
        .single();

      if (fetchErr || !userProfile) {
        return NextResponse.json(
          { error: "Nie znaleziono takiego konta. Kliknij 'Stwórz konto'." },
          { status: 404 }
        );
      }
    }

    // Wygenerowanie tokenu z podpisem cyfrowym i czasem wygaśnięcia 7 dni
    const token = await createSessionToken({
      username: cleanNick,
      role: assignedRole,
    });

    const response = NextResponse.json({
      success: true,
      user: { username: cleanNick, role: assignedRole },
      token,
    });

    // Zapisanie ciasteczka z flagami bezpieczeństwa HttpOnly i SameSite (ochrona przed CSRF i XSS)
    response.cookies.set("goat_session_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 dni
      path: "/",
    });

    return response;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Błąd serwera.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}