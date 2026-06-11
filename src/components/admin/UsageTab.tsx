"use client";

import React, { useState } from "react";
import { 
  HardDrive, 
  FileText, 
  Share2, 
  Database, 
  Activity, 
  Users, 
  Search, 
  Info, 
  Clock, 
  File, 
  Video, 
  Image, 
  Music 
} from "lucide-react";

interface UsageTabProps {
  usageStats: any;
  usageLoading: boolean;
  onRefreshStats: () => Promise<void>;
}

export function UsageTab({
  usageStats,
  usageLoading,
  onRefreshStats,
}: UsageTabProps) {
  const [itemsSearchQuery, setItemsSearchQuery] = useState("");
  const [itemsDriveFilter, setItemsDriveFilter] = useState<"all" | "personal" | "shared" | "archive">("all");

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

  const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KiB", "MiB", "GiB", "TiB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  if (usageLoading || !usageStats) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0", gap: "16px" }}>
        <div className="spin-anim" style={{ width: "40px", height: "40px", border: "3px solid #06b6d4", borderTopColor: "transparent", borderRadius: "50%" }} />
        <p style={{ color: "#71717a", fontSize: "0.9rem" }}>Fetching real-time S3 bucket and database storage stats...</p>
      </div>
    );
  }

  // Filter items in Drive items directory
  const filteredItems = (usageStats.allItems || []).filter((item: any) => {
    const matchesSearch = (item.filename || "").toLowerCase().includes(itemsSearchQuery.toLowerCase());
    const matchesDrive = itemsDriveFilter === "all" || item.driveType === itemsDriveFilter;
    return matchesSearch && matchesDrive;
  });

  return (
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
          onClick={onRefreshStats} 
          className="action-btn extend" 
          style={{ padding: "8px 16px", borderRadius: "8px", fontSize: "0.8rem" }}
          disabled={usageLoading}
        >
          {usageLoading ? "Refreshing..." : "Refresh Stats"}
        </button>
      </div>

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

          {/* CARD 2: Personal Drive Space */}
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

      {/* ALL DRIVE ITEMS DIRECTORY */}
      <div className="panel-card" style={{ marginTop: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <h3 className="panel-card-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
              <FileText size={18} style={{ color: "#06b6d4" }} />
              <span>All Drive Items Directory</span>
            </h3>
            <p style={{ fontSize: "0.8rem", color: "#71717a", marginTop: "4px" }}>
              Search, filter, and view details of all files stored across all personal, shared, and archive drives.
            </p>
          </div>

          {/* Search and Filters */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <Search size={14} style={{ position: "absolute", left: "12px", color: "#71717a" }} />
              <input 
                type="text" 
                className="sleek-input" 
                style={{ paddingLeft: "32px", width: "240px", fontSize: "0.85rem" }}
                placeholder="Search items by name..." 
                value={itemsSearchQuery}
                onChange={(e) => setItemsSearchQuery(e.target.value)}
              />
            </div>

            <div className="filter-pills" style={{ margin: 0 }}>
              <button 
                className={`filter-pill ${itemsDriveFilter === "all" ? "active" : ""}`}
                onClick={() => setItemsDriveFilter("all")}
              >
                All ({usageStats.allItems?.length || 0})
              </button>
              <button 
                className={`filter-pill ${itemsDriveFilter === "personal" ? "active" : ""}`}
                onClick={() => setItemsDriveFilter("personal")}
              >
                Personal ({usageStats.allItems?.filter((i: any) => i.driveType === "personal").length || 0})
              </button>
              <button 
                className={`filter-pill ${itemsDriveFilter === "shared" ? "active" : ""}`}
                onClick={() => setItemsDriveFilter("shared")}
              >
                Shared ({usageStats.allItems?.filter((i: any) => i.driveType === "shared").length || 0})
              </button>
              <button 
                className={`filter-pill ${itemsDriveFilter === "archive" ? "active" : ""}`}
                onClick={() => setItemsDriveFilter("archive")}
              >
                Archive ({usageStats.allItems?.filter((i: any) => i.driveType === "archive").length || 0})
              </button>
            </div>
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 0", gap: "12px", color: "#71717a" }}>
            <Info size={28} style={{ opacity: 0.6 }} />
            <p style={{ fontSize: "0.9rem", fontWeight: "500" }}>No items match your search or filter criteria.</p>
          </div>
        ) : (
          <div className="scrollable-table-container" style={{ maxHeight: "400px", overflowY: "auto" }}>
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>Drive Type</th>
                  <th>Uploader / Source</th>
                  <th>Size</th>
                  <th>Uploaded At</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item: any) => {
                  // Dynamic File Type Icons
                  let FileIcon = File;
                  let iconColor = "#a1a1aa";
                  if (item.mimeType?.startsWith("video/")) {
                    FileIcon = Video;
                    iconColor = "#38bdf8";
                  } else if (item.mimeType?.startsWith("image/")) {
                    FileIcon = Image;
                    iconColor = "#10b981";
                  } else if (item.mimeType?.startsWith("audio/")) {
                    FileIcon = Music;
                    iconColor = "#ec4899";
                  } else if (item.mimeType === "application/pdf") {
                    FileIcon = FileText;
                    iconColor = "#f43f5e";
                  }

                  // Nice gradient badges for drive types
                  let badgeStyle = {};
                  if (item.driveType === "personal") {
                    badgeStyle = {
                      background: "linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(129, 140, 248, 0.05) 100%)",
                      border: "1px solid rgba(99, 102, 241, 0.2)",
                      color: "#a5b4fc"
                    };
                  } else if (item.driveType === "shared") {
                    badgeStyle = {
                      background: "linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(52, 211, 153, 0.05) 100%)",
                      border: "1px solid rgba(16, 185, 129, 0.2)",
                      color: "#6ee7b7"
                    };
                  } else if (item.driveType === "archive") {
                    badgeStyle = {
                      background: "linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(251, 191, 36, 0.05) 100%)",
                      border: "1px solid rgba(245, 158, 11, 0.2)",
                      color: "#fde047"
                    };
                  }

                  const sizeReadable = formatBytes(item.size);

                  return (
                    <tr key={item.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", fontWeight: 500, color: "#e4e4e7" }} title={item.filename}>
                          <div style={{
                            width: "28px",
                            height: "28px",
                            borderRadius: "8px",
                            background: "rgba(255, 255, 255, 0.02)",
                            border: "1px solid rgba(255, 255, 255, 0.05)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0
                          }}>
                            <FileIcon size={14} style={{ color: iconColor }} />
                          </div>
                          <span style={{ 
                            maxWidth: "260px", 
                            overflow: "hidden", 
                            textOverflow: "ellipsis", 
                            whiteSpace: "nowrap" 
                          }}>
                            {item.filename.split("/").pop()}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="soft-badge" style={{ ...badgeStyle, textTransform: "uppercase", fontSize: "0.7rem", fontWeight: "bold", padding: "4px 8px" }}>
                          {item.driveType}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: "0.85rem", color: item.uploadedBy.includes("System") ? "#71717a" : "#e4e4e7" }}>
                          {item.uploadedBy}
                        </span>
                      </td>
                      <td style={{ color: "#38bdf8", fontWeight: 500 }}>
                        {sizeReadable}
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8rem", color: "#71717a" }}>
                          <Clock size={12} />
                          <span>{new Date(item.uploadedAt).toLocaleString()}</span>
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
  );
}
