import { SignJWT, jwtVerify } from "jose";

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET || "domyslny_tajny_klucz_kryptograficzny_kawashi_2026_min_32";
  return new TextEncoder().encode(secret);
}

export interface TokenPayload {
  username: string;
  role: "athlete" | "coach";
}

// Bezpieczne haszowanie hasła użytkownika z solą serwerową
export async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = process.env.JWT_SECRET || "kawashi_salt_2026";
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password + salt),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: enc.encode(salt),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );

  return Buffer.from(derivedBits).toString("hex");
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