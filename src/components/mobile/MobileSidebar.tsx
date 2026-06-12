import React from "react";
import Link from "next/link";
import { 
  Link as LinkIcon, 
  Sliders, 
  Activity, 
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
  handleSignOut: () => void;
  setParams: (params: Record<string, string | null | undefined>) => void;
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
        <div className="sidebar-backdrop show" onClick={onClose} />
      )}

      <aside className={`sidebar mobile-sidebar ${isOpen ? "sidebar-open" : ""}`}>
        <div className="mobile-sidebar-header">
          <div className="brand">
            <span>Motionsewa <span className="brand-accent">Drive</span></span>
          </div>
          <button onClick={onClose} className="btn-close-sidebar">
            <X size={24} />
          </button>
        </div>

        <nav className="nav-links">
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

        {storageStats && (
          <div className="sidebar-storage-card">
            <div className="storage-header">
              <Activity size={16} style={{ color: "var(--accent-blue)" }} />
              <span className="storage-title">Storage</span>
            </div>
            
            <div className="storage-stats">
              <span className="storage-used">
                {(storageStats.used / (1024 * 1024 * 1024)).toFixed(1)} GB
              </span>
              <span className="storage-separator">/</span>
              <span className="storage-total">
                {(storageStats.limit / (1024 * 1024 * 1024)).toFixed(0)} GB
              </span>
            </div>

            <div className="storage-bar">
              <div 
                className="storage-bar-fill"
                style={{ 
                  width: `${Math.min(100, (storageStats.used / storageStats.limit) * 100)}%` 
                }}
              />
            </div>

            <button 
              onClick={() => {
                setShowDetailedUsageModal(true);
                onClose();
              }}
              className="btn-storage-details"
            >
              View Analytics
            </button>
          </div>
        )}

        <div className="sidebar-user">
          <div className="user-avatar">{session.user.name?.charAt(0)}</div>
          <div className="user-info">
            <div className="user-name">{session.user.name}</div>
            <div className="user-role">{(session.user as any).role}</div>
          </div>
          <button onClick={handleSignOut} className="btn-signout" title="Sign Out">
            <LogOut size={16} />
          </button>
        </div>
      </aside>
    </>
  );
}
