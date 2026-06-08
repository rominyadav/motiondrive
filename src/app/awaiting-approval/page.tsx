"use client";

import { useEffect } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import "../drive.css";

export default function AwaitingApprovalPage() {
  const router = useRouter();

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const checkStatus = async () => {
      try {
        const { data: sessionData } = await authClient.getSession();
        if (!sessionData) {
          router.push("/login");
          return;
        }
        
        const user = sessionData.user as any;
        if (user && user.status === "approved") {
          router.push("/");
          router.refresh();
        }
      } catch (err) {
        console.error("Error polling approval status:", err);
      }
    };

    // Check immediately on mount
    checkStatus();

    // Polling interval of 4 seconds
    intervalId = setInterval(checkStatus, 4000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [router]);

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card animate-fade-in" style={{ textAlign: "center", maxWidth: "460px" }}>
        <div 
          style={{ 
            width: "64px", 
            height: "64px", 
            borderRadius: "50%", 
            backgroundColor: "var(--accent-indigo-glow)", 
            color: "var(--accent-indigo)", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center",
            margin: "0 auto 24px auto",
            animation: "pulse-glow 2s infinite"
          }}
        >
          <Clock size={32} />
        </div>

        <h1 className="auth-title" style={{ fontSize: "22px", marginBottom: "12px" }}>
          Awaiting Admin Approval
        </h1>
        
        <p style={{ color: "var(--text-secondary)", fontSize: "14px", lineHeight: "1.6", marginBottom: "24px" }}>
          Your account has been created successfully, but your organization requires an administrator to approve your access before you can open the Web Drive.
        </p>

        <div style={{ padding: "16px", borderRadius: "10px", backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-color)", marginBottom: "24px" }}>
          <p style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: "500" }}>
            Need immediate access? Contact your administrator or project coordinator to approve your registration.
          </p>
        </div>

        <button 
          onClick={handleSignOut} 
          className="btn-secondary" 
          style={{ width: "100%", justifyContent: "center", height: "42px" }}
        >
          Sign Out of Account
        </button>
      </div>
    </div>
  );
}
