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
  adminExtendSharedLink
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
  Lock
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
  const [activeTab, setActiveTab] = useState<"users" | "invites" | "shared_links">("users");
  const [userFilter, setUserFilter] = useState<"all" | "approved" | "pending" | "suspended">("all");

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
      <div className="admin-body" style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
          <div className="spin-anim" style={{ width: "32px", height: "32px", border: "2px solid #6366f1", borderTopColor: "transparent", borderRadius: "50%" }} />
          <h3 style={{ fontSize: "1rem", fontWeight: 500, color: "#a1a1aa" }}>Verifying administrative permissions...</h3>
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
          </div>

          {/* Render search/filter dynamically for active tabs */}
          {activeTab === "users" && (
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
          )}
        </div>

        {/* TAB 1: USERS DIRECTORY */}
        <div className={`tab-content ${activeTab === "users" ? "active" : ""}`}>
          <div className="panel-card">
            <h2 className="panel-card-title">
              <Users size={18} style={{ color: "#6366f1" }} />
              <span>Registered Users Directory</span>
            </h2>

            {filteredUsers.length === 0 ? (
              <p style={{ color: "#71717a", fontSize: "0.9rem", padding: "16px 0" }}>No users match the selected status filter.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
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
                <div style={{ overflowX: "auto" }}>
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
                <div style={{ overflowX: "auto" }}>
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
                              <span className={`soft-badge ${status === "active" ? "approved" : status === "expired" ? "pending" : "suspended"}`}>
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
