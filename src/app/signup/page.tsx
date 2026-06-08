"use client";

import { useEffect, useState, Suspense } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter, useSearchParams } from "next/navigation";
import { validateInviteToken, claimInviteToken } from "@/app/actions/auth";
import Link from "next/link";
import "../drive.css";

function SignupForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  const [invitationInfo, setInvitationInfo] = useState<{ email: string; role: string } | null>(null);
  const [checkingToken, setCheckingToken] = useState(false);
  const [isVerificationSent, setIsVerificationSent] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  // Validate Invitation Token if present
  useEffect(() => {
    async function checkToken() {
      if (!token) return;
      setCheckingToken(true);
      try {
        const result = await validateInviteToken(token);
        if (result.valid && result.email) {
          setInvitationInfo({ email: result.email, role: result.role || "staff" });
          setEmail(result.email); // Auto-fill invited email
        } else {
          setError(result.error || "This invitation is invalid or has expired.");
        }
      } catch (err) {
        setError("Error validating invitation link.");
      } finally {
        setCheckingToken(false);
      }
    }
    checkToken();
  }, [token]);

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 1. Create the user using Better Auth
      const response = await authClient.signUp.email({
        email,
        password,
        name,
      });

      if (response.error) {
        setError(response.error.message || "Failed to create account.");
        setLoading(false);
        return;
      }

      // 2. If signed up with an invite token, claim the invitation token immediately
      if (token) {
        const claimResult = await claimInviteToken(token, email);
        if (!claimResult.success) {
          setError(claimResult.error || "Account created, but failed to claim invitation. Contact an admin.");
          setLoading(false);
          return;
        }
      }

      // Instead of redirecting to root (which requires verification), show verification message
      setIsVerificationSent(true);
    } catch (err: any) {
      setError("An unexpected error occurred during signup.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: token ? `/?token=${token}` : "/", // Pass token in callback to claim later on main dashboard or auth callback
      });
    } catch (err) {
      setError("Failed to sign up with Google.");
    }
  };

  if (checkingToken) {
    return (
      <div className="auth-wrapper">
        <div className="auth-card" style={{ textAlign: "center" }}>
          <div className="user-avatar" style={{ margin: "0 auto 16px auto", width: "48px", height: "48px" }}>
            M
          </div>
          <h3>Validating Invitation...</h3>
        </div>
      </div>
    );
  }

  if (isVerificationSent) {
    return (
      <div className="auth-wrapper">
        <div className="auth-card animate-fade-in" style={{ textAlign: "center", padding: "40px 24px" }}>
          <div className="user-avatar" style={{ margin: "0 auto 24px auto", width: "56px", height: "56px", background: "rgba(99, 102, 241, 0.2)", color: "var(--accent-indigo)" }}>
            ✓
          </div>
          <h2 style={{ fontSize: "22px", fontWeight: "700", marginBottom: "12px" }}>Verify Your Email</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "15px", lineHeight: "1.6", marginBottom: "24px" }}>
            We've sent a verification link to <strong style={{ color: "#ffffff" }}>{email}</strong>.<br />
            Please click the link in your email to verify your account and start using Motionsewa Drive.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <Link href="/login" className="btn-primary" style={{ textDecoration: "none", display: "inline-block" }}>
              Proceed to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card animate-fade-in">
        <h1 className="auth-title">
          Motionsewa <span style={{ color: "var(--accent-indigo)" }}>Drive</span>
        </h1>
        {invitationInfo ? (
          <p className="auth-subtitle" style={{ color: "var(--accent-success)", fontWeight: "500" }}>
            Accepting invitation as <strong>{invitationInfo.role}</strong>
          </p>
        ) : (
          <p className="auth-subtitle">Create your organization account</p>
        )}

        {error && (
          <div style={{ color: "var(--accent-danger)", fontSize: "14px", marginBottom: "16px", textAlign: "center" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleEmailSignUp}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Your Name"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="editor@motionsewa.com"
              disabled={!!invitationInfo} // Lock email if invited
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
              minLength={8}
            />
          </div>

          <button type="submit" className="btn-primary" style={{ width: "100%", marginTop: "8px" }} disabled={loading}>
            {loading ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        {!invitationInfo && (
          <>
            <div className="auth-divider">or</div>

            <button onClick={handleGoogleSignUp} className="btn-oauth" type="button">
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
              Sign Up with Google
            </button>
          </>
        )}

        <div style={{ marginTop: "24px", textAlign: "center", fontSize: "14px", color: "var(--text-secondary)" }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "var(--accent-indigo)", fontWeight: "600" }}>
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="auth-wrapper">
        <div className="auth-card" style={{ textAlign: "center" }}>
          <h3>Loading...</h3>
        </div>
      </div>
    }>
      <SignupForm />
    </Suspense>
  );
}
