import { createHash, randomBytes, randomUUID } from "node:crypto";

import { getDatabase } from "@/lib/mongodb";
import type { StudentIdentity, StudentSessionDocument } from "@/lib/types";

export const STUDENT_COOKIE = "mathsmock_student";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function getStudentIdentity(request: Request): Promise<StudentIdentity | null> {
  const token = request.headers
    .get("cookie")
    ?.split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${STUDENT_COOKIE}=`))
    ?.slice(STUDENT_COOKIE.length + 1);
  if (!token) return null;

  const db = await getDatabase();
  const session = await db
    .collection<StudentSessionDocument>("studentSessions")
    .findOne({ tokenHash: hashToken(token) });
  if (session) {
    await db.collection("studentSessions").updateOne(
      { id: session.id },
      { $set: { lastSeenAt: new Date().toISOString() } },
    );
  }
  return session ? { id: session.id, name: session.name } : null;
}

export async function createStudentIdentity(name: string): Promise<{
  identity: StudentIdentity;
  token: string;
  maxAge: number;
}> {
  const token = randomBytes(32).toString("base64url");
  const now = new Date().toISOString();
  const identity = { id: randomUUID(), name };
  const session: StudentSessionDocument = {
    ...identity,
    tokenHash: hashToken(token),
    createdAt: now,
    lastSeenAt: now,
  };
  const db = await getDatabase();
  await db.collection<StudentSessionDocument>("studentSessions").insertOne(session);
  return { identity, token, maxAge: SESSION_TTL_SECONDS };
}
