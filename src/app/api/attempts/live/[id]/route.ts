import { databaseErrorResponse, getDatabase } from "@/lib/mongodb";
import { getStudentIdentity } from "@/lib/student-auth";
import type { Attempt, AttemptAnswer } from "@/lib/types";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  let student;
  try {
    student = await getStudentIdentity(request);
  } catch (error) {
    return databaseErrorResponse(error);
  }
  if (!student) return Response.json({ error: "Enter your name to update this test." }, { status: 401 });

  const { id } = await context.params;
  let body: {
    answers?: unknown;
    currentQuestion?: unknown;
    warnings?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (
    !Array.isArray(body.answers) ||
    !Number.isInteger(body.currentQuestion) ||
    typeof body.warnings !== "number" ||
    !Number.isInteger(body.warnings) ||
    body.warnings < 0
  ) {
    return Response.json({ error: "Live test progress is invalid." }, { status: 400 });
  }
  const answers = body.answers as AttemptAnswer[];
  if ((body.currentQuestion as number) < 1 || (body.currentQuestion as number) > answers.length) {
    return Response.json({ error: "The current question is outside the active test." }, { status: 400 });
  }
  if (
    answers.some(
      (answer) =>
        !answer ||
        typeof answer.questionId !== "string" ||
        (answer.selectedIndex !== null &&
          (!Number.isInteger(answer.selectedIndex) || answer.selectedIndex < 0 || answer.selectedIndex > 3)) ||
        typeof answer.flagged !== "boolean",
    )
  ) {
    return Response.json({ error: "One or more answers are invalid." }, { status: 400 });
  }

  try {
    const db = await getDatabase();
    const result = await db.collection<Attempt>("attempts").updateOne(
      { id, studentId: student.id, status: "active", total: answers.length },
      {
        $set: {
          answers,
          currentQuestion: body.currentQuestion as number,
          warnings: body.warnings,
          lastActivityAt: new Date().toISOString(),
        },
      },
    );
    if (!result.matchedCount) {
      return Response.json({ error: "The active test could not be found." }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}
