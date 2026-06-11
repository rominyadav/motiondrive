"use client";

import { Share2, Link as LinkIcon, Clock } from "lucide-react";
import { adminRevokeSharedLink, adminExtendSharedLink } from "@/app/actions/admin";

interface SharedLinksTabProps {
  allLinks: any[];
  users: any[];
  onRefresh: () => Promise<void>;
  showToast: (msg: string, type?: "info" | "success" | "error") => void;
}

export function SharedLinksTab({
  allLinks,
  users,
  onRefresh,
  showToast,
}: SharedLinksTabProps) {
  const handleRevokeLink = async (id: string) => {
    if (!confirm("Are you sure you want to instantly expire/revoke this shared link?")) {
      return;
    }
    try {
      await adminRevokeSharedLink(id);
      showToast("Shared link successfully revoked!", "success");
      await onRefresh();
    } catch (err) {
      showToast("Failed to revoke shared link", "error");
    }
  };

  const handleExtendLink = async (id: string, hours = 24) => {
    try {
      await adminExtendSharedLink(id, hours);
      showToast(`Link expiration extended by +${hours} hours!`, "success");
      await onRefresh();
    } catch (err) {
      showToast("Failed to extend shared link", "error");
    }
  };

  return (
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
  );
}
