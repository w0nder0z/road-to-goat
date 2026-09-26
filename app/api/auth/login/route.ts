import { NextResponse } from "next/server";
import { createSessionToken, hashPassword } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password, teamCode, isCoach, mode } = body;

    const cleanNick = (username || "").trim();
    if (!cleanNick) {
      return NextResponse.json({ error: "Wpisz swój nick!" }, { status: 400 });
    }
    if (!password) {
      return NextResponse.json({ error: "Hasło jest wymagane!" }, { status: 400 });
    }

    const envTeamCode = process.env.AUTH_TEAM_PASSWORD || "Kawashi2026";
    const envCoachPin = process.env.AUTH_COACH_PIN || "1234";

    if (mode === "register") {
      // 1. REJESTRACJA: Wymagany kod drużyny (Kawashi2026)
      if (teamCode !== envTeamCode) {
        return NextResponse.json({ error: "Nieprawidłowy kod zaproszenia drużyny!" }, { status: 401 });
      }

      // Jeśli rejestruje się jako trener, weryfikujemy dodatkowo PIN trenera
      if (isCoach && password !== envCoachPin) {
        return NextResponse.json({ error: "Błędny PIN Trenera!" }, { status: 401 });
      }

      const assignedRole: "athlete" | "coach" = isCoach ? "coach" : "athlete";
      const pwdHash = await hashPassword(password);

      const { error: insertErr } = await supabase
        .from("athlete_profiles")
        .insert([{ username: cleanNick, role: assignedRole, password_hash: pwdHash }]);

      if (insertErr) {
        if (insertErr.code === "23505") {
          return NextResponse.json(
            { error: "Ten nick jest już zajęty! Zaloguj się lub wybierz inny." },
            { status: 409 }
          );
        }
        return NextResponse.json({ error: insertErr.message }, { status: 500 });
      }

      const token = await createSessionToken({ username: cleanNick, role: assignedRole });
      const response = NextResponse.json({
        success: true,
        user: { username: cleanNick, role: assignedRole },
        token,
      });

      response.cookies.set("goat_session_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });

      return response;
    } else {
      // 2. LOGOWANIE: Tylko Nick + Indywidualne hasło
      const { data: userProfile, error: fetchErr } = await supabase
        .from("athlete_profiles")
        .select("*")
        .eq("username", cleanNick)
        .single();

      if (fetchErr || !userProfile) {
        return NextResponse.json(
          { error: "Nie znaleziono takiego użytkownika. Kliknij 'Stwórz nowe konto'." },
          { status: 404 }
        );
      }

      // Weryfikacja hasła
      const pwdHash = await hashPassword(password);
      if (userProfile.password_hash) {
        if (userProfile.password_hash !== pwdHash) {
          return NextResponse.json({ error: "Niepoprawne hasło!" }, { status: 401 });
        }
      } else {
        // Fallback dla kont założonych przed zmianą: jeśli nie mają hasła, pozwalamy wejść hasłem klubowym lub przypisujemy
        if (password !== envTeamCode && password !== envCoachPin) {
          return NextResponse.json({ error: "Niepoprawne hasło!" }, { status: 401 });
        }
      }

      const token = await createSessionToken({
        username: userProfile.username,
        role: userProfile.role,
      });

      const response = NextResponse.json({
        success: true,
        user: { username: userProfile.username, role: userProfile.role },
        token,
      });

      response.cookies.set("goat_session_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });

      return response;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Błąd serwera.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}