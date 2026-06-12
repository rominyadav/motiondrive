import React from "react";
import { Activity, HardDrive, X } from "lucide-react";

interface DetailedUsageModalProps {
  isOpen: boolean;
  onClose: () => void;
  detailedUsageLoading: boolean;
  detailedUsageStats: any;
}

interface UsageStatCardProps {
  label: string;
  value: React.ReactNode;
  unit: string;
}

interface ProjectBreakdownProps {
  projectBreakdown: any[];
  limit: number;
}

const BYTES_PER_GIB = 1024 * 1024 * 1024;

function formatGib(bytes: number, digits: number) {
  return (bytes / BYTES_PER_GIB).toFixed(digits);
}

function getProjectUsage(project: any, limit: number) {
  const pct = Math.min(100, Math.max(0, (project.sizeUsed / limit) * 100));
  const sizeReadable = project.sizeUsed > 0
    ? formatGib(project.sizeUsed, 2) + " GiB"
    : "0.00 GiB";

  return { pct, sizeReadable };
}

function UsageSheetHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="usage-sheet-header">
      <div className="usage-sheet-title-group">
        <span className="usage-sheet-icon">
          <HardDrive size={18} />
        </span>
        <div>
          <h3 id="storage-analytics-title">Storage Analytics</h3>
          <p>Your workspace storage overview</p>
        </div>
      </div>
      <button onClick={onClose} className="usage-sheet-close" aria-label="Close storage analytics">
        <X size={18} />
      </button>
    </div>
  );
}

function UsageLoadingState() {
  return (
    <div className="usage-loading-state">
      <div className="usage-loading-spinner" />
      <p>Calculating storage statistics and project breakdown...</p>
    </div>
  );
}

function UsageStatCard({ label, value, unit }: UsageStatCardProps) {
  return (
    <div className="usage-stat-card">
      <span className="usage-stat-label">{label}</span>
      <div className="usage-stat-value">
        <span>{value}</span>
        <small>{unit}</small>
      </div>
    </div>
  );
}

function UsageStatsGrid({ detailedUsageStats }: { detailedUsageStats: any }) {
  return (
    <div className="usage-stat-grid">
      <UsageStatCard
        label="Storage Space"
        value={formatGib(detailedUsageStats.used, 1)}
        unit="GiB"
      />
      <UsageStatCard
        label="Total Files"
        value={detailedUsageStats.totalFiles}
        unit="Files"
      />
      <UsageStatCard
        label="Folders"
        value={detailedUsageStats.totalFolders}
        unit="Dirs"
      />
      <UsageStatCard
        label="My Projects"
        value={detailedUsageStats.totalProjects}
        unit="Projs"
      />
    </div>
  );
}

function UsageEmptyState() {
  return (
    <div className="usage-empty-state">
      <p>No project storage yet.</p>
      <span>Projects with completed uploads will appear here.</span>
    </div>
  );
}

function MobileProjectCard({ project, limit }: { project: any; limit: number }) {
  const { pct, sizeReadable } = getProjectUsage(project, limit);

  return (
    <article className="usage-project-card">
      <div className="usage-project-main">
        <div>
          <h5>{project.name}</h5>
          <p>{project.clientName || "No client"}</p>
        </div>
        <span>{sizeReadable}</span>
      </div>

      <div className="usage-project-meta">
        <span>{project.filesCount} files</span>
        <span>{pct.toFixed(1)}% of workspace</span>
      </div>

      <div className="usage-project-track" aria-hidden="true">
        <div style={{ width: `${pct}%` }} />
      </div>
    </article>
  );
}

function MobileProjectList({ projectBreakdown, limit }: ProjectBreakdownProps) {
  return (
    <div className="usage-mobile-project-list">
      {projectBreakdown.map((project: any) => (
        <MobileProjectCard key={project.id} project={project} limit={limit} />
      ))}
    </div>
  );
}

function DesktopProjectTable({ projectBreakdown, limit }: ProjectBreakdownProps) {
  return (
    <div className="usage-desktop-table scrollable-table-container">
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
          {projectBreakdown.map((project: any) => {
            const { pct, sizeReadable } = getProjectUsage(project, limit);

            return (
              <tr key={project.id}>
                <td>
                  <span style={{ fontWeight: "600", color: "#e4e4e7" }}>{project.name}</span>
                </td>
                <td>
                  <span style={{ color: "var(--text-secondary)" }}>{project.clientName || "No client"}</span>
                </td>
                <td style={{ textAlign: "center", color: "#a1a1aa" }}>
                  {project.filesCount}
                </td>
                <td style={{ color: "#c7d2fe", fontWeight: "600" }}>
                  {sizeReadable}
                </td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{
                      flex: 1,
                      height: "5px",
                      background: "rgba(255, 255, 255, 0.08)",
                      borderRadius: "3px",
                      overflow: "hidden"
                    }}>
                      <div style={{
                        width: `${pct}%`,
                        height: "100%",
                        background: "#6366f1",
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
  );
}

function ProjectBreakdown({ projectBreakdown, limit }: ProjectBreakdownProps) {
  return (
    <section className="usage-breakdown-section">
      <div className="usage-section-heading">
        <Activity size={15} />
        <h4>Project Breakdown</h4>
      </div>

      {projectBreakdown.length === 0 ? (
        <UsageEmptyState />
      ) : (
        <>
          <MobileProjectList projectBreakdown={projectBreakdown} limit={limit} />
          <DesktopProjectTable projectBreakdown={projectBreakdown} limit={limit} />
        </>
      )}
    </section>
  );
}

export function DetailedUsageModal({
  isOpen,
  onClose,
  detailedUsageLoading,
  detailedUsageStats,
}: DetailedUsageModalProps) {
  if (!isOpen) return null;

  return (
    <div className="usage-analytics-overlay" style={{ zIndex: 1000 }}>
      <div className="usage-analytics-sheet" role="dialog" aria-modal="true" aria-labelledby="storage-analytics-title">
        <div className="usage-sheet-handle" aria-hidden="true" />
        <UsageSheetHeader onClose={onClose} />

        {detailedUsageLoading || !detailedUsageStats ? (
          <UsageLoadingState />
        ) : (
          <div className="usage-sheet-content">
            <UsageStatsGrid detailedUsageStats={detailedUsageStats} />
            <ProjectBreakdown
              projectBreakdown={detailedUsageStats.projectBreakdown}
              limit={detailedUsageStats.limit}
            />
          </div>
        )}
      </div>

      <style>{`
        .usage-analytics-overlay {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          animation: usageOverlayFade 0.2s ease-out forwards;
        }

        .usage-analytics-sheet {
          width: 100%;
          max-height: 85dvh;
          overflow-y: auto;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          border-right: 0;
          border-bottom: 0;
          border-left: 0;
          border-radius: 28px 28px 0 0;
          background: #111116;
          padding: 10px 20px calc(24px + env(safe-area-inset-bottom));
          box-shadow: 0 -24px 60px rgba(0, 0, 0, 0.45);
          animation: usageSheetUp 0.26s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .usage-sheet-handle {
          width: 42px;
          height: 4px;
          margin: 0 auto 16px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.22);
        }

        .usage-sheet-header,
        .usage-sheet-title-group,
        .usage-section-heading,
        .usage-stat-value,
        .usage-project-main,
        .usage-project-meta {
          display: flex;
          align-items: center;
        }

        .usage-sheet-header {
          justify-content: space-between;
          gap: 14px;
          padding-bottom: 18px;
        }

        .usage-sheet-title-group {
          min-width: 0;
          gap: 11px;
        }

        .usage-sheet-icon {
          width: 36px;
          height: 36px;
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          color: #a5b4fc;
          border: 1px solid rgba(129, 140, 248, 0.18);
          background: rgba(99, 102, 241, 0.15);
        }

        .usage-sheet-title-group h3 {
          margin: 0;
          color: #ffffff;
          font-size: 17px;
          line-height: 1.2;
          font-weight: 800;
        }

        .usage-sheet-title-group p {
          margin: 3px 0 0;
          color: var(--text-secondary);
          font-size: 12px;
          line-height: 1.35;
        }

        .usage-sheet-close {
          width: 36px;
          height: 36px;
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          color: #d4d4d8;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.05);
          transition: background 0.18s ease, color 0.18s ease, transform 0.18s ease;
        }

        .usage-sheet-close:active {
          transform: scale(0.95);
          background: rgba(255, 255, 255, 0.1);
          color: #ffffff;
        }

        .usage-loading-state {
          min-height: 260px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 14px;
          text-align: center;
        }

        .usage-loading-spinner {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          border: 3px solid rgba(129, 140, 248, 0.8);
          border-top-color: transparent;
          animation: spin 1.1s infinite linear;
        }

        .usage-loading-state p {
          max-width: 240px;
          color: var(--text-secondary);
          font-size: 13px;
          line-height: 1.45;
        }

        .usage-sheet-content {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .usage-stat-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .usage-stat-card {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
          justify-content: space-between;
          min-height: 86px;
          padding: 14px;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.04);
        }

        .usage-stat-label {
          color: var(--text-secondary);
          font-size: 11px;
          line-height: 1.25;
          font-weight: 700;
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }

        .usage-stat-value {
          justify-content: flex-start;
          gap: 6px;
          min-width: 0;
          color: #f4f4f5;
        }

        .usage-stat-value span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          font-size: 22px;
          line-height: 1;
          font-weight: 800;
          font-variant-numeric: tabular-nums;
        }

        .usage-stat-value small {
          align-self: flex-end;
          padding-bottom: 2px;
          color: #a5b4fc;
          font-size: 10px;
          line-height: 1;
          font-weight: 800;
          text-transform: uppercase;
        }

        .usage-breakdown-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .usage-section-heading {
          gap: 8px;
          color: #f4f4f5;
        }

        .usage-section-heading svg {
          color: #a5b4fc;
        }

        .usage-section-heading h4 {
          margin: 0;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .usage-empty-state {
          padding: 18px;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.035);
        }

        .usage-empty-state p {
          margin: 0 0 4px;
          color: #f4f4f5;
          font-size: 14px;
          font-weight: 700;
        }

        .usage-empty-state span {
          color: var(--text-secondary);
          font-size: 12px;
          line-height: 1.4;
        }

        .usage-mobile-project-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .usage-project-card {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 14px;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.035);
        }

        .usage-project-main,
        .usage-project-meta {
          justify-content: space-between;
          gap: 12px;
        }

        .usage-project-main div {
          min-width: 0;
        }

        .usage-project-main h5 {
          margin: 0;
          overflow: hidden;
          color: #f4f4f5;
          font-size: 14px;
          line-height: 1.3;
          font-weight: 750;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .usage-project-main p {
          margin: 3px 0 0;
          overflow: hidden;
          color: var(--text-secondary);
          font-size: 12px;
          line-height: 1.3;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .usage-project-main > span {
          flex: 0 0 auto;
          color: #c7d2fe;
          font-size: 13px;
          font-weight: 800;
          font-variant-numeric: tabular-nums;
        }

        .usage-project-meta {
          color: var(--text-secondary);
          font-size: 12px;
          line-height: 1.3;
        }

        .usage-project-track {
          height: 6px;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.09);
        }

        .usage-project-track div {
          height: 100%;
          border-radius: inherit;
          background: #6366f1;
        }

        .usage-desktop-table {
          display: none;
        }

        @media (min-width: 700px) {
          .usage-analytics-overlay {
            align-items: center;
            padding: 24px;
          }

          .usage-analytics-sheet {
            max-width: 780px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 24px;
            padding: 24px;
            box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
            animation-name: usageSheetScale;
          }

          .usage-sheet-handle {
            display: none;
          }

          .usage-stat-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }

          .usage-mobile-project-list {
            display: none;
          }

          .usage-desktop-table {
            display: block;
            max-height: 280px;
          }
        }

        @keyframes usageOverlayFade {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes usageSheetUp {
          from {
            transform: translateY(24px);
            opacity: 0.96;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes usageSheetScale {
          from {
            transform: translateY(10px) scale(0.98);
            opacity: 0;
          }
          to {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
