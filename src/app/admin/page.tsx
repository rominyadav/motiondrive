"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { inviteUser, listUsers, listInvitations, updateUserStatus, updateUserStorageLimit, updateUserRole, revokeInvitation } from "@/app/actions/admin";
import { Users, Mail, ShieldAlert, ArrowLeft, LogOut, CheckCircle, AlertTriangle, Info } from "lucide-react";
import Link from "next/link";
import "../drive.css";

export default function AdminPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [invites, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
        // Reload invites list
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
      // Reload users list
      const updated = await listUsers();
      setUsers(updated);
      showToast(`User status updated to ${newStatus}!`, "success");
    } catch (err) {
      showToast("Failed to update user status", "error");
    }
  };

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  };

  if (loading) {
    return (
      <div className="app-container" style={{ alignItems: "center", justifyContent: "center" }}>
        <h3>Verifying administrative access...</h3>
      </div>
    );
  }

  return (
    <div className="app-container" style={{ flexDirection: "column", overflowY: "auto" }}>
      {/* HEADER */}
      <header className="header" style={{ flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <Link href="/" className="btn-secondary" style={{ height: "36px", padding: "0 12px" }}>
            <ArrowLeft size={16} /> Back to Drive
          </Link>
          <h1 className="explorer-title" style={{ fontSize: "20px" }}>Admin Workspace Control</h1>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div className="sidebar-user" style={{ border: "none", paddingTop: 0, marginTop: 0 }}>
            <div className="user-avatar">{currentUser?.name?.charAt(0)}</div>
            <div className="user-info">
              <div className="user-name">{currentUser?.name}</div>
              <div className="user-role">{currentUser?.role}</div>
            </div>
          </div>
          <button onClick={handleSignOut} className="btn-signout" title="Sign Out">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* DASHBOARD CONTENT */}
      <main className="explorer animate-fade-in" style={{ padding: "40px" }}>
        <div className="admin-grid">
          {/* USER MANAGEMENT SECTION */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div className="admin-panel">
              <h2 className="section-title" style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-primary)" }}>
                <Users size={18} className="brand-accent" /> Registered Users ({users.length})
              </h2>

              <div className="files-container" style={{ marginTop: "16px" }}>
                <div className="table-header" style={{ gridTemplateColumns: "1.2fr 0.8fr 0.8fr 1.2fr 1fr" }}>
                  <div>Name & Email</div>
                  <div>Role</div>
                  <div>Status</div>
                  <div>Storage Limit</div>
                  <div style={{ textAlign: "right" }}>Actions</div>
                </div>

                {users.map((u) => (
                  <div className="file-row" key={u.id} style={{ gridTemplateColumns: "1.2fr 0.8fr 0.8fr 1.2fr 1fr" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
                      <span className="file-name" style={{ fontSize: "14px" }}>{u.name}</span>
                      <span style={{ fontSize: "12px", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis" }}>{u.email}</span>
                    </div>

                    <div>
                      {currentUser?.role === "admin" && u.id !== currentUser.id ? (
                        <select
                          className="form-select"
                          style={{
                            height: "28px",
                            padding: "0 8px",
                            fontSize: "12px",
                            width: "110px",
                            background: "rgba(255, 255, 255, 0.03)",
                            border: "1px solid var(--border-color)",
                            borderRadius: "6px",
                            color: "var(--text-primary)",
                            cursor: "pointer"
                          }}
                          value={u.role}
                          onChange={async (e) => {
                            const newRole = e.target.value as "admin" | "manager" | "staff";
                            try {
                              await updateUserRole(u.id, newRole);
                              showToast(`Successfully updated ${u.name}'s role to ${newRole}!`, "success");
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
                        <span 
                          className="badge" 
                          style={{ 
                            backgroundColor: u.role === "admin" 
                              ? "rgba(99, 102, 241, 0.1)" 
                              : u.role === "manager" 
                                ? "rgba(168, 85, 247, 0.1)" 
                                : "var(--border-color)", 
                            color: u.role === "admin" 
                              ? "var(--accent-indigo)" 
                              : u.role === "manager" 
                                ? "#a78bfa" 
                                : "var(--text-primary)" 
                          }}
                        >
                          {u.role}
                        </span>
                      )}
                    </div>

                    <div>
                      <span className={`badge ${u.status}`}>
                        {u.status}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <input
                        type="number"
                        className="form-input"
                        style={{ height: "30px", width: "70px", padding: "0 6px", fontSize: "12px", textAlign: "center" }}
                        defaultValue={((u.storageLimit || 107374182400) / (1024 * 1024 * 1024)).toFixed(0)}
                        onBlur={async (e) => {
                          const val = parseInt(e.target.value);
                          if (isNaN(val) || val <= 0) return;
                          const bytes = val * 1024 * 1024 * 1024;
                          if (bytes === (u.storageLimit || 107374182400)) return;
                          try {
                            await updateUserStorageLimit(u.id, bytes);
                            showToast(`Updated storage limit for ${u.name} to ${val} GB!`, "success");
                          } catch (err) {
                            showToast("Failed to update storage limit", "error");
                          }
                        }}
                      />
                      <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>GB</span>
                    </div>

                    <div className="file-actions" style={{ justifyContent: "flex-end", gap: "8px" }}>
                      {u.id !== currentUser.id && (
                        <>
                          {u.status !== "approved" && (
                            <button onClick={() => handleUpdateStatus(u.id, "approved")} className="btn-approve">
                              Approve
                            </button>
                          )}
                          {u.status !== "suspended" && (
                            <button onClick={() => handleUpdateStatus(u.id, "suspended")} className="btn-suspend">
                              Suspend
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* PENDING INVITATIONS SECTION */}
            <div className="admin-panel">
              <h2 className="section-title" style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-primary)" }}>
                <Mail size={18} className="brand-accent" /> Pending Invitations ({invites.length})
              </h2>

              {invites.length === 0 ? (
                <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginTop: "16px" }}>No pending invitations found.</p>
              ) : (
                <div className="files-container" style={{ marginTop: "16px" }}>
                  <div className="table-header" style={{ gridTemplateColumns: "1.5fr 1fr 1.2fr 1fr" }}>
                    <div>Email</div>
                    <div>Invited As</div>
                    <div>Expires</div>
                    <div style={{ textAlign: "right" }}>Actions</div>
                  </div>

                  {invites.map((inv) => (
                    <div className="file-row" key={inv.id} style={{ gridTemplateColumns: "1.5fr 1fr 1.2fr 1fr" }}>
                      <span className="file-name" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{inv.email}</span>
                      <div>
                        <span className="badge" style={{ backgroundColor: "var(--border-color)" }}>{inv.role}</span>
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                        {new Date(inv.expiresAt).toLocaleDateString()}
                      </div>
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <button
                          onClick={() => handleRevokeInvite(inv.id, inv.email)}
                          style={{
                            height: "26px",
                            padding: "0 10px",
                            fontSize: "11px",
                            background: "rgba(239, 68, 68, 0.1)",
                            color: "var(--accent-danger)",
                            border: "1px solid rgba(239, 68, 68, 0.2)",
                            borderRadius: "6px",
                            cursor: "pointer",
                            transition: "all 0.2s"
                          }}
                        >
                          Revoke
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* SIDEBAR: INVITE FORM */}
          <div className="admin-panel" style={{ height: "fit-content" }}>
            <h2 className="section-title" style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-primary)" }}>
              <ShieldAlert size={18} className="brand-accent" /> Invite Staff
            </h2>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px" }}>
              Send an email invitation. When they register using the link, they will be automatically approved.
            </p>

            {inviteMessage && (
              <div 
                style={{ 
                  padding: "10px", 
                  borderRadius: "6px", 
                  fontSize: "13px", 
                  marginBottom: "16px", 
                  backgroundColor: inviteMessage.includes("Successfully") ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                  color: inviteMessage.includes("Successfully") ? "var(--accent-success)" : "var(--accent-danger)"
                }}
              >
                {inviteMessage}
              </div>
            )}

            <form onSubmit={handleInvite}>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="editor@motionsewa.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Assign Role</label>
                <select 
                  className="form-select"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                >
                  <option value="staff">Staff (Video Editor / Creator)</option>
                  <option value="manager">Manager (Approve & Invite Users)</option>
                  <option value="admin">Admin (Full Access & Controller)</option>
                </select>
              </div>

              <button type="submit" className="btn-primary" style={{ width: "100%", marginTop: "8px" }} disabled={inviteLoading}>
                {inviteLoading ? "Sending invite..." : "Send Invitation"}
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* TOAST OVERLAY */}
      {toastMessage && (
        <div className={`toast toast-${toastType} animate-fade-in-up`}>
          {toastType === "success" && <CheckCircle size={16} />}
          {toastType === "error" && <AlertTriangle size={16} />}
          {toastType === "info" && <Info size={16} />}
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
