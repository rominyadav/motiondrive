"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { getGoogleSignInErrorMessage, isGoogleSignInCancelled, signInWithGoogle } from "@/lib/google-sign-in";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import "../drive.css";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
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
    setError("");
    setGoogleLoading(true);

    try {
      const result = await signInWithGoogle({ callbackURL: "/" });

      if (result.completedInApp) {
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      if (isGoogleSignInCancelled(err)) {
        return;
      }

      console.error("Failed to sign in with Google:", err);
      setError(getGoogleSignInErrorMessage(err));
    } finally {
      setGoogleLoading(false);
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
              disabled={googleLoading}
            />
          </div>

          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Password</label>
              <Link href="/reset-password" style={{ color: "var(--accent-indigo)", fontSize: "12px", fontWeight: "600", textDecoration: "none" }}>
                Forgot Password?
              </Link>
            </div>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              disabled={googleLoading}
            />
          </div>

          <button type="submit" className="btn-primary" style={{ width: "100%", marginTop: "8px" }} disabled={loading || googleLoading}>
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </form>

        <div className="auth-divider">or</div>

        <GoogleAuthButton onClick={handleGoogleSignIn} disabled={loading} loading={googleLoading} />

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
