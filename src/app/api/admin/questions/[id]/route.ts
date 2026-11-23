import { requireAdmin } from "@/lib/admin-api";
import { databaseErrorResponse, getDatabase } from "@/lib/mongodb";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await context.params;
  let body: { active?: unknown };
  try {
    body = (await request.json()) as { active?: unknown };
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (typeof body.active !== "boolean") {
    return Response.json({ error: "An active boolean is required." }, { status: 400 });
  }

  try {
    const db = await getDatabase();
    const result = await db.collection("questions").updateOne({ id }, { $set: { active: body.active } });
    if (!result.matchedCount) return Response.json({ error: "Question not found." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}
