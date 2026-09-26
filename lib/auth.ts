import { SignJWT, jwtVerify } from "jose";

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET || "domyslny_tajny_klucz_kryptograficzny_kawashi_2026_min_32";
  return new TextEncoder().encode(secret);
}

export interface TokenPayload {
  username: string;
  role: "athlete" | "coach";
}

export async function createSessionToken(payload: TokenPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return {
      username: payload.username as string,
      role: payload.role as "athlete" | "coach",
    };
  } catch {
    return null;
  }
}