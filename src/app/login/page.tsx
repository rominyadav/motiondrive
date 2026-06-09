"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import "../drive.css";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [oauthWindow, setOauthWindow] = useState<any>(null);
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
    
    try {
      const { isTauri } = await import("@/lib/native-bridge");
      if (isTauri()) {
        setGoogleLoading(true);
        let intervalId: any = null;
        let windowInstance: any = null;

        try {
          const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
          
          // Request the OAuth authorization URL from Better-Auth without triggering a page redirect
          const res = await authClient.signIn.social({
            provider: "google",
            callbackURL: "/",
            disableRedirect: true,
          });

          if (res?.error) {
            throw new Error(res.error.message || "Failed to retrieve Google auth URL.");
          }

          if (!res?.data?.url) {
            throw new Error("No redirect URL returned by Better-Auth.");
          }

          const authUrl = res.data.url;
          const label = "google-oauth-" + Date.now();

          // Create secondary popup window loaded with Google's actual OAuth sign-in screen
          const win = new WebviewWindow(label, {
            url: authUrl,
            title: "Continue with Google",
            width: 500,
            height: 650,
            resizable: true,
            focus: true,
          });

          windowInstance = win;
          setOauthWindow(win);

          // Listen for close-requested/destroyed to clean up state if user manually closes it
          const unlistenClose = await win.onCloseRequested(() => {
            if (intervalId) clearInterval(intervalId);
            setGoogleLoading(false);
            setOauthWindow(null);
          });

          // Poll for session status every 1 second
          intervalId = setInterval(async () => {
            try {
              const session = await authClient.getSession();
              if (session && session.data) {
                // Successfully authenticated!
                clearInterval(intervalId);
                unlistenClose();
                try {
                  await win.close();
                } catch (closeErr) {}
                setGoogleLoading(false);
                setOauthWindow(null);
                router.push("/");
                router.refresh();
              }
            } catch (sessionErr) {
              console.error("Error checking session during Google OAuth:", sessionErr);
            }
          }, 1000);

        } catch (err: any) {
          console.error("Google sign in popup error:", err);
          setError(err?.message || "Failed to initialize Google login popup.");
          setGoogleLoading(false);
          if (intervalId) clearInterval(intervalId);
          if (windowInstance) {
            try {
              await windowInstance.close();
            } catch (closeErr) {}
          }
          setOauthWindow(null);
        }
      } else {
        // Standard browser/web-based redirect flow
        await authClient.signIn.social({
          provider: "google",
          callbackURL: "/",
        });
      }
    } catch (err) {
      console.error("Failed to sign in with Google:", err);
      setError("Failed to sign in with Google.");
      setGoogleLoading(false);
    }
  };

  const handleCancelGoogleSignIn = async () => {
    if (oauthWindow) {
      try {
        await oauthWindow.close();
      } catch (err) {
        console.error("Failed to close oauth window:", err);
      }
    }
    setGoogleLoading(false);
    setOauthWindow(null);
  };

  return (
    <div className="auth-wrapper" style={{ position: "relative" }}>
      <div className="auth-card animate-fade-in" style={{ position: "relative", overflow: "hidden" }}>
        {googleLoading && (
          <div className="auth-overlay animate-fade-in" style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(11, 13, 22, 0.95)",
            backdropFilter: "blur(12px)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 100,
            padding: "24px",
            textAlign: "center"
          }}>
            <button
              onClick={handleCancelGoogleSignIn}
              style={{
                position: "absolute",
                top: "20px",
                left: "20px",
                background: "transparent",
                border: "none",
                color: "var(--text-secondary, #9ca3af)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#ffffff";
                e.currentTarget.style.transform = "translateX(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-secondary, #9ca3af)";
                e.currentTarget.style.transform = "translateX(0)";
              }}
              type="button"
              title="Back to Login"
            >
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>
            <div className="spinner" style={{
              width: "48px",
              height: "48px",
              border: "3px solid rgba(99, 102, 241, 0.1)",
              borderTop: "3px solid var(--accent-indigo)",
              borderRadius: "50%",
              animation: "spin-loader 1s linear infinite",
              marginBottom: "24px"
            }} />
            <h2 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "8px", color: "#ffffff" }}>
              Google Authentication
            </h2>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "32px", maxWidth: "260px", lineHeight: "1.5" }}>
              Please complete your Google sign-in in the popup window.
            </p>
            <button
              onClick={handleCancelGoogleSignIn}
              className="btn-danger"
              style={{
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#f87171",
                padding: "10px 24px",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              type="button"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              Cancel Sign In
            </button>
          </div>
        )}

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

        <button onClick={handleGoogleSignIn} className="btn-oauth" type="button" disabled={loading || googleLoading}>
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
