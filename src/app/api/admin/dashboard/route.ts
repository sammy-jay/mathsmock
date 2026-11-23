import { connection } from "next/server";

import { databaseErrorResponse, getDatabase, initializeDatabase, initialSiteSettings } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-api";
import type { Attempt, Question, SiteSettings, StudentSessionDocument, TeacherMessage } from "@/lib/types";

export async function GET() {
  await connection();
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const db = await getDatabase();
    await initializeDatabase(db);
    const [attempts, questions, messages, studentSessions, settings] = await Promise.all([
      db.collection<Attempt>("attempts").find().project({ _id: 0 }).sort({ createdAt: -1 }).limit(200).toArray(),
      db.collection<Question>("questions").find().project({ _id: 0 }).sort({ id: 1 }).toArray(),
      db.collection<TeacherMessage>("messages").find().project({ _id: 0 }).sort({ createdAt: -1 }).limit(200).toArray(),
      db
        .collection<StudentSessionDocument>("studentSessions")
        .find()
        .project({ _id: 0, id: 1, name: 1, lastSeenAt: 1 })
        .sort({ lastSeenAt: -1 })
        .limit(500)
        .toArray(),
      db.collection<SiteSettings & { key: string }>("settings").findOne({ key: "site" }),
    ]);
    return Response.json({
      attempts,
      questions,
      messages,
      students: studentSessions,
      settings: settings ?? initialSiteSettings,
    });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}
