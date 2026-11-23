import { NextResponse } from "next/server";

import { databaseErrorResponse } from "@/lib/mongodb";
import { createStudentIdentity, getStudentIdentity, STUDENT_COOKIE } from "@/lib/student-auth";

export async function POST(request: Request) {
  let body: { name?: unknown };
  try {
    body = (await request.json()) as { name?: unknown };
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 80) {
    return Response.json({ error: "Enter a name between 1 and 80 characters." }, { status: 400 });
  }

  try {
    const existing = await getStudentIdentity(request);
    if (existing?.name === name) return Response.json({ student: existing });

    const { identity, token, maxAge } = await createStudentIdentity(name);
    const response = NextResponse.json({ student: identity });
    response.cookies.set(STUDENT_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge,
    });
    return response;
  } catch (error) {
    return databaseErrorResponse(error);
  }
}
