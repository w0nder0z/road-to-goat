import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "road-to-goat-super-secret-key-2026"
);

async function getAuthenticatedUser(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : req.cookies.get("goat_auth_token")?.value;

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      username: String(payload.username || ""),
      role: (payload.role as "athlete" | "coach") || "athlete",
    };
  } catch {
    return null;
  }
}

// EDYCJA WPISU (tylko autor lub trener)
export async function PATCH(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user || !user.username) {
    return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  }

  const body = await req.json();
  const { id, updates } = body;

  if (!id || !updates) {
    return NextResponse.json({ error: "Brakujące dane wpisu." }, { status: 400 });
  }

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("progress_submissions")
    .select("athlete_name")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Nie znaleziono wpisu." }, { status: 404 });
  }

  const isOwner =
    existing.athlete_name.trim().toLowerCase() === user.username.trim().toLowerCase();
  const isCoach = user.role === "coach";

  if (!isOwner && !isCoach) {
    return NextResponse.json(
      { error: "Nie masz uprawnień do edycji cudzego wpisu." },
      { status: 403 }
    );
  }

  // Zwykły zawodnik nie może nadpisać pola coach_feedback
  const safeUpdates = { ...updates };
  if (!isCoach) {
    delete safeUpdates.coach_feedback;
    delete safeUpdates.athlete_name;
  }

  const { data, error } = await supabaseAdmin
    .from("progress_submissions")
    .update(safeUpdates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ submission: data });
}

// USUWANIE WPISU (tylko autor lub trener)
export async function DELETE(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user || !user.username) {
    return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Brak ID wpisu." }, { status: 400 });
  }

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("progress_submissions")
    .select("athlete_name")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Nie znaleziono wpisu." }, { status: 404 });
  }

  const isOwner =
    existing.athlete_name.trim().toLowerCase() === user.username.trim().toLowerCase();
  const isCoach = user.role === "coach";

  if (!isOwner && !isCoach) {
    return NextResponse.json(
      { error: "Możesz usuwać wyłącznie swoje własne wpisy." },
      { status: 403 }
    );
  }

  const { error } = await supabaseAdmin
    .from("progress_submissions")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}