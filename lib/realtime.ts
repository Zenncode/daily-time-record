"use server";

import { SignJWT } from "jose";
import { db } from "@/lib/db";

export async function publishRealtime(channels: string[]) {
  if (!channels.length) return;
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    throw new Error("SESSION_SECRET must be configured with at least 32 characters.");
  }
  const secret = new TextEncoder().encode(process.env.SESSION_SECRET);
  const token = await new SignJWT({ type: "publish" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("daymark")
    .setAudience("daymark-realtime-publisher")
    .setIssuedAt()
    .setExpirationTime("30s")
    .sign(secret);
  const endpoint = process.env.REALTIME_PUBLISH_URL || "http://127.0.0.1:3100/_dtr/realtime/publish";

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channels: [...new Set(channels)] }),
      cache: "no-store",
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) {
      console.error(`Realtime publish to ${new URL(endpoint).host} failed with HTTP ${response.status}.`);
    }
  } catch (error) {
    console.error("Realtime publish is unavailable:", error);
  }
}

export async function publishUserAttendanceUpdate(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { managerId: true },
  });
  const channels = ["admin", `user:${userId}`];
  if (user?.managerId) channels.push(`manager:${user.managerId}`);
  await publishRealtime(channels);
}
