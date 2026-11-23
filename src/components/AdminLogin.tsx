"use client";

import { ArrowLeft, ArrowRight, KeyRound, LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

export default function AdminLogin({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to sign in.");
      router.replace("/admin");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="admin-login-page">
      <header className="admin-login-header">
        <Link className="brand-lockup" href="/"><span className="brand-mark">∑</span><strong>MathsMock</strong></Link>
        <Link className="back-link" href="/"><ArrowLeft size={15} /> Student practice</Link>
      </header>
      <section className="admin-login-card">
        <span className="login-icon"><LockKeyhole size={21} /></span>
        <p className="eyebrow">TEACHER ACCESS</p>
        <h1>Welcome back.</h1>
        <p className="login-description">Sign in to monitor tests, review progress, and support your students.</p>
        {configured ? (
          <form className="admin-login-form" onSubmit={submit}>
            <label htmlFor="admin-username">Username</label>
            <input autoComplete="username" id="admin-username" onChange={(event) => setUsername(event.target.value)} required value={username} />
            <label htmlFor="admin-password">Password</label>
            <input autoComplete="current-password" id="admin-password" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="button button-primary button-wide" disabled={loading} type="submit">
              {loading ? "Signing in…" : "Sign in"} <ArrowRight size={16} />
            </button>
          </form>
        ) : (
          <div className="setup-notice">
            <KeyRound size={17} />
            <div><strong>Admin sign-in needs setup</strong><p>Add <code>ADMIN_USERNAME</code>, <code>ADMIN_PASSWORD</code>, and <code>AUTH_SECRET</code> to your environment, then restart the app.</p></div>
          </div>
        )}
        {error && !configured && <p className="form-error" role="alert">{error}</p>}
        <div className="login-safety"><LockKeyhole size={13} /> Teacher-only area · protected by a secure session</div>
      </section>
    </main>
  );
}
