"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { 
  updateUserStatus, 
  updateUserStorageLimit, 
  updateUserRole 
} from "@/app/actions/admin";

interface UsersTabProps {
  users: any[];
  currentUser: any;
  isAdmin: boolean;
  onRefresh: () => Promise<void>;
  showToast: (msg: string, type?: "info" | "success" | "error") => void;
}

export function UsersTab({
  users,
  currentUser,
  isAdmin,
  onRefresh,
  showToast,
}: UsersTabProps) {
  const [userFilter, setUserFilter] = useState<"all" | "approved" | "pending" | "suspended">("all");

  const handleUpdateStatus = async (userId: string, newStatus: "approved" | "suspended" | "pending") => {
    try {
      await updateUserStatus(userId, newStatus);
      await onRefresh();
      showToast(`User status updated to ${newStatus}!`, "success");
    } catch (err) {
      showToast("Failed to update user status", "error");
    }
  };

  const filteredUsers = users.filter((u) => {
    if (userFilter === "all") return true;
    return u.status === userFilter;
  });

  return (
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
                    {isAdmin && u.id !== currentUser?.id ? (
                      <select
                        className="sleek-select"
                        value={u.role}
                        onChange={async (e) => {
                          const newRole = e.target.value as "admin" | "manager" | "staff";
                          try {
                            await updateUserRole(u.id, newRole);
                            showToast(`Updated role for ${u.name} to ${newRole}!`, "success");
                            await onRefresh();
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
                            await onRefresh();
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
                      {u.id !== currentUser?.id && (
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
  );
}
