import { randomUUID } from "node:crypto";

import { databaseErrorResponse, getDatabase } from "@/lib/mongodb";
import { getStudentIdentity } from "@/lib/student-auth";
import type { TeacherMessage } from "@/lib/types";

export async function POST(request: Request) {
  let student;
  try {
    student = await getStudentIdentity(request);
  } catch (error) {
    return databaseErrorResponse(error);
  }
  if (!student) return Response.json({ error: "Enter your name to send a message." }, { status: 401 });

  let body: { message?: unknown };
  try {
    body = (await request.json()) as { message?: unknown };
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 1000) {
    return Response.json({ error: "Enter a message of up to 1,000 characters." }, { status: 400 });
  }

  try {
    const db = await getDatabase();
    const item: TeacherMessage = {
      id: randomUUID(),
      studentId: student.id,
      studentName: student.name,
      message,
      sender: "student",
      createdAt: new Date().toISOString(),
      read: false,
    };
    await db.collection<TeacherMessage>("messages").insertOne(item);
    return Response.json({ message: item }, { status: 201 });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}
