import { NextResponse } from "next/server";

import {
  ADMIN_COOKIE,
  createAdminSession,
  hasAdminCredentials,
  validateAdminCredentials,
} from "@/lib/admin-auth";

export async function POST(request: Request) {
  if (!hasAdminCredentials()) {
    return NextResponse.json(
      { error: "Admin sign-in is not configured. Set ADMIN_USERNAME, ADMIN_PASSWORD, and AUTH_SECRET." },
      { status: 503 },
    );
  }

  let body: { username?: unknown; password?: unknown };
  try {
    body = (await request.json()) as { username?: unknown; password?: unknown };
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (
    typeof body.username !== "string" ||
    typeof body.password !== "string" ||
    !validateAdminCredentials(body.username, body.password)
  ) {
    return NextResponse.json({ error: "The username or password is incorrect." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, createAdminSession(body.username), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return response;
}
