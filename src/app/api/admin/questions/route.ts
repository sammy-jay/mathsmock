import { randomUUID } from "node:crypto";

import { requireAdmin } from "@/lib/admin-api";
import { databaseErrorResponse, getDatabase } from "@/lib/mongodb";
import type { Question } from "@/lib/types";

type QuestionInput = {
  topic?: unknown;
  prompt?: unknown;
  options?: unknown;
  correctIndex?: unknown;
  working?: unknown;
};

function validateQuestion(input: QuestionInput): string | null {
  if (typeof input.topic !== "string" || !input.topic.trim() || input.topic.length > 80) {
    return "A topic of up to 80 characters is required.";
  }
  if (typeof input.prompt !== "string" || !input.prompt.trim() || input.prompt.length > 1000) {
    return "A question of up to 1,000 characters is required.";
  }
  if (
    !Array.isArray(input.options) ||
    input.options.length !== 4 ||
    input.options.some((option) => typeof option !== "string" || !option.trim() || option.length > 300)
  ) {
    return "Provide exactly four answer options, each up to 300 characters.";
  }
  if (!Number.isInteger(input.correctIndex) || (input.correctIndex as number) < 0 || (input.correctIndex as number) > 3) {
    return "Choose the correct answer.";
  }
  if (typeof input.working !== "string" || input.working.length > 2000) {
    return "Working must be 2,000 characters or fewer.";
  }
  return null;
}

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let input: QuestionInput;
  try {
    input = (await request.json()) as QuestionInput;
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const invalid = validateQuestion(input);
  if (invalid) return Response.json({ error: invalid }, { status: 400 });

  const question: Question = {
    id: `USR-${randomUUID()}`,
    topic: (input.topic as string).trim(),
    prompt: (input.prompt as string).trim(),
    options: (input.options as string[]).map((option) => option.trim()),
    correctIndex: input.correctIndex as number,
    working: (input.working as string).trim(),
    active: true,
  };
  try {
    const db = await getDatabase();
    await db.collection<Question>("questions").insertOne(question);
    return Response.json({ question }, { status: 201 });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}
