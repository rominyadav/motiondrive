import React from "react";
import { Activity } from "lucide-react";

interface DetailedUsageModalProps {
  isOpen: boolean;
  onClose: () => void;
  detailedUsageLoading: boolean;
  detailedUsageStats: any;
}

export function DetailedUsageModal({
  isOpen,
  onClose,
  detailedUsageLoading,
  detailedUsageStats,
}: DetailedUsageModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <div className="modal animate-scale-up" style={{ maxWidth: "780px", width: "100%", padding: "32px", background: "#0c0c0e" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <div>
            <h3 style={{ fontSize: "20px", fontWeight: "800", color: "#ffffff", display: "flex", alignItems: "center", gap: "10px" }}>
              <Activity size={22} style={{ color: "var(--accent-blue)" }} />
              <span>Storage & Usage Analytics</span>
            </h3>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
              Real-time analytics of your personal workspace storage and items.
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="btn-secondary" 
            style={{ padding: "8px 12px", borderRadius: "8px", minWidth: "auto", border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)", color: "#a1a1aa" }}
          >
            Close
          </button>
        </div>

        {detailedUsageLoading || !detailedUsageStats ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 0", gap: "16px" }}>
            <div style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              border: "3px solid var(--accent-blue)",
              borderTopColor: "transparent",
              animation: "spin 1.2s infinite linear"
            }} />
            <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>Calculating storage statistics & project breakdown...</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
            {/* IMMICH INSPIRED NUMERIC STATS GRID */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "16px"
            }}>
              {/* CARD 1: Space Used */}
              <div style={{
                background: "rgba(24, 24, 27, 0.4)",
                border: "1px solid rgba(255, 255, 255, 0.04)",
                borderRadius: "12px",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                minHeight: "100px"
              }}>
                <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Storage Space</span>
                <span style={{ fontFamily: "monospace", fontSize: "20px", fontWeight: "700", color: "#38bdf8", alignSelf: "flex-end", marginTop: "12px" }}>
                  {(detailedUsageStats.used / (1024 * 1024 * 1024)).toFixed(1)} <span style={{ fontSize: "11px", opacity: 0.5 }}>GiB</span>
                </span>
              </div>

              {/* CARD 2: Files Count */}
              <div style={{
                background: "rgba(24, 24, 27, 0.4)",
                border: "1px solid rgba(255, 255, 255, 0.04)",
                borderRadius: "12px",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                minHeight: "100px"
              }}>
                <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Files</span>
                <span style={{ fontFamily: "monospace", fontSize: "20px", fontWeight: "700", color: "#818cf8", alignSelf: "flex-end", marginTop: "12px" }}>
                  {detailedUsageStats.totalFiles} <span style={{ fontSize: "11px", opacity: 0.5 }}>FILES</span>
                </span>
              </div>

              {/* CARD 3: Folders Count */}
              <div style={{
                background: "rgba(24, 24, 27, 0.4)",
                border: "1px solid rgba(255, 255, 255, 0.04)",
                borderRadius: "12px",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                minHeight: "100px"
              }}>
                <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Folders</span>
                <span style={{ fontFamily: "monospace", fontSize: "20px", fontWeight: "700", color: "#10b981", alignSelf: "flex-end", marginTop: "12px" }}>
                  {detailedUsageStats.totalFolders} <span style={{ fontSize: "11px", opacity: 0.5 }}>DIRS</span>
                </span>
              </div>

              {/* CARD 4: Projects Created */}
              <div style={{
                background: "rgba(24, 24, 27, 0.4)",
                border: "1px solid rgba(255, 255, 255, 0.04)",
                borderRadius: "12px",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                minHeight: "100px"
              }}>
                <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>My Projects</span>
                <span style={{ fontFamily: "monospace", fontSize: "20px", fontWeight: "700", color: "#fbbf24", alignSelf: "flex-end", marginTop: "12px" }}>
                  {detailedUsageStats.totalProjects} <span style={{ fontSize: "11px", opacity: 0.5 }}>PROJS</span>
                </span>
              </div>
            </div>

            {/* PROJECT DETAILED BREAKDOWN LIST */}
            <div>
              <h4 style={{ fontSize: "13px", fontWeight: "700", color: "#ffffff", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Storage breakdown by project
              </h4>
              {detailedUsageStats.projectBreakdown.length === 0 ? (
                <p style={{ fontSize: "12px", color: "var(--text-muted)", background: "rgba(255,255,255,0.01)", padding: "16px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.03)" }}>
                  You haven't created any projects yet, or they have no completed uploads.
                </p>
              ) : (
                <div style={{ maxHeight: "280px" }} className="scrollable-table-container">
                  <table className="modern-table">
                    <thead>
                      <tr>
                        <th>Project Name</th>
                        <th>Client</th>
                        <th style={{ textAlign: "center" }}>Files Count</th>
                        <th>Storage Occupied</th>
                        <th>Workspace Ratio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailedUsageStats.projectBreakdown.map((proj: any) => {
                        const pct = Math.min(100, Math.max(0, (proj.sizeUsed / detailedUsageStats.limit) * 100));
                        const sizeReadable = proj.sizeUsed > 0 
                          ? (proj.sizeUsed / (1024 * 1024 * 1024)).toFixed(2) + " GiB" 
                          : "0.00 GiB";
                        return (
                          <tr key={proj.id}>
                            <td>
                              <span style={{ fontWeight: "600", color: "#e4e4e7" }}>{proj.name}</span>
                            </td>
                            <td>
                              <span style={{ color: "var(--text-secondary)" }}>{proj.clientName || "—"}</span>
                            </td>
                            <td style={{ textAlign: "center", color: "#a1a1aa" }}>
                              {proj.filesCount}
                            </td>
                            <td style={{ color: "#38bdf8", fontWeight: "500" }}>
                              {sizeReadable}
                            </td>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <div style={{ 
                                  flex: 1, 
                                  height: "5px", 
                                  background: "rgba(255, 255, 255, 0.05)", 
                                  borderRadius: "3px", 
                                  overflow: "hidden" 
                                }}>
                                  <div style={{ 
                                    width: `${pct}%`, 
                                    height: "100%", 
                                    background: "linear-gradient(90deg, var(--accent-blue), var(--accent-indigo))",
                                    borderRadius: "3px" 
                                  }} />
                                </div>
                                <span style={{ fontSize: "11px", color: "var(--text-muted)", width: "35px", textAlign: "right" }}>
                                  {pct.toFixed(1)}%
                                </span>
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
      </div>
    </div>
  );
}
