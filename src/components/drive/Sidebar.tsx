import React from "react";
import Link from "next/link";
import { 
  LayoutGrid, 
  Share2, 
  Archive, 
  Link as LinkIcon, 
  Plus, 
  Sliders, 
  Activity, 
  LogOut,
  ChevronRight,
  ChevronDown,
  Folder,
  Edit2,
  Trash2,
  Loader2
} from "lucide-react";
import { DriveMode, Project } from "@/types/drive";

interface SidebarProps {
  session: any;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  explorerMode: DriveMode;
  selectedProjectId: string | null;
  selectProject: (id: string | null, name: string) => void;
  selectSharedDrive: () => void;
  selectArchiveDrive: () => void;
  setParams: (params: Record<string, string | null | undefined>) => void;
  setProjectModalOpen: (open: boolean) => void;
  projects: Project[];
  isAdmin: boolean;
  storageStats: any;
  setShowDetailedUsageModal: (open: boolean) => void;
  handleSignOut: () => void;
  
  // Project actions
  setSelectedProjectToEdit: (proj: any) => void;
  setEditProjectName: (name: string) => void;
  setEditProjectClient: (client: string) => void;
  setEditShareWithAll: (share: boolean) => void;
  setEditSelectedUserIds: (ids: string[]) => void;
  setRenameProjectModalOpen: (open: boolean) => void;
  setSelectedProjectToDelete: (proj: any) => void;
  setDeleteProjectModalOpen: (open: boolean) => void;

  // Sidebar expanded limits states
  yourProjsExpanded: boolean;
  setYourProjsExpanded: (exp: boolean) => void;
  sharedProjsExpanded: boolean;
  setSharedProjsExpanded: (exp: boolean) => void;
  archiveProjsExpanded: boolean;
  setArchiveProjsExpanded: (exp: boolean) => void;

  yourProjsLimit: number;
  setYourProjsLimit: (limit: number) => void;
  sharedProjsLimit: number;
  setSharedProjsLimit: (limit: number) => void;
  archiveProjsLimit: number;
  setArchiveProjsLimit: (limit: number) => void;

  // New optional props for operations animations & optimism
  isCreatingProject?: boolean;
  newProjectName?: string;
  isRenamingProject?: boolean;
  selectedProjectToEdit?: any;
  isDeletingProject?: boolean;
  selectedProjectToDelete?: any;
}

export function Sidebar({
  session,
  sidebarOpen,
  setSidebarOpen,
  explorerMode,
  selectedProjectId,
  selectProject,
  selectSharedDrive,
  selectArchiveDrive,
  setParams,
  setProjectModalOpen,
  projects,
  isAdmin,
  storageStats,
  setShowDetailedUsageModal,
  handleSignOut,
  
  setSelectedProjectToEdit,
  setEditProjectName,
  setEditProjectClient,
  setEditShareWithAll,
  setEditSelectedUserIds,
  setRenameProjectModalOpen,
  setSelectedProjectToDelete,
  setDeleteProjectModalOpen,

  yourProjsExpanded,
  setYourProjsExpanded,
  sharedProjsExpanded,
  setSharedProjsExpanded,
  archiveProjsExpanded,
  setArchiveProjsExpanded,

  yourProjsLimit,
  setYourProjsLimit,
  sharedProjsLimit,
  setSharedProjsLimit,
  archiveProjsLimit,
  setArchiveProjsLimit,

  // Destructure new optional props
  isCreatingProject = false,
  newProjectName = "",
  isRenamingProject = false,
  selectedProjectToEdit = null,
  isDeletingProject = false,
  selectedProjectToDelete = null,
}: SidebarProps) {

  // Helper to render individual project item in sidebar
  const renderProjectItem = (proj: any) => {
    const isActive = explorerMode === "personal" && selectedProjectId === proj.id;
    const isOptimistic = proj.isOptimistic;
    const isRenaming = proj.id === selectedProjectToEdit?.id && isRenamingProject;
    const isDeleting = proj.id === selectedProjectToDelete?.id && isDeletingProject;

    // Build the dynamic CSS classes
    let itemClasses = `project-sidebar-item ${isActive ? "active" : ""}`;
    if (isOptimistic) {
      itemClasses += " optimistic-item animate-pulse-light";
    }
    if (isRenaming) {
      itemClasses += " pending-move";
    }
    if (isDeleting) {
      itemClasses += " pending-delete animate-scale-out-item";
    }

    return (
      <div 
        key={proj.id}
        className={itemClasses}
        onClick={() => {
          if (isOptimistic || isRenaming || isDeleting) return;
          selectProject(proj.id, proj.name);
          setSidebarOpen(false);
        }}
        style={{
          paddingLeft: "24px",
          height: "36px",
          fontSize: "13px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderRadius: "8px",
          cursor: (isOptimistic || isRenaming || isDeleting) ? "not-allowed" : "pointer",
          transition: "all 0.2s ease"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flexGrow: 1 }}>
          {(isOptimistic || isRenaming || isDeleting) ? (
            <Loader2 size={14} className="animate-spin" style={{ flexShrink: 0, color: isDeleting ? "var(--accent-red)" : "var(--accent-indigo)" }} />
          ) : (
            <Folder size={14} style={{ flexShrink: 0, opacity: 0.7 }} />
          )}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{proj.name}</span>
        </div>
        {!isOptimistic && !isRenaming && !isDeleting && (
          <div className="project-sidebar-item-actions">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedProjectToEdit(proj);
                setEditProjectName(proj.name);
                setEditProjectClient(proj.clientName || "");
                
                const shareAll = proj.sharedWith === "all" || !proj.sharedWith;
                setEditShareWithAll(shareAll);
                setEditSelectedUserIds(!shareAll && proj.sharedWith ? proj.sharedWith.split(",").map((s: string) => s.trim()).filter(Boolean) : []);
                
                setRenameProjectModalOpen(true);
              }}
              className="btn-icon"
              style={{ padding: "4px", display: "flex", alignItems: "center", justifyContent: "center" }}
              title="Rename Project"
            >
              <Edit2 size={12} />
            </button>
            {(isAdmin || proj.userId === session?.user?.id) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedProjectToDelete(proj);
                  setDeleteProjectModalOpen(true);
                }}
                className="btn-icon delete"
                style={{ padding: "4px", display: "flex", alignItems: "center", justifyContent: "center" }}
                title="Delete Project"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  // Helper to render project section collapsible list
  const renderProjectSection = (
    title: string,
    items: any[],
    isExpanded: boolean,
    toggleExpanded: () => void,
    limit: number,
    setLimit: (l: number) => void
  ) => {
    const visibleItems = isExpanded ? items.slice(0, limit) : [];
    const hasMore = items.length > 5;
    const isShowingAll = limit >= items.length;

    return (
      <div style={{ marginBottom: "12px" }}>
        <div 
          onClick={(e) => {
            e.stopPropagation();
            toggleExpanded();
          }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "6px 12px",
            cursor: "pointer",
            borderRadius: "6px",
            userSelect: "none",
            transition: "background-color 0.2s ease",
          }}
          className="sidebar-section-header"
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
            {isExpanded ? (
              <ChevronDown size={14} style={{ opacity: 0.6, flexShrink: 0 }} />
            ) : (
              <ChevronRight size={14} style={{ opacity: 0.6, flexShrink: 0 }} />
            )}
            <span style={{ 
              fontSize: "12px", 
              fontWeight: 600, 
              color: "var(--text-secondary)",
              overflow: "hidden", 
              textOverflow: "ellipsis", 
              whiteSpace: "nowrap" 
            }}>
              {title} <span style={{ opacity: 0.5, fontWeight: 400, marginLeft: "4px" }}>({items.length})</span>
            </span>
          </div>
        </div>

        {isExpanded && (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "4px" }}>
            {items.length === 0 ? (
              <div style={{ 
                padding: "8px 12px 8px 24px", 
                fontSize: "12px", 
                color: "var(--text-muted)", 
                fontStyle: "italic" 
              }}>
                No projects
              </div>
            ) : (
              <>
                {visibleItems.map(renderProjectItem)}
                
                {hasMore && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isShowingAll) {
                        setLimit(5);
                      } else {
                        setLimit(items.length);
                      }
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--accent-indigo)",
                      fontSize: "11px",
                      fontWeight: 600,
                      textAlign: "left",
                      padding: "6px 12px 6px 24px",
                      cursor: "pointer",
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      opacity: 0.8,
                      transition: "opacity 0.2s ease"
                    }}
                    className="show-more-btn"
                  >
                    {isShowingAll ? "Show Less" : `Show More (${items.length - 5} more)`}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  const currentUserId = session?.user?.id;
  
  let yourProjects = (projects || []).filter(proj => {
    const nameLower = (proj.name || "").toLowerCase();
    const clientLower = (proj.clientName || "").toLowerCase();
    const isArchive = nameLower.includes("archive") || nameLower.includes("archived") || clientLower.includes("archive") || clientLower.includes("archived");
    return proj.userId === currentUserId && !isArchive;
  });

  if (isCreatingProject) {
    yourProjects = [
      {
        id: "optimistic-project",
        name: newProjectName || "Creating Project...",
        clientName: "",
        userId: currentUserId,
        isOptimistic: true,
        createdAt: new Date()
      },
      ...yourProjects
    ];
  }

  const sharedProjects = (projects || []).filter(proj => {
    const nameLower = (proj.name || "").toLowerCase();
    const clientLower = (proj.clientName || "").toLowerCase();
    const isArchive = nameLower.includes("archive") || nameLower.includes("archived") || clientLower.includes("archive") || clientLower.includes("archived");
    return proj.userId !== currentUserId && !isArchive;
  });

  const archiveProjects = (projects || []).filter(proj => {
    const nameLower = (proj.name || "").toLowerCase();
    const clientLower = (proj.clientName || "").toLowerCase();
    return nameLower.includes("archive") || nameLower.includes("archived") || clientLower.includes("archive") || clientLower.includes("archived");
  });

  return (
    <>
      {sidebarOpen && (
        <div className="sidebar-backdrop show" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <LayoutGrid size={24} className="brand-accent" />
          <span>Motionsewa <span className="brand-accent">Drive</span></span>
        </div>

        <nav className="nav-links">
          <button 
            onClick={() => {
              selectProject(null, "My Drive");
              setSidebarOpen(false);
            }} 
            className={`nav-link ${explorerMode === "personal" && selectedProjectId === null ? "active" : ""}`}
          >
            <LayoutGrid size={18} />
            <span>My Drive</span>
          </button>

          <button 
            onClick={() => {
              selectSharedDrive();
              setSidebarOpen(false);
            }} 
            className={`nav-link ${explorerMode === "shared" ? "active" : ""}`}
          >
            <Share2 size={18} />
            <span>Shared Drive</span>
          </button>

          <button 
            onClick={() => {
              selectArchiveDrive();
              setSidebarOpen(false);
            }} 
            className={`nav-link ${explorerMode === "archive" ? "active" : ""}`}
          >
            <Archive size={18} />
            <span>Archive Drive</span>
          </button>

          <button 
            onClick={() => {
              setParams({ mode: "links", projectId: null, folderId: null, path: null });
              setSidebarOpen(false);
            }} 
            className={`nav-link ${explorerMode === "links" ? "active" : ""}`}
          >
            <LinkIcon size={18} />
            <span>Shared Links</span>
          </button>

          <div style={{ marginTop: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", marginBottom: "12px" }}>
              <span className="section-title" style={{ margin: 0, fontSize: "11px", letterSpacing: "0.05em", textTransform: "uppercase", opacity: 0.8 }}>Projects</span>
              <button 
                onClick={() => {
                  setProjectModalOpen(true);
                  setSidebarOpen(false);
                }} 
                title="New Project" 
                className="btn-icon"
              >
                <Plus size={14} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {renderProjectSection(
                "My Projects",
                yourProjects,
                yourProjsExpanded,
                () => setYourProjsExpanded(!yourProjsExpanded),
                yourProjsLimit,
                setYourProjsLimit
              )}
              {renderProjectSection(
                "Shared Projects",
                sharedProjects,
                sharedProjsExpanded,
                () => setSharedProjsExpanded(!sharedProjsExpanded),
                sharedProjsLimit,
                setSharedProjsLimit
              )}
              {renderProjectSection(
                "Archive Projects",
                archiveProjects,
                archiveProjsExpanded,
                () => setArchiveProjsExpanded(!archiveProjsExpanded),
                archiveProjsLimit,
                setArchiveProjsLimit
              )}
            </div>
          </div>

          {isAdmin && (
            <Link 
              href="/admin" 
              className="nav-link" 
              style={{ marginTop: "24px" }}
              onClick={() => setSidebarOpen(false)}
            >
              <Sliders size={18} />
              <span>Admin Panel</span>
            </Link>
          )}
        </nav>

        {/* Storage Indicator */}
        {storageStats && (
          <div style={{
            padding: "16px 24px",
            background: "rgba(255, 255, 255, 0.015)",
            borderTop: "1px solid var(--border-color)",
            borderBottom: "1px solid var(--border-color)",
            borderLeft: "none",
            borderRight: "none",
            borderRadius: "0px",
            margin: "12px 0 16px 0",
            fontSize: "12px",
            flexShrink: 0
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontWeight: "500" }}>
              <span style={{ color: "var(--text-secondary)" }}>Storage</span>
              <span style={{ color: "var(--text-primary)" }}>
                {(storageStats.used / (1024 * 1024 * 1024)).toFixed(1)} GB / {(storageStats.limit / (1024 * 1024 * 1024)).toFixed(0)} GB
              </span>
            </div>
            <div style={{
              width: "100%",
              height: "6px",
              background: "rgba(255, 255, 255, 0.05)",
              borderRadius: "9999px",
              overflow: "hidden"
            }}>
              <div style={{
                width: `${Math.min(100, (storageStats.used / storageStats.limit) * 100)}%`,
                height: "100%",
                background: "linear-gradient(90deg, var(--accent-blue), var(--accent-indigo))",
                borderRadius: "9999px",
                transition: "width 0.3s ease"
              }} />
            </div>
            <div style={{ marginTop: "6px", fontSize: "10px", color: "var(--text-muted)", display: "flex", justifyContent: "space-between" }}>
              <span>{((storageStats.used / storageStats.limit) * 100).toFixed(0)}% Used</span>
              <span>{((storageStats.limit - storageStats.used) / (1024 * 1024 * 1024)).toFixed(1)} GB Free</span>
            </div>

            <button 
              onClick={() => setShowDetailedUsageModal(true)}
              style={{
                width: "100%",
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
                borderRadius: "8px",
                color: "#a1a1aa",
                fontSize: "11px",
                fontWeight: "600",
                padding: "8px 12px",
                marginTop: "14px",
                cursor: "pointer",
                transition: "all 0.2s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px"
              }}
              className="usage-details-btn"
            >
              <Activity size={12} style={{ color: "var(--accent-blue)" }} />
              <span>Storage Analytics</span>
            </button>
          </div>
        )}

        {/* User Card */}
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
