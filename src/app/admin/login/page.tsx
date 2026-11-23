import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import AdminLogin from "@/components/AdminLogin";
import { hasAdminCredentials } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Teacher sign-in · MathsMock",
};

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="screen-loader">Loading sign-in…</div>}>
      <ConfiguredAdminLogin />
    </Suspense>
  );
}

async function ConfiguredAdminLogin() {
  await connection();
  return <AdminLogin configured={hasAdminCredentials()} />;
}
