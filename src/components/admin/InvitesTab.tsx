"use client";

import React, { useState } from "react";
import { Mail, ShieldAlert } from "lucide-react";
import { inviteUser, revokeInvitation } from "@/app/actions/admin";

interface InvitesTabProps {
  invites: any[];
  isAdmin: boolean;
  onRefresh: () => Promise<void>;
  showToast: (msg: string, type?: "info" | "success" | "error") => void;
}

export function InvitesTab({
  invites,
  isAdmin,
  onRefresh,
  showToast,
}: InvitesTabProps) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "manager" | "staff" >("staff");
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteMessage("");
    setInviteLoading(true);

    try {
      const res = await inviteUser(inviteEmail, inviteRole);
      if (res.success) {
        setInviteMessage(`Successfully invited ${inviteEmail}!`);
        setInviteEmail("");
        await onRefresh();
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
      await onRefresh();
    } catch (err) {
      showToast("Failed to revoke invitation", "error");
    }
  };

  return (
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
  );
}
