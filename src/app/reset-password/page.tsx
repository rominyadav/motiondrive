"use client";

import { useState, useEffect, Suspense } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter, useSearchParams } from "next/navigation";
import { resetPasswordOTP } from "@/app/actions/auth";
import Link from "next/link";
import "../drive.css";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  // State
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isOtpMode, setIsOtpMode] = useState(false);

  // OTP and New Password state
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Direct Reset Link state (when token is in URL)
  const [isDirectLinkMode, setIsDirectLinkMode] = useState(false);

  useEffect(() => {
    if (token) {
      setIsDirectLinkMode(true);
    }
  }, [token]);

  // Handler for Option 1: Request Password Reset (Email)
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setLoading(true);

    try {
      const response = await authClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password",
      });

      if (response.error) {
        setError(response.error.message || "Failed to send reset request.");
      } else {
        setSuccessMessage(`We sent a password reset link and a 6-digit OTP code to ${email}.`);
        setIsOtpMode(true);
      }
    } catch (err) {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  // Handler for Option A: Reset via OTP
  const handleResetViaOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (otp.length !== 6) {
      setError("OTP must be exactly 6 digits.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await resetPasswordOTP(email, otp, newPassword);
      if (res.success) {
        setSuccessMessage("Your password has been reset successfully!");
        setTimeout(() => {
          router.push("/login");
        }, 2000);
      } else {
        setError(res.error || "Failed to reset password via OTP.");
      }
    } catch (err) {
      setError("Failed to reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handler for Option B: Direct Reset via Link (Token in URL)
  const handleDirectLinkReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await authClient.resetPassword({
        newPassword,
        token: token || undefined,
      });

      if (response.error) {
        setError(response.error.message || "Failed to reset password via verification link.");
      } else {
        setSuccessMessage("Your password has been reset successfully!");
        setTimeout(() => {
          router.push("/login");
        }, 2000);
      }
    } catch (err) {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card animate-fade-in" style={{ padding: "32px 24px" }}>
        <h1 className="auth-title">
          Motionsewa <span style={{ color: "var(--accent-indigo)" }}>Drive</span>
        </h1>

        {error && (
          <div style={{ color: "var(--accent-danger)", fontSize: "14px", marginBottom: "16px", textAlign: "center" }}>
            {error}
          </div>
        )}

        {successMessage && (
          <div style={{ color: "var(--accent-success)", fontSize: "14px", marginBottom: "16px", textAlign: "center" }}>
            {successMessage}
          </div>
        )}

        {/* State 1: Direct Link Mode (from email click) */}
        {isDirectLinkMode && (
          <form onSubmit={handleDirectLinkReset}>
            <p className="auth-subtitle">Choose a new secure password</p>

            <div className="form-group">
              <label className="form-label">New Password</label>
              <input
                type="password"
                className="form-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                placeholder="••••••••"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <input
                type="password"
                className="form-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                placeholder="••••••••"
                disabled={loading}
              />
            </div>

            <button type="submit" className="btn-primary" style={{ width: "100%", marginTop: "8px" }} disabled={loading}>
              {loading ? "Resetting Password..." : "Reset Password"}
            </button>
          </form>
        )}

        {/* State 2: OTP Entry Mode (just after requesting reset on screen) */}
        {!isDirectLinkMode && isOtpMode && (
          <form onSubmit={handleResetViaOtp}>
            <p className="auth-subtitle">Verify OTP and enter a new password</p>

            <div className="form-group" style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "24px" }}>
              <label className="form-label" style={{ textAlign: "center", display: "block", marginBottom: "16px", color: "var(--text-secondary)" }}>
                Enter 6-Digit Security Code
              </label>
              
              {/* Styled OTP Slots */}
              <div 
                style={{ 
                  display: "flex", 
                  gap: "10px", 
                  justifyContent: "center", 
                  position: "relative",
                  cursor: "text",
                  marginBottom: "8px"
                }}
                onClick={() => document.getElementById("otp-hidden-input")?.focus()}
              >
                {[0, 1, 2, 3, 4, 5].map((index) => {
                  const digit = otp[index] || "";
                  const isFocused = otp.length === index || (otp.length === 6 && index === 5);
                  return (
                    <div
                      key={index}
                      style={{
                        width: "44px",
                        height: "50px",
                        borderRadius: "10px",
                        border: isFocused 
                          ? "2px solid var(--accent-indigo)" 
                          : "1px solid var(--border-color)",
                        background: isFocused
                          ? "rgba(99, 102, 241, 0.08)"
                          : "rgba(255, 255, 255, 0.03)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "20px",
                        fontWeight: "700",
                        color: digit ? "#ffffff" : "rgba(255, 255, 255, 0.15)",
                        transition: "all 0.2s ease",
                        boxShadow: isFocused 
                          ? "0 0 10px rgba(99, 102, 241, 0.25)" 
                          : "none",
                      }}
                    >
                      {digit || "•"}
                    </div>
                  );
                })}
              </div>

              {/* Invisible input to capture typing */}
              <input
                id="otp-hidden-input"
                type="text"
                pattern="\d*"
                inputMode="numeric"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                style={{
                  position: "absolute",
                  opacity: 0,
                  width: "1px",
                  height: "1px",
                  overflow: "hidden",
                  pointerEvents: "none"
                }}
                required
                maxLength={6}
                autoFocus
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label className="form-label">New Password</label>
              <input
                type="password"
                className="form-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                placeholder="••••••••"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <input
                type="password"
                className="form-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                placeholder="••••••••"
                disabled={loading}
              />
            </div>

            <button type="submit" className="btn-primary" style={{ width: "100%", marginTop: "8px" }} disabled={loading}>
              {loading ? "Resetting Password..." : "Reset Password"}
            </button>

            <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "20px", marginTop: "24px", textAlign: "center" }}>
              <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginBottom: "12px" }}>
                Or simply click the reset button inside the email we sent you.
              </p>
              <button 
                type="button" 
                onClick={() => setIsOtpMode(false)} 
                style={{ background: "none", border: "none", color: "var(--accent-indigo)", fontSize: "14px", fontWeight: "600", cursor: "pointer" }}
              >
                Back to Request Email
              </button>
            </div>
          </form>
        )}

        {/* State 3: Email Request Mode */}
        {!isDirectLinkMode && !isOtpMode && (
          <form onSubmit={handleRequestReset}>
            <p className="auth-subtitle">Enter your email address to receive password reset instructions</p>

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="editor@motionsewa.com"
                disabled={loading}
              />
            </div>

            <button type="submit" className="btn-primary" style={{ width: "100%", marginTop: "8px" }} disabled={loading}>
              {loading ? "Sending Request..." : "Send Reset Code & Link"}
            </button>

            <div style={{ marginTop: "24px", textAlign: "center", fontSize: "14px", color: "var(--text-secondary)" }}>
              Remembered your password?{" "}
              <Link href="/login" style={{ color: "var(--accent-indigo)", fontWeight: "600" }}>
                Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="auth-wrapper">
        <div className="auth-card" style={{ textAlign: "center" }}>
          <h3>Loading...</h3>
        </div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
