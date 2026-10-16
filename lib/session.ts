import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";

export type SessionUser = { id: string; name: string; email: string; role: Role };
const COOKIE_NAME = "dtr_session";
const secret = new TextEncoder().encode(process.env.SESSION_SECRET);

export async function createSession(user: SessionUser) {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    throw new Error("SESSION_SECRET must be configured with at least 32 characters.");
  }
  const token = await new SignJWT(user)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("daymark")
    .setAudience("daymark-session")
    .setIssuer("daymark")
    .setAudience("daymark-session")
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secret);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  let payload;
  try {
    ({ payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
      issuer: "daymark",
      audience: "daymark-session",
    }));
  } catch (error) {
    if (
      error instanceof Error &&
      !["JWTExpired", "JWSSignatureVerificationFailed", "JWTClaimValidationFailed"].includes(error.name)
    ) {
      console.error("Session verification failed:", error);
    }
    return null;
  }
  if (
    typeof payload.id !== "string" ||
    typeof payload.name !== "string" ||
    typeof payload.email !== "string" ||
    !["ADMIN", "MANAGER", "EMPLOYEE"].includes(String(payload.role))
  ) return null;
  const user = await db.user.findUnique({
    where: { id: payload.id },
    select: { id: true, name: true, email: true, role: true, active: true },
  });
  if (!user?.active) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role as Role };
}

export async function requireSession() {
  const user = await getSession();
  if (!user) redirect("/login");
  return user;
}

export async function requireManager() {
  const user = await requireSession();
  if (user.role !== "ADMIN" && user.role !== "MANAGER") redirect("/dashboard");
  return user;
}

export async function requireAdmin() {
  const user = await requireSession();
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}

export async function clearSession() {
  (await cookies()).delete(COOKIE_NAME);
}
