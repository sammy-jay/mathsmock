import { randomUUID } from "node:crypto";

import { databaseErrorResponse, getDatabase, initializeDatabase } from "@/lib/mongodb";
import { SUBJECT } from "@/lib/questions";
import { getStudentIdentity } from "@/lib/student-auth";
import type { Attempt, AttemptAnswer, Question } from "@/lib/types";

type AttemptRequest = {
  answers?: unknown;
  warnings?: unknown;
  durationSeconds?: unknown;
  attemptId?: unknown;
};

export async function POST(request: Request) {
  let student;
  try {
    student = await getStudentIdentity(request);
  } catch (error) {
    return databaseErrorResponse(error);
  }
  if (!student) return Response.json({ error: "Enter your name before submitting a test." }, { status: 401 });

  let body: AttemptRequest;
  try {
    body = (await request.json()) as AttemptRequest;
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!Array.isArray(body.answers) || body.answers.length < 1 || body.answers.length > 20) {
    return Response.json({ error: "An attempt must contain between 1 and 20 answers." }, { status: 400 });
  }
  if (
    typeof body.warnings !== "number" ||
    !Number.isInteger(body.warnings) ||
    body.warnings < 0 ||
    typeof body.durationSeconds !== "number" ||
    !Number.isFinite(body.durationSeconds) ||
    body.durationSeconds < 0
  ) {
    return Response.json({ error: "Attempt timing or warning data is invalid." }, { status: 400 });
  }

  const submittedAnswers = body.answers as AttemptAnswer[];
  if (
    submittedAnswers.some(
      (answer) =>
        !answer ||
        typeof answer.questionId !== "string" ||
        (answer.selectedIndex !== null &&
          (!Number.isInteger(answer.selectedIndex) || answer.selectedIndex < 0 || answer.selectedIndex > 3)) ||
        typeof answer.flagged !== "boolean",
    )
  ) {
    return Response.json({ error: "One or more submitted answers are invalid." }, { status: 400 });
  }

  try {
    const db = await getDatabase();
    await initializeDatabase(db);
    const questions = await db
      .collection<Question>("questions")
      .find({ id: { $in: submittedAnswers.map((answer) => answer.questionId) }, active: true })
      .toArray();
    const questionById = new Map(questions.map((question) => [question.id, question]));
    if (
      questions.length !== submittedAnswers.length ||
      submittedAnswers.some((answer) => !questionById.has(answer.questionId))
    ) {
      return Response.json({ error: "The test includes a question that is no longer available." }, { status: 400 });
    }

    const score = submittedAnswers.reduce((total, answer) => {
      return total + (questionById.get(answer.questionId)?.correctIndex === answer.selectedIndex ? 1 : 0);
    }, 0);
    const activeAttempt =
      typeof body.attemptId === "string"
        ? await db.collection<Attempt>("attempts").findOne({
            id: body.attemptId,
            studentId: student.id,
            status: "active",
          })
        : null;
    if (typeof body.attemptId === "string" && !activeAttempt) {
      return Response.json({ error: "The active test could not be found. Your answers were not saved." }, { status: 404 });
    }

    const attempt: Attempt = {
      id: activeAttempt?.id ?? randomUUID(),
      studentId: student.id,
      studentName: student.name,
      subject: SUBJECT,
      answers: submittedAnswers,
      score,
      total: submittedAnswers.length,
      warnings: body.warnings,
      durationSeconds: Math.floor(body.durationSeconds),
      createdAt: activeAttempt?.createdAt ?? new Date().toISOString(),
      status: "completed",
    };
    if (activeAttempt) {
      await db.collection<Attempt>("attempts").updateOne(
        { id: activeAttempt.id, studentId: student.id, status: "active" },
        { $set: attempt },
      );
    } else {
      await db.collection<Attempt>("attempts").insertOne(attempt);
    }
    return Response.json({ attempt }, { status: 201 });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}
