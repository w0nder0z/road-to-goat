import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/auth";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const tokenFromCookie = cookieStore.get("goat_session_token")?.value;
  const authHeader = request.headers.get("authorization");
  const tokenFromHeader = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

  const token = tokenFromCookie || tokenFromHeader;

  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const payload = await verifySessionToken(token);
  if (!payload) {
    return NextResponse.json({ authenticated: false, error: "Token wygasł lub jest nieprawidłowy." }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: payload,
  });
}