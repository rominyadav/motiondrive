"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import "../drive.css";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await authClient.signIn.email({
        email,
        password,
      });

      if (response.error) {
        setError(response.error.message || "Failed to sign in.");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (err: any) {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/",
      });
    } catch (err) {
      setError("Failed to sign in with Google.");
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card animate-fade-in">
        <h1 className="auth-title">
          Motionsewa <span style={{ color: "var(--accent-indigo)" }}>Drive</span>
        </h1>
        <p className="auth-subtitle">Sign in to access your organization storage</p>

        {error && (
          <div style={{ color: "var(--accent-danger)", fontSize: "14px", marginBottom: "16px", textAlign: "center" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleEmailSignIn}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="editor@motionsewa.com"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>

          <button type="submit" className="btn-primary" style={{ width: "100%", marginTop: "8px" }} disabled={loading}>
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </form>

        <div className="auth-divider">or</div>

        <button onClick={handleGoogleSignIn} className="btn-oauth" type="button">
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path
              fill="#4285F4"
              d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.47h4.84c-.15.8-.6 1.48-1.28 1.93v2.26h2.07c1.61-1.48 2.54-3.66 2.54-6.22z"
            />
            <path
              fill="#34A853"
              d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.07-2.26C11.32 14.36 10.24 14.63 9 14.63c-2.35 0-4.34-1.58-5.05-3.71H1.8v2.33C3.28 16.19 6 18 9 18z"
            />
            <path
              fill="#FBBC05"
              d="M3.95 10.92A5.4 5.4 0 0 1 3.6 9c0-.66.12-1.31.35-1.92V4.75H1.8A8.99 8.99 0 0 0 0 9c0 1.76.5 3.39 1.8 4.75l2.15-2.83z"
            />
            <path
              fill="#EA4335"
              d="M9 3.37c1.32 0 2.5.45 3.4 1.3l2.58-2.58C13.43.8 11.43 0 9 0 6 0 3.28 1.81 1.8 4.75l2.15 2.83C4.66 4.95 6.65 3.37 9 3.37z"
            />
          </svg>
          Continue with Google
        </button>

        <div style={{ marginTop: "24px", textAlign: "center", fontSize: "14px", color: "var(--text-secondary)" }}>
          Don&apos;t have an account?{" "}
          <Link href="/signup" style={{ color: "var(--accent-indigo)", fontWeight: "600" }}>
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}
