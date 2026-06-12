"use client";

import { useEffect, useState, Suspense } from "react";
import { authClient } from "@/lib/auth-client";
import { getGoogleSignInErrorMessage, signInWithGoogle } from "@/lib/google-sign-in";
import { useRouter, useSearchParams } from "next/navigation";
import { validateInviteToken, claimInviteToken, verifyEmailOTP } from "@/app/actions/auth";
import Link from "next/link";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import "../drive.css";

function SignupForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  
  const [invitationInfo, setInvitationInfo] = useState<{ email: string; role: string } | null>(null);
  const [checkingToken, setCheckingToken] = useState(false);
  const [isVerificationSent, setIsVerificationSent] = useState(false);
  
  const [otp, setOtp] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [otpSuccess, setOtpSuccess] = useState(false);

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
    setError("");
    setGoogleLoading(true);

    try {
      const result = await signInWithGoogle({
        callbackURL: token ? `/?token=${token}` : "/", // Pass token in callback to claim later on main dashboard or auth callback
        requestSignUp: true,
      });

      if (result.completedInApp) {
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      setError(getGoogleSignInErrorMessage(err));
    } finally {
      setGoogleLoading(false);
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

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setOtpError("OTP must be exactly 6 digits.");
      return;
    }
    setOtpError("");
    setOtpLoading(true);
    try {
      const res = await verifyEmailOTP(email, otp);
      if (res.success) {
        setOtpSuccess(true);
      } else {
        setOtpError(res.error || "Verification failed");
      }
    } catch (err) {
      setOtpError("Failed to verify OTP. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  };

  if (isVerificationSent) {
    return (
      <div className="auth-wrapper">
        <div className="auth-card animate-fade-in" style={{ textAlign: "center", padding: "32px 24px" }}>
          {otpSuccess ? (
            <>
              <div className="user-avatar" style={{ margin: "0 auto 24px auto", width: "56px", height: "56px", background: "rgba(16, 185, 129, 0.2)", color: "var(--accent-success)" }}>
                ✓
              </div>
              <h2 style={{ fontSize: "22px", fontWeight: "700", marginBottom: "12px" }}>Email Verified Successfully!</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "15px", lineHeight: "1.6", marginBottom: "28px" }}>
                Your email address has been verified. You can now log in to access your organization's Drive.
              </p>
              <Link href="/login" className="btn-primary" style={{ textDecoration: "none", display: "inline-block", width: "100%" }}>
                Proceed to Sign In
              </Link>
            </>
          ) : (
            <>
              <div className="user-avatar" style={{ margin: "0 auto 20px auto", width: "56px", height: "56px", background: "rgba(99, 102, 241, 0.2)", color: "var(--accent-indigo)" }}>
                ✉
              </div>
              <h2 style={{ fontSize: "22px", fontWeight: "700", marginBottom: "12px" }}>Verify Your Email</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "14px", lineHeight: "1.5", marginBottom: "20px" }}>
                We sent a verification link and a 6-digit OTP code to <strong style={{ color: "#ffffff" }}>{email}</strong>.
              </p>

              <form onSubmit={handleVerifyOtp} style={{ marginBottom: "24px" }}>
                <div className="form-group" style={{ textAlign: "left" }}>
                  <label className="form-label" style={{ textAlign: "center", display: "block" }}>Enter 6-Digit OTP Code</label>
                  <input
                    type="text"
                    className="form-input"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    required
                    placeholder="e.g. 123456"
                    style={{ textAlign: "center", fontSize: "20px", letterSpacing: "8px", fontWeight: "700" }}
                    maxLength={6}
                    disabled={otpLoading}
                  />
                </div>

                {otpError && (
                  <div style={{ color: "var(--accent-danger)", fontSize: "14px", marginBottom: "12px" }}>
                    {otpError}
                  </div>
                )}

                <button type="submit" className="btn-primary" style={{ width: "100%" }} disabled={otpLoading}>
                  {otpLoading ? "Verifying..." : "Verify OTP Code"}
                </button>
              </form>

              <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "20px" }}>
                <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginBottom: "16px" }}>
                  Or simply click the verification button inside the email we sent you.
                </p>
                <Link href="/login" style={{ color: "var(--accent-indigo)", fontSize: "14px", fontWeight: "600", textDecoration: "none" }}>
                  Back to Sign In
                </Link>
              </div>
            </>
          )}
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

          <button type="submit" className="btn-primary" style={{ width: "100%", marginTop: "8px" }} disabled={loading || googleLoading}>
            {loading ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        {!invitationInfo && (
          <>
            <div className="auth-divider">or</div>

            <GoogleAuthButton
              label="Sign Up with Google"
              loading={googleLoading}
              disabled={loading}
              onClick={handleGoogleSignUp}
            />
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
