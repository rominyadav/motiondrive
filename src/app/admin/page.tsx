"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { 
  listUsers, 
  listInvitations, 
  listAllSharedLinks,
  getPlatformUsageStats
} from "@/app/actions/admin";
import { 
  Users, 
  Mail, 
  ArrowLeft, 
  LogOut, 
  CheckCircle, 
  AlertTriangle, 
  Info, 
  Lock, 
  Share2,
  Activity
} from "lucide-react";
import Link from "next/link";
import "./admin.css";

// Modular Subcomponents
import { UsersTab } from "@/components/admin/UsersTab";
import { InvitesTab } from "@/components/admin/InvitesTab";
import { SharedLinksTab } from "@/components/admin/SharedLinksTab";
import { UsageTab } from "@/components/admin/UsageTab";

export default function AdminPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [invites, setInvitations] = useState<any[]>([]);
  const [allLinks, setAllLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Tabs and Filters State
  const [activeTab, setActiveTab] = useState<"users" | "invites" | "shared_links" | "usage">("users");
  const [usageStats, setUsageStats] = useState<any>(null);
  const [usageLoading, setUsageLoading] = useState(false);

  const router = useRouter();

  // Toast / Notification State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"info" | "success" | "error">("info");

  // Toast message auto-dismiss
  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  const showToast = (msg: string, type: "info" | "success" | "error" = "info") => {
    setToastMessage(msg);
    setToastType(type);
  };

  const fetchUsageStats = async () => {
    setUsageLoading(true);
    try {
      const stats = await getPlatformUsageStats();
      setUsageStats(stats);
    } catch (err) {
      console.error("Failed to load platform usage stats", err);
    } finally {
      setUsageLoading(false);
    }
  };

  const handleRefreshAll = async () => {
    try {
      const [loadedUsers, loadedInvites, stats] = await Promise.all([
        listUsers(),
        listInvitations(),
        getPlatformUsageStats()
      ]);
      setUsers(loadedUsers);
      setInvitations(loadedInvites);
      setUsageStats(stats);

      const { data: session } = await authClient.getSession();
      const user = session?.user as any;
      if (user?.role === "admin") {
        const loadedLinks = await listAllSharedLinks();
        setAllLinks(loadedLinks);
      }
    } catch (err) {
      console.error("Failed to refresh data:", err);
    }
  };

  useEffect(() => {
    async function loadAdminData() {
      // 1. Get current session
      const { data: session } = await authClient.getSession();
      
      if (!session) {
        router.push("/login");
        return;
      }

      const user = session.user as any;
      if (user.role !== "admin" && user.role !== "manager") {
        router.push("/");
        return;
      }

      setCurrentUser(user);

      // 2. Load users & invites
      try {
        const [loadedUsers, loadedInvites] = await Promise.all([
          listUsers(),
          listInvitations()
        ]);
        setUsers(loadedUsers);
        setInvitations(loadedInvites);

        if (user.role === "admin") {
          const loadedLinks = await listAllSharedLinks();
          setAllLinks(loadedLinks);
        }

        // Fetch usage stats
        const stats = await getPlatformUsageStats();
        setUsageStats(stats);
      } catch (err) {
        console.error("Failed to load admin data", err);
      } finally {
        setLoading(false);
      }
    }
    loadAdminData();
  }, [router]);

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  };

  if (loading) {
    return (
      <div className="admin-body" style={{ 
        alignItems: "center", 
        justifyContent: "center",
        position: "relative",
        background: "radial-gradient(circle at center, rgba(99, 102, 241, 0.08) 0%, #09090b 70%)",
        flexDirection: "column",
        minHeight: "100vh"
      }}>
        {/* Glowing background circle for visual depth */}
        <div style={{
          position: "absolute",
          width: "300px",
          height: "300px",
          background: "radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, transparent 70%)",
          filter: "blur(50px)",
          top: "calc(50% - 150px)",
          left: "calc(50% - 150px)",
          animation: "pulse-glow 3s infinite ease-in-out",
          pointerEvents: "none"
        }} />

        <div className="glass animate-fade-in" style={{
          padding: "48px",
          borderRadius: "24px",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 0 50px rgba(99, 102, 241, 0.08)",
          maxWidth: "420px",
          textAlign: "center",
          zIndex: 10,
          background: "rgba(18, 18, 21, 0.7)",
          backdropFilter: "blur(12px)"
        }}>
          {/* Circular progress loader container */}
          <div style={{ position: "relative", width: "72px", height: "72px", marginBottom: "28px" }}>
            {/* outer track */}
            <div style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              border: "3px solid rgba(255, 255, 255, 0.03)"
            }} />
            {/* inner spinning glowing arc */}
            <div style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              border: "3px solid transparent",
              borderTopColor: "#6366f1",
              borderRightColor: "#3b82f6",
              animation: "spin 1.2s infinite cubic-bezier(0.4, 0.1, 0.6, 1)",
              boxShadow: "0 0 15px rgba(99, 102, 241, 0.25)"
            }} />
            {/* Center glowing dot */}
            <div style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              backgroundColor: "#6366f1",
              boxShadow: "0 0 12px #6366f1"
            }} />
          </div>

          <h2 style={{ 
            fontSize: "22px", 
            fontWeight: "800", 
            letterSpacing: "-0.5px", 
            marginBottom: "8px",
            background: "linear-gradient(135deg, #ffffff, #a1a1aa)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent"
          }}>
            Workspace Control
          </h2>
          <p style={{ 
            fontSize: "14px", 
            color: "#a1a1aa",
            animation: "pulse-glow 2s infinite ease-in-out",
            fontWeight: "500",
            letterSpacing: "0.2px"
          }}>
            Verifying administrative permissions...
          </p>
        </div>
      </div>
    );
  }

  const isAdmin = currentUser?.role === "admin";

  return (
    <div className="admin-body">
      {/* HEADER */}
      <header className="admin-header">
        <div className="admin-header-left">
          <Link href="/" className="admin-back-btn">
            <ArrowLeft size={14} /> Back to Drive
          </Link>
          <h1 className="admin-header-title">Workspace Control</h1>
        </div>

        <div className="admin-header-right">
          <div className="admin-profile">
            <div className="admin-avatar">{currentUser?.name?.charAt(0)}</div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#ffffff" }}>{currentUser?.name}</span>
              <span className="admin-role-badge" style={{ alignSelf: "flex-start", marginTop: "2px" }}>{currentUser?.role}</span>
            </div>
          </div>
          <button onClick={handleSignOut} className="admin-signout-btn" title="Sign Out">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* DASHBOARD */}
      <main className="admin-main">
        {/* Tab switcher row */}
        <div className="admin-tabs-row">
          <div className="admin-tabs">
            <button 
              className={`admin-tab ${activeTab === "users" ? "active" : ""}`}
              onClick={() => setActiveTab("users")}
            >
              <Users size={16} />
              <span>Users Directory</span>
            </button>
            <button 
              className={`admin-tab ${activeTab === "invites" ? "active" : ""}`}
              onClick={() => setActiveTab("invites")}
            >
              <Mail size={16} />
              <span>Invitations & Access</span>
            </button>
            {isAdmin ? (
              <button 
                className={`admin-tab ${activeTab === "shared_links" ? "active" : ""}`}
                onClick={() => setActiveTab("shared_links")}
              >
                <Share2 size={16} />
                <span>Global Shared Links</span>
              </button>
            ) : (
              <div className="admin-tab" style={{ opacity: 0.4, cursor: "not-allowed" }} title="Administrators only">
                <Lock size={14} />
                <span>Shared Links (Restricted)</span>
              </div>
            )}
            <button 
              className={`admin-tab ${activeTab === "usage" ? "active" : ""}`}
              onClick={() => setActiveTab("usage")}
            >
              <Activity size={16} />
              <span>System Storage & Usage</span>
            </button>
          </div>
        </div>

        {/* TAB 1: USERS DIRECTORY */}
        <div className={`tab-content ${activeTab === "users" ? "active" : ""}`}>
          <UsersTab 
            users={users} 
            currentUser={currentUser} 
            isAdmin={isAdmin} 
            onRefresh={handleRefreshAll} 
            showToast={showToast} 
          />
        </div>

        {/* TAB 2: INVITATIONS & ACCESS */}
        <div className={`tab-content ${activeTab === "invites" ? "active" : ""}`}>
          <InvitesTab 
            invites={invites} 
            isAdmin={isAdmin} 
            onRefresh={handleRefreshAll} 
            showToast={showToast} 
          />
        </div>

        {/* TAB 3: GLOBAL SHARED LINKS (Admin-only) */}
        {isAdmin && (
          <div className={`tab-content ${activeTab === "shared_links" ? "active" : ""}`}>
            <SharedLinksTab 
              allLinks={allLinks} 
              users={users} 
              onRefresh={handleRefreshAll} 
              showToast={showToast} 
            />
          </div>
        )}

        {/* TAB 4: SYSTEM STORAGE & USAGE */}
        {activeTab === "usage" && (
          <UsageTab 
            usageStats={usageStats} 
            usageLoading={usageLoading} 
            onRefreshStats={fetchUsageStats} 
          />
        )}
      </main>

      {/* TOAST OVERLAY */}
      {toastMessage && (
        <div 
          style={{
            position: "fixed",
            bottom: "24px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(18, 18, 21, 0.9)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "12px",
            padding: "12px 24px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "0.85rem",
            color: "#ffffff",
            boxShadow: "0 10px 25px rgba(0,0,0,0.4)",
            zIndex: 1000
          }}
        >
          {toastType === "success" && <CheckCircle size={16} style={{ color: "#34d399" }} />}
          {toastType === "error" && <AlertTriangle size={16} style={{ color: "#f87171" }} />}
          {toastType === "info" && <Info size={16} style={{ color: "#6366f1" }} />}
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
