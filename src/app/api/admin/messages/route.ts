import { randomUUID } from "node:crypto";

import { requireAdmin } from "@/lib/admin-api";
import { databaseErrorResponse, getDatabase } from "@/lib/mongodb";
import type { StudentSessionDocument, TeacherMessage } from "@/lib/types";

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: { studentId?: unknown; message?: unknown };
  try {
    body = (await request.json()) as { studentId?: unknown; message?: unknown };
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const studentId = typeof body.studentId === "string" ? body.studentId.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!studentId || studentId.length > 100 || !message || message.length > 1000) {
    return Response.json({ error: "Choose a student and enter a message of up to 1,000 characters." }, { status: 400 });
  }

  try {
    const db = await getDatabase();
    const student = await db.collection<StudentSessionDocument>("studentSessions").findOne({ id: studentId });
    if (!student) return Response.json({ error: "Student not found." }, { status: 404 });
    const item: TeacherMessage = {
      id: randomUUID(),
      studentId: student.id,
      studentName: student.name,
      message,
      sender: "teacher",
      createdAt: new Date().toISOString(),
      read: false,
    };
    await db.collection<TeacherMessage>("messages").insertOne(item);
    return Response.json({ message: item }, { status: 201 });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}
