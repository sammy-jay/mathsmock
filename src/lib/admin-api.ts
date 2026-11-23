import { cookies } from "next/headers";

import { ADMIN_COOKIE, verifyAdminSession } from "@/lib/admin-auth";

export async function requireAdmin(): Promise<Response | null> {
  const cookieStore = await cookies();
  if (!verifyAdminSession(cookieStore.get(ADMIN_COOKIE)?.value)) {
    return Response.json({ error: "Admin sign-in is required." }, { status: 401 });
  }
  return null;
}
