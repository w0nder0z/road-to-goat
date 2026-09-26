import { SignJWT, jwtVerify } from "jose";

const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || "domyslny_klucz_deweloperski_kawashi_2026_min_32_znaki"
);

export interface TokenPayload {
  username: string;
  role: "athlete" | "coach";
}

// Generowanie tokenu podpisanego cyfrowo ważnego przez 7 dni
export async function createSessionToken(payload: TokenPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET_KEY);
}

// Weryfikacja podpisu cyfrowego i daty ważności tokenu
export async function verifySessionToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(SECRET_KEY, token);
    return {
      username: payload.username as string,
      role: payload.role as "athlete" | "coach",
    };
  } catch {
    return null; // Podpis sfałszowany lub token wygasł
  }
}