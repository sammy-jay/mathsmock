import { randomUUID } from "node:crypto";

import { databaseErrorResponse, getDatabase, initializeDatabase } from "@/lib/mongodb";
import { SUBJECT } from "@/lib/questions";
import { getStudentIdentity } from "@/lib/student-auth";
import type { Attempt, Question, SiteSettings } from "@/lib/types";

export async function POST(request: Request) {
  let student;
  try {
    student = await getStudentIdentity(request);
  } catch (error) {
    return databaseErrorResponse(error);
  }
  if (!student) return Response.json({ error: "Enter your name before starting a test." }, { status: 401 });

  let body: { questionIds?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (
    !Array.isArray(body.questionIds) ||
    body.questionIds.length < 1 ||
    body.questionIds.length > 20 ||
    body.questionIds.some((id) => typeof id !== "string") ||
    new Set(body.questionIds).size !== body.questionIds.length
  ) {
    return Response.json({ error: "A student name and 1–20 unique question IDs are required." }, { status: 400 });
  }

  try {
    const db = await getDatabase();
    await initializeDatabase(db);
    const questionIds = body.questionIds as string[];
    const questionCount = await db.collection<Question>("questions").countDocuments({
      id: { $in: questionIds },
      active: true,
    });
    if (questionCount !== questionIds.length) {
      return Response.json({ error: "One or more selected questions are no longer available." }, { status: 400 });
    }
    const settings = await db.collection<SiteSettings & { key: string }>("settings").findOne({ key: "site" });
    const now = new Date().toISOString();
    const attempt: Attempt = {
      id: randomUUID(),
      studentId: student.id,
      studentName: student.name,
      subject: SUBJECT,
      answers: questionIds.map((questionId) => ({ questionId, selectedIndex: null, flagged: false })),
      score: 0,
      total: questionIds.length,
      warnings: 0,
      durationSeconds: questionIds.length * (settings?.secondsPerQuestion ?? 72),
      createdAt: now,
      startedAt: now,
      lastActivityAt: now,
      currentQuestion: 1,
      status: "active",
    };
    await db.collection<Attempt>("attempts").insertOne(attempt);
    return Response.json({ attempt }, { status: 201 });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}
