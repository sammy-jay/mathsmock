import { connection } from "next/server";
import { NextResponse } from "next/server";

import { databaseErrorResponse, getDatabase, initializeDatabase } from "@/lib/mongodb";
import { seedQuestions } from "@/lib/questions";
import type { Question, SiteSettings } from "@/lib/types";

export async function GET() {
  await connection();
  if (!process.env.MONGODB_URI) {
    return NextResponse.json({ questions: seedQuestions, source: "preview" });
  }

  try {
    const db = await getDatabase();
    await initializeDatabase(db);
    const [questions, settings] = await Promise.all([
      db
      .collection<Question>("questions")
      .find({ active: true })
      .project({ _id: 0 })
      .toArray(),
      db.collection<SiteSettings & { key: string }>("settings").findOne({ key: "site" }),
    ]);
    return NextResponse.json({ questions, settings, source: "mongodb" });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}
