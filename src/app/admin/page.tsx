"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { 
  inviteUser, 
  listUsers, 
  listInvitations, 
  updateUserStatus, 
  updateUserStorageLimit, 
  updateUserRole, 
  revokeInvitation,
  listAllSharedLinks,
  adminRevokeSharedLink,
  adminExtendSharedLink,
  getPlatformUsageStats
} from "@/app/actions/admin";
import { 
  Users, 
  Mail, 
  ShieldAlert, 
  ArrowLeft, 
  LogOut, 
  CheckCircle, 
  AlertTriangle, 
  Info, 
  Link as LinkIcon, 
  Clock, 
  Share2,
  Calendar,
  Lock,
  HardDrive,
  Database,
  Activity,
  FileText,
  Search,
  File,
  Video,
  Image,
  Music,
  HelpCircle
} from "lucide-react";
import Link from "next/link";
import "./admin.css";

export default function AdminPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [invites, setInvitations] = useState<any[]>([]);
  const [allLinks, setAllLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Tabs and Filters State
  const [activeTab, setActiveTab] = useState<"users" | "invites" | "shared_links" | "usage">("users");
  const [userFilter, setUserFilter] = useState<"all" | "approved" | "pending" | "suspended">("all");
  const [usageStats, setUsageStats] = useState<any>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [itemsSearchQuery, setItemsSearchQuery] = useState("");
  const [itemsDriveFilter, setItemsDriveFilter] = useState<"all" | "personal" | "shared" | "archive">("all");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "manager" | "staff">("staff");
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
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

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteMessage("");
    setInviteLoading(true);

    try {
      const res = await inviteUser(inviteEmail, inviteRole);
      if (res.success) {
        setInviteMessage(`Successfully invited ${inviteEmail}!`);
        setInviteEmail("");
        const updated = await listInvitations();
        setInvitations(updated);
      }
    } catch (err: any) {
      setInviteMessage(err.message || "Failed to send invitation.");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRevokeInvite = async (invitationId: string, email: string) => {
    if (!confirm(`Are you sure you want to revoke the invitation for ${email}?`)) {
      return;
    }

    try {
      await revokeInvitation(invitationId);
      showToast(`Successfully revoked invitation for ${email}!`, "success");
      const updated = await listInvitations();
      setInvitations(updated);
    } catch (err) {
      showToast("Failed to revoke invitation", "error");
    }
  };

  const handleUpdateStatus = async (userId: string, newStatus: "approved" | "suspended" | "pending") => {
    try {
      await updateUserStatus(userId, newStatus);
      const updated = await listUsers();
      setUsers(updated);
      showToast(`User status updated to ${newStatus}!`, "success");
    } catch (err) {
      showToast("Failed to update user status", "error");
    }
  };

  const handleRevokeLink = async (id: string) => {
    if (!confirm("Are you sure you want to instantly expire/revoke this shared link?")) {
      return;
    }
    try {
      await adminRevokeSharedLink(id);
      showToast("Shared link successfully revoked!", "success");
      const updated = await listAllSharedLinks();
      setAllLinks(updated);
    } catch (err) {
      showToast("Failed to revoke shared link", "error");
    }
  };

  const handleExtendLink = async (id: string, hours = 24) => {
    try {
      await adminExtendSharedLink(id, hours);
      showToast(`Link expiration extended by +${hours} hours!`, "success");
      const updated = await listAllSharedLinks();
      setAllLinks(updated);
    } catch (err) {
      showToast("Failed to extend shared link", "error");
    }
  };

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  };

  // Filter users based on local state selection
  const filteredUsers = users.filter((u) => {
    if (userFilter === "all") return true;
    return u.status === userFilter;
  });

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

  const renderImmichStatNumber = (num: number, padLength = 12, suffix = "") => {
    const str = num.toString();
    if (str.length >= padLength) {
      return (
        <span style={{ fontFamily: "monospace", letterSpacing: "1px", fontSize: "1.8rem", fontWeight: "bold" }}>
          {str} {suffix && <span style={{ fontSize: "0.8rem", opacity: 0.5, marginLeft: "4px" }}>{suffix}</span>}
        </span>
      );
    }
    const padCount = padLength - str.length;
    const padding = "0".repeat(padCount);
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
        {suffix && (
          <span style={{ fontSize: "0.75rem", fontFamily: "monospace", color: "#a1a1aa", opacity: 0.7, marginBottom: "-2px" }}>
            {suffix}
          </span>
        )}
        <span style={{ fontFamily: "monospace", letterSpacing: "2px", fontSize: "1.8rem", fontWeight: "700" }}>
          <span style={{ color: "rgba(255, 255, 255, 0.08)" }}>{padding}</span>
          <span style={{ color: "#38bdf8", textShadow: "0 0 10px rgba(56, 189, 248, 0.2)" }}>{str}</span>
        </span>
      </div>
    );
  };

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
          <div className="panel-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
              <h2 className="panel-card-title" style={{ margin: 0 }}>
                <Users size={18} style={{ color: "#6366f1" }} />
                <span>Registered Users Directory</span>
              </h2>
              <div className="filter-pills">
                <button 
                  className={`filter-pill ${userFilter === "all" ? "active" : ""}`}
                  onClick={() => setUserFilter("all")}
                >
                  All ({users.length})
                </button>
                <button 
                  className={`filter-pill ${userFilter === "approved" ? "active" : ""}`}
                  onClick={() => setUserFilter("approved")}
                >
                  Approved ({users.filter(u => u.status === "approved").length})
                </button>
                <button 
                  className={`filter-pill ${userFilter === "pending" ? "active" : ""}`}
                  onClick={() => setUserFilter("pending")}
                >
                  Pending ({users.filter(u => u.status === "pending").length})
                </button>
                <button 
                  className={`filter-pill ${userFilter === "suspended" ? "active" : ""}`}
                  onClick={() => setUserFilter("suspended")}
                >
                  Suspended ({users.filter(u => u.status === "suspended").length})
                </button>
              </div>
            </div>

            {filteredUsers.length === 0 ? (
              <p style={{ color: "#71717a", fontSize: "0.9rem", padding: "16px 0" }}>No users match the selected status filter.</p>
            ) : (
              <div className="scrollable-table-container">
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>User Details</th>
                      <th>System Role</th>
                      <th>Status</th>
                      <th>Storage Quota</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <div className="user-identity">
                            <div className="admin-avatar" style={{ background: u.status === "suspended" ? "#ef4444" : "#27272a", width: "28px", height: "28px", fontSize: "0.75rem" }}>
                              {u.name?.charAt(0)}
                            </div>
                            <div className="user-text">
                              <span className="user-fullname">{u.name}</span>
                              <span className="user-email-addr">{u.email}</span>
                            </div>
                          </div>
                        </td>

                        <td>
                          {isAdmin && u.id !== currentUser.id ? (
                            <select
                              className="sleek-select"
                              value={u.role}
                              onChange={async (e) => {
                                const newRole = e.target.value as "admin" | "manager" | "staff";
                                try {
                                  await updateUserRole(u.id, newRole);
                                  showToast(`Updated role for ${u.name} to ${newRole}!`, "success");
                                  const updated = await listUsers();
                                  setUsers(updated);
                                } catch (err: any) {
                                  showToast(err.message || "Failed to update role", "error");
                                }
                              }}
                            >
                              <option value="staff">staff</option>
                              <option value="manager">manager</option>
                              <option value="admin">admin</option>
                            </select>
                          ) : (
                            <span className="soft-badge" style={{ background: u.role === "admin" ? "rgba(99, 102, 241, 0.1)" : "rgba(255, 255, 255, 0.03)", color: u.role === "admin" ? "#818cf8" : "#a1a1aa" }}>
                              {u.role}
                            </span>
                          )}
                        </td>

                        <td>
                          <span className={`soft-badge ${u.status}`}>
                            {u.status}
                          </span>
                        </td>

                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <input
                              type="number"
                              className="sleek-input"
                              style={{ width: "65px", padding: "4px 8px", fontSize: "0.8rem", textAlign: "center" }}
                              defaultValue={((u.storageLimit || 107374182400) / (1024 * 1024 * 1024)).toFixed(0)}
                              onBlur={async (e) => {
                                const val = parseInt(e.target.value);
                                if (isNaN(val) || val <= 0) return;
                                const bytes = val * 1024 * 1024 * 1024;
                                if (bytes === (u.storageLimit || 107374182400)) return;
                                try {
                                  await updateUserStorageLimit(u.id, bytes);
                                  showToast(`Quota for ${u.name} set to ${val} GB!`, "success");
                                } catch (err) {
                                  showToast("Failed to update storage limit", "error");
                                }
                              }}
                            />
                            <span style={{ fontSize: "0.75rem", color: "#71717a" }}>GB</span>
                          </div>
                        </td>

                        <td>
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                            {u.id !== currentUser.id && (
                              <>
                                {u.status !== "approved" && (
                                  <button onClick={() => handleUpdateStatus(u.id, "approved")} className="action-btn approve">
                                    Approve
                                  </button>
                                )}
                                {u.status !== "suspended" && (
                                  <button onClick={() => handleUpdateStatus(u.id, "suspended")} className="action-btn suspend">
                                    Suspend
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* TAB 2: INVITATIONS & ACCESS */}
        <div className={`tab-content ${activeTab === "invites" ? "active" : ""}`}>
          <div className="tab-panel-grid">
            {/* List left */}
            <div className="panel-card">
              <h2 className="panel-card-title">
                <Mail size={18} style={{ color: "#6366f1" }} />
                <span>Pending Invitations ({invites.length})</span>
              </h2>

              {invites.length === 0 ? (
                <p style={{ color: "#71717a", fontSize: "0.9rem" }}>No pending invitations found.</p>
              ) : (
                <div className="scrollable-table-container">
                  <table className="modern-table">
                    <thead>
                      <tr>
                        <th>Invited Email</th>
                        <th>Assigned Role</th>
                        <th>Expiration</th>
                        <th style={{ textAlign: "right" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invites.map((inv) => (
                        <tr key={inv.id}>
                          <td style={{ fontWeight: 500, color: "#e4e4e7" }}>{inv.email}</td>
                          <td>
                            <span className="soft-badge" style={{ background: "rgba(255, 255, 255, 0.02)", color: "#a1a1aa" }}>{inv.role}</span>
                          </td>
                          <td style={{ color: "#71717a", fontSize: "0.8rem" }}>
                            {new Date(inv.expiresAt).toLocaleDateString()}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <button onClick={() => handleRevokeInvite(inv.id, inv.email)} className="action-btn revoke">
                              Revoke
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Invite right */}
            <div className="panel-card">
              <h2 className="panel-card-title">
                <ShieldAlert size={18} style={{ color: "#6366f1" }} />
                <span>Invite New Staff</span>
              </h2>
              <p style={{ fontSize: "0.8rem", color: "#71717a", lineHeight: "1.5", marginBottom: "20px" }}>
                Send an email invitation. Accepting the invite link automatically approves them in the workspace.
              </p>

              {inviteMessage && (
                <div className={`alert-card ${inviteMessage.includes("Successfully") ? "success" : "error"}`} style={{ marginBottom: "20px" }}>
                  {inviteMessage}
                </div>
              )}

              <form onSubmit={handleInvite} className="invite-form">
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    className="sleek-input"
                    placeholder="editor@motionsewa.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Default Role</label>
                  <select 
                    className="sleek-select"
                    style={{ padding: "10px", fontSize: "0.85rem" }}
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as any)}
                  >
                    <option value="staff">Staff (Video Editor / Creator)</option>
                    <option value="manager">Manager (User approver)</option>
                    {isAdmin && <option value="admin">Admin (Controller)</option>}
                  </select>
                </div>

                <button type="submit" className="primary-btn" style={{ width: "100%", marginTop: "10px" }} disabled={inviteLoading}>
                  {inviteLoading ? "Sending invite..." : "Send Email Invitation"}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* TAB 3: GLOBAL SHARED LINKS (Admin-only) */}
        {isAdmin && (
          <div className={`tab-content ${activeTab === "shared_links" ? "active" : ""}`}>
            <div className="panel-card">
              <h2 className="panel-card-title">
                <Share2 size={18} style={{ color: "#6366f1" }} />
                <span>Global Shared Links Directory ({allLinks.length})</span>
              </h2>
              <p style={{ fontSize: "0.8rem", color: "#71717a", marginBottom: "24px" }}>
                Revoke or extend any shared file or folder link created by users on this system.
              </p>

              {allLinks.length === 0 ? (
                <p style={{ color: "#71717a", fontSize: "0.9rem" }}>No active shared links found.</p>
              ) : (
                <div className="scrollable-table-container">
                  <table className="modern-table">
                    <thead>
                      <tr>
                        <th>Asset Name</th>
                        <th>Created By</th>
                        <th>Expiration Time</th>
                        <th>Status</th>
                        <th style={{ textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allLinks.map((link) => {
                        const creator = users.find((u) => u.id === link.userId);
                        const creatorName = creator ? creator.name : "Unknown User";

                        const isExpired = new Date() > new Date(link.expiresAt);
                        const status = link.isRevoked 
                          ? "revoked" 
                          : isExpired 
                          ? "expired" 
                          : "active";

                        return (
                          <tr key={link.id}>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 500, color: "#e4e4e7" }} title={link.filename}>
                                <LinkIcon size={14} style={{ color: "#818cf8" }} />
                                <span>{link.filename}</span>
                              </div>
                            </td>

                            <td style={{ color: "#a1a1aa" }}>{creatorName}</td>

                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8rem", color: "#71717a" }}>
                                <Clock size={12} />
                                <span>{new Date(link.expiresAt).toLocaleString()}</span>
                              </div>
                            </td>

                            <td>
                              <span className={`soft-badge ${status === "active" ? "approved" : status === "expired" ? "pending" : "revoked"}`}>
                                {status}
                              </span>
                            </td>

                            <td>
                              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                                {status === "active" && (
                                  <button onClick={() => handleRevokeLink(link.id)} className="action-btn revoke">
                                    Revoke
                                  </button>
                                )}
                                <button onClick={() => handleExtendLink(link.id, 24)} className="action-btn extend">
                                  +24h
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: SYSTEM STORAGE & USAGE */}
        {activeTab === "usage" && (
          <div className="tab-content active" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            
            {/* Main Title Section */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 className="panel-card-title" style={{ fontSize: "1.5rem", marginBottom: "4px" }}>
                  <HardDrive size={22} style={{ color: "#06b6d4" }} />
                  <span>Platform Storage & Server Stats</span>
                </h2>
                <p style={{ fontSize: "0.85rem", color: "#71717a" }}>
                  Real-time active storage usage across all object storage systems and user workspaces.
                </p>
              </div>
              <button 
                onClick={fetchUsageStats} 
                className="action-btn extend" 
                style={{ padding: "8px 16px", borderRadius: "8px", fontSize: "0.8rem" }}
                disabled={usageLoading}
              >
                {usageLoading ? "Refreshing..." : "Refresh Stats"}
              </button>
            </div>

            {usageLoading || !usageStats ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0", gap: "16px" }}>
                <div className="spin-anim" style={{ width: "40px", height: "40px", border: "3px solid #06b6d4", borderTopColor: "transparent", borderRadius: "50%" }} />
                <p style={{ color: "#71717a", fontSize: "0.9rem" }}>Fetching real-time S3 bucket and database storage stats...</p>
              </div>
            ) : (
              <>
                {/* IMMICH INSPIRED SERVER STATS ROW */}
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <h3 style={{ fontSize: "1.05rem", fontWeight: 600, color: "#e4e4e7" }}>Total usage</h3>
                  
                  <div style={{ 
                    display: "grid", 
                    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", 
                    gap: "20px" 
                  }}>
                    {/* CARD 1: Personal Drive Items */}
                    <div style={{
                      background: "rgba(24, 24, 27, 0.7)",
                      border: "1px solid rgba(255, 255, 255, 0.05)",
                      borderRadius: "16px",
                      padding: "24px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      minHeight: "130px",
                      boxShadow: "0 4px 20px rgba(0, 0, 0, 0.2)",
                      transition: "transform 0.2s ease, border-color 0.2s ease"
                    }} className="immich-stat-card">
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ 
                          width: "36px", 
                          height: "36px", 
                          borderRadius: "50%", 
                          background: "rgba(56, 189, 248, 0.1)", 
                          display: "flex", 
                          alignItems: "center", 
                          justifyContent: "center" 
                        }}>
                          <FileText size={18} style={{ color: "#38bdf8" }} />
                        </div>
                        <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "#a1a1aa" }}>Personal Drive Items</span>
                      </div>
                      <div style={{ alignSelf: "flex-end", marginTop: "16px" }}>
                        {renderImmichStatNumber(usageStats.personal.totalItems, 12, "ITEMS")}
                      </div>
                    </div>

                    {/* CARD 2: Personal Drive Size */}
                    <div style={{
                      background: "rgba(24, 24, 27, 0.7)",
                      border: "1px solid rgba(255, 255, 255, 0.05)",
                      borderRadius: "16px",
                      padding: "24px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      minHeight: "130px",
                      boxShadow: "0 4px 20px rgba(0, 0, 0, 0.2)"
                    }} className="immich-stat-card">
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ 
                          width: "36px", 
                          height: "36px", 
                          borderRadius: "50%", 
                          background: "rgba(99, 102, 241, 0.1)", 
                          display: "flex", 
                          alignItems: "center", 
                          justifyContent: "center" 
                        }}>
                          <HardDrive size={18} style={{ color: "#6366f1" }} />
                        </div>
                        <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "#a1a1aa" }}>Personal Drive Space</span>
                      </div>
                      <div style={{ alignSelf: "flex-end", marginTop: "16px" }}>
                        {renderImmichStatNumber(
                          Math.max(0, Math.round(usageStats.personal.totalSize / (1024 * 1024 * 1024))), 
                          12, 
                          "GiB"
                        )}
                      </div>
                    </div>

                    {/* CARD 3: Shared Drive Space */}
                    <div style={{
                      background: "rgba(24, 24, 27, 0.7)",
                      border: "1px solid rgba(255, 255, 255, 0.05)",
                      borderRadius: "16px",
                      padding: "24px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      minHeight: "130px",
                      boxShadow: "0 4px 20px rgba(0, 0, 0, 0.2)"
                    }} className="immich-stat-card">
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ 
                          width: "36px", 
                          height: "36px", 
                          borderRadius: "50%", 
                          background: "rgba(16, 185, 129, 0.1)", 
                          display: "flex", 
                          alignItems: "center", 
                          justifyContent: "center" 
                        }}>
                          <Share2 size={18} style={{ color: "#10b981" }} />
                        </div>
                        <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "#a1a1aa" }}>Shared Drive Space</span>
                      </div>
                      <div style={{ alignSelf: "flex-end", marginTop: "16px" }}>
                        {renderImmichStatNumber(
                          Math.max(0, Math.round(usageStats.shared.totalSize / (1024 * 1024 * 1024))), 
                          12, 
                          "GiB"
                        )}
                      </div>
                    </div>

                    {/* CARD 4: Archive Drive Space */}
                    <div style={{
                      background: "rgba(24, 24, 27, 0.7)",
                      border: "1px solid rgba(255, 255, 255, 0.05)",
                      borderRadius: "16px",
                      padding: "24px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      minHeight: "130px",
                      boxShadow: "0 4px 20px rgba(0, 0, 0, 0.2)"
                    }} className="immich-stat-card">
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ 
                          width: "36px", 
                          height: "36px", 
                          borderRadius: "50%", 
                          background: "rgba(245, 158, 11, 0.1)", 
                          display: "flex", 
                          alignItems: "center", 
                          justifyContent: "center" 
                        }}>
                          <Database size={18} style={{ color: "#f59e0b" }} />
                        </div>
                        <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "#a1a1aa" }}>Archive Drive Space</span>
                      </div>
                      <div style={{ alignSelf: "flex-end", marginTop: "16px" }}>
                        {renderImmichStatNumber(
                          Math.max(0, Math.round(usageStats.archive.totalSize / (1024 * 1024 * 1024))), 
                          12, 
                          "GiB"
                        )}
                      </div>
                    </div>

                    {/* CARD 5: Total Projects */}
                    <div style={{
                      background: "rgba(24, 24, 27, 0.7)",
                      border: "1px solid rgba(255, 255, 255, 0.05)",
                      borderRadius: "16px",
                      padding: "24px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      minHeight: "130px",
                      boxShadow: "0 4px 20px rgba(0, 0, 0, 0.2)"
                    }} className="immich-stat-card">
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ 
                          width: "36px", 
                          height: "36px", 
                          borderRadius: "50%", 
                          background: "rgba(129, 140, 248, 0.1)", 
                          display: "flex", 
                          alignItems: "center", 
                          justifyContent: "center" 
                        }}>
                          <Activity size={18} style={{ color: "#818cf8" }} />
                        </div>
                        <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "#a1a1aa" }}>Active Projects</span>
                      </div>
                      <div style={{ alignSelf: "flex-end", marginTop: "16px" }}>
                        {renderImmichStatNumber(
                          usageStats.projects?.totalCount || 0, 
                          12, 
                          "PROJECTS"
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* PER USER STORAGE BREAKDOWN */}
                <div className="panel-card" style={{ marginTop: "8px" }}>
                  <h3 className="panel-card-title">
                    <Users size={18} style={{ color: "#6366f1" }} />
                    <span>Workspace Users Storage Breakdown</span>
                  </h3>
                  <p style={{ fontSize: "0.8rem", color: "#71717a", marginBottom: "20px" }}>
                    Track actual disk storage consumed, files uploaded, and custom workspace quotas assigned to each user.
                  </p>

                  <div className="scrollable-table-container">
                    <table className="modern-table">
                      <thead>
                        <tr>
                          <th>User</th>
                          <th>Role</th>
                          <th>Files Uploaded</th>
                          <th>Projects Created</th>
                          <th>Storage Used</th>
                          <th>Quota Limit</th>
                          <th style={{ width: "220px" }}>Quota Percentage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usageStats.personal.perUser.map((u: any) => {
                          const sizeUsedReadable = u.sizeUsed > 0 
                            ? (u.sizeUsed / (1024 * 1024 * 1024)).toFixed(2) + " GiB" 
                            : "0.00 GiB";
                          const limitReadable = (u.storageLimit / (1024 * 1024 * 1024)).toFixed(0) + " GB";
                          const pct = Math.min(100, Math.max(0, (u.sizeUsed / u.storageLimit) * 100));

                          return (
                            <tr key={u.id}>
                              <td>
                                <div style={{ display: "flex", flexDirection: "column" }}>
                                  <span style={{ fontWeight: 600, color: "#e4e4e7" }}>{u.name}</span>
                                  <span style={{ fontSize: "0.75rem", color: "#71717a" }}>{u.email}</span>
                                </div>
                              </td>
                              <td>
                                <span className={`role-badge ${u.role}`}>
                                  {u.role}
                                </span>
                              </td>
                              <td style={{ color: "#e4e4e7", fontWeight: 500 }}>
                                {u.itemsCount}
                              </td>
                              <td style={{ color: "#818cf8", fontWeight: 500 }}>
                                {u.projectsCount || 0}
                              </td>
                              <td style={{ color: "#38bdf8", fontWeight: 500 }}>
                                {sizeUsedReadable}
                              </td>
                              <td style={{ color: "#a1a1aa" }}>
                                {limitReadable}
                              </td>
                              <td>
                                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem" }}>
                                    <span style={{ color: pct > 90 ? "#f87171" : pct > 75 ? "#fbbf24" : "#a1a1aa" }}>
                                      {pct.toFixed(1)}%
                                    </span>
                                  </div>
                                  <div style={{ 
                                    width: "100%", 
                                    height: "6px", 
                                    background: "rgba(255, 255, 255, 0.05)", 
                                    borderRadius: "3px",
                                    overflow: "hidden" 
                                  }}>
                                    <div style={{ 
                                      width: `${pct}%`, 
                                      height: "100%", 
                                      background: pct > 90 ? "linear-gradient(90deg, #ef4444, #f87171)" : pct > 75 ? "linear-gradient(90deg, #f59e0b, #fbbf24)" : "linear-gradient(90deg, #6366f1, #818cf8)",
                                      borderRadius: "3px",
                                      boxShadow: pct > 90 ? "0 0 8px rgba(239, 68, 68, 0.4)" : "0 0 8px rgba(99, 102, 241, 0.4)"
                                    }} />
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
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
