import React from "react";
import Link from "next/link";
import { 
  Link as LinkIcon, 
  Sliders, 
  HardDrive, 
  LogOut,
  X
} from "lucide-react";
import { DriveMode } from "@/types/drive";

interface MobileSidebarProps {
  session: any;
  isOpen: boolean;
  onClose: () => void;
  explorerMode: DriveMode;
  isAdmin: boolean;
  storageStats: any;
  setShowDetailedUsageModal: (open: boolean) => void;
  handleSignOut: () => void | Promise<void>;
  setParams: (params: Record<string, string | null | undefined>) => void;
}

interface MobileStorageCardProps {
  storageStats: any;
  onOpenAnalytics: () => void;
}

function MobileStorageCard({ storageStats, onOpenAnalytics }: MobileStorageCardProps) {
  const storageUsedGb = (storageStats.used / (1024 * 1024 * 1024)).toFixed(1);
  const storageLimitGb = (storageStats.limit / (1024 * 1024 * 1024)).toFixed(0);
  const storagePercentage = Math.min(100, (storageStats.used / storageStats.limit) * 100);

  return (
    <button
      type="button"
      onClick={onOpenAnalytics}
      className="mobile-storage-card"
      aria-label={`View storage analytics. ${storageUsedGb} GB used of ${storageLimitGb} GB.`}
    >
      <div className="mobile-storage-card-top">
        <div className="mobile-storage-title-wrap">
          <span className="mobile-storage-icon">
            <HardDrive size={15} />
          </span>
          <span className="mobile-storage-title">Storage</span>
        </div>
        <span className="mobile-storage-percent">{storagePercentage.toFixed(0)}%</span>
      </div>

      <div className="mobile-storage-copy">
        <span>{storageUsedGb} GB used</span>
        <span>of {storageLimitGb} GB</span>
      </div>

      <div className="mobile-storage-track" aria-hidden="true">
        <div
          className="mobile-storage-fill"
          style={{ width: `${storagePercentage}%` }}
        />
      </div>

      <div className="mobile-storage-footer">
        <span>View details</span>
        <span aria-hidden="true">-&gt;</span>
      </div>
    </button>
  );
}

export function MobileSidebar({
  session,
  isOpen,
  onClose,
  explorerMode,
  isAdmin,
  storageStats,
  setShowDetailedUsageModal,
  handleSignOut,
  setParams
}: MobileSidebarProps) {
  return (
    <>
      {isOpen && (
        <div className="sidebar-backdrop show" onClick={onClose} style={{ zIndex: 120 }} />
      )}

      <aside className={`sidebar mobile-sidebar ${isOpen ? "sidebar-open" : ""}`} style={{ zIndex: 130 }}>
        <div className="mobile-sidebar-header">
          <div className="brand">
            <span>Motionsewa <span className="brand-accent">Drive</span></span>
          </div>
          <button onClick={onClose} className="btn-close-sidebar">
            <X size={24} />
          </button>
        </div>

        <nav className="nav-links mobile-sidebar-nav">
          <button 
            onClick={() => {
              setParams({ mode: "links", projectId: null, folderId: null, path: null });
              onClose();
            }} 
            className={`nav-link ${explorerMode === "links" ? "active" : ""}`}
          >
            <LinkIcon size={18} />
            <span>Shared Links</span>
          </button>

          {isAdmin && (
            <Link 
              href="/admin" 
              className="nav-link"
              onClick={onClose}
            >
              <Sliders size={18} />
              <span>Admin Panel</span>
            </Link>
          )}
        </nav>

        <div className="mobile-sidebar-bottom">
          <div className="sidebar-user mobile-sidebar-user">
            <div className="user-avatar">{session.user.name?.charAt(0)}</div>
            <div className="user-info">
              <div className="user-name">{session.user.name}</div>
              <div className="user-role">{(session.user as any).role}</div>
            </div>
          </div>

          {storageStats && (
            <MobileStorageCard
              storageStats={storageStats}
              onOpenAnalytics={() => {
                setShowDetailedUsageModal(true);
                onClose();
              }}
            />
          )}

          <button
            type="button"
            className="mobile-logout-button"
            onClick={() => {
              onClose();
              void handleSignOut();
            }}
          >
            <LogOut size={17} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <style>{`
        .mobile-sidebar {
          height: 100%;
          display: flex;
          flex-direction: column;
          padding-bottom: calc(16px + env(safe-area-inset-bottom));
        }

        .mobile-sidebar-nav {
          flex: 0 0 auto;
          overflow-y: visible;
        }

        .mobile-sidebar-bottom {
          margin-top: auto;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .mobile-storage-card {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin: 0;
          padding: 14px;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.04);
          color: var(--text-primary);
          text-align: left;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
          transition: border-color 0.18s ease, background 0.18s ease, transform 0.18s ease;
        }

        .mobile-storage-card:hover {
          border-color: rgba(129, 140, 248, 0.32);
          background: rgba(255, 255, 255, 0.065);
        }

        .mobile-storage-card:active {
          transform: scale(0.985);
          background: rgba(99, 102, 241, 0.12);
        }

        .mobile-storage-card-top,
        .mobile-storage-title-wrap,
        .mobile-storage-copy,
        .mobile-storage-footer {
          display: flex;
          align-items: center;
        }

        .mobile-storage-card-top,
        .mobile-storage-copy,
        .mobile-storage-footer {
          justify-content: space-between;
          gap: 10px;
        }

        .mobile-storage-title-wrap {
          min-width: 0;
          gap: 8px;
        }

        .mobile-storage-icon {
          width: 28px;
          height: 28px;
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          color: #a5b4fc;
          background: rgba(99, 102, 241, 0.16);
          border: 1px solid rgba(129, 140, 248, 0.18);
        }

        .mobile-storage-title {
          font-size: 13px;
          font-weight: 700;
          color: #f4f4f5;
        }

        .mobile-storage-percent {
          flex: 0 0 auto;
          font-size: 11px;
          font-weight: 700;
          color: #a5b4fc;
        }

        .mobile-storage-copy {
          font-size: 12px;
          line-height: 1.35;
          color: var(--text-secondary);
        }

        .mobile-storage-copy span:first-child {
          color: #e4e4e7;
          font-weight: 650;
        }

        .mobile-storage-track {
          height: 8px;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.1);
        }

        .mobile-storage-fill {
          height: 100%;
          border-radius: 999px;
          background: #6366f1;
          transition: width 0.25s ease;
        }

        .mobile-storage-footer {
          justify-content: flex-end;
          color: #c7d2fe;
          font-size: 12px;
          font-weight: 700;
        }

        .mobile-logout-button {
          width: 100%;
          min-height: 46px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          border-radius: 12px;
          border: 1px solid rgba(248, 113, 113, 0.2);
          background: rgba(239, 68, 68, 0.08);
          color: #fca5a5;
          font-size: 14px;
          font-weight: 700;
          transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease, transform 0.18s ease;
        }

        .mobile-logout-button:hover {
          border-color: rgba(248, 113, 113, 0.34);
          background: rgba(239, 68, 68, 0.12);
          color: #fecaca;
        }

        .mobile-logout-button:active {
          transform: scale(0.985);
          background: rgba(239, 68, 68, 0.16);
        }

        .mobile-sidebar-user {
          margin-top: 2px;
        }
      `}</style>
    </>
  );
}
