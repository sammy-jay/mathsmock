import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import AdminDashboard from "@/components/AdminDashboard";
import { ADMIN_COOKIE, verifyAdminSession } from "@/lib/admin-auth";

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="screen-loader">Loading teacher dashboard…</div>}>
      <AdminRoute />
    </Suspense>
  );
}

async function AdminRoute() {
  await connection();
  const cookieStore = await cookies();
  if (!verifyAdminSession(cookieStore.get(ADMIN_COOKIE)?.value)) {
    redirect("/admin/login");
  }
  return <AdminDashboard />;
}
