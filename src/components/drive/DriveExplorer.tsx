import React from "react";
import { 
  ChevronRight, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  List, 
  LayoutGrid, 
  Plus, 
  ChevronDown, 
  FolderPlus, 
  FileText, 
  Table, 
  Upload, 
  FolderUp, 
  Loader2, 
  Link as LinkIcon, 
  Copy, 
  Square, 
  CheckSquare, 
  Folder, 
  File, 
  Download,
  FolderOpen,
  Minus,
  FolderInput,
  X
} from "lucide-react";
import { DriveMode, Project, Folder as FolderType, Asset, SharedLink, FolderPathNode } from "@/types/drive";

interface DriveExplorerProps {
  explorerMode: DriveMode;
  selectedProjectId: string | null;
  currentFolderId: string | null;
  rawPath: string;
  folderPath: FolderPathNode[];
  projects: Project[];
  session: any;
  isAdmin: boolean;
  contentsLoading: boolean;
  sharedFolderPath: string[];
  archiveFolderPath: string[];
  sharedLinksList: SharedLink[];
  sharedLinksLoading: boolean;
  viewMode: "table" | "icons";
  searchQuery: string;
  
  // New dropdown ref/state
  newDropdownOpen: boolean;
  setNewDropdownOpen: (open: boolean) => void;
  newDropdownRef: React.RefObject<HTMLDivElement | null>;

  // Project action ref/state
  projectHeaderMenuOpen: boolean;
  setProjectHeaderMenuOpen: (open: boolean) => void;
  projectHeaderRef: React.RefObject<HTMLDivElement | null>;

  // Selection states
  selectedAssetIds: Set<string>;
  selectedFolderIds: Set<string>;
  handleToggleAssetSelection: (id: string) => void;
  handleToggleFolderSelection: (id: string) => void;
  isAllSelected: boolean;
  handleSelectAll: () => void;
  handleClearSelection: () => void;

  // Render lists
  filteredFolders: FolderType[];
  filteredAssets: Asset[];

  // Navigation handlers
  handleBreadcrumbClick: (index: number) => void;
  handleBreadcrumbClickShared: (path: string[]) => void;
  handleBreadcrumbClickArchive: (path: string[]) => void;
  navigateToFolder: (folder: any) => void;

  // Project dialog setters
  setSelectedProjectToEdit: (proj: any) => void;
  setEditProjectName: (name: string) => void;
  setEditProjectClient: (client: string) => void;
  setEditShareWithAll: (share: boolean) => void;
  setEditSelectedUserIds: (ids: string[]) => void;
  setRenameProjectModalOpen: (open: boolean) => void;
  setSelectedProjectToDelete: (proj: any) => void;
  setDeleteProjectModalOpen: (open: boolean) => void;

  // Folder modal
  setFolderModalOpen: (open: boolean) => void;

  // File builders modal triggers
  handleOpenTextCreator: () => void;
  handleOpenDocsCreator: () => void;
  handleOpenSheetCreator: () => void;

  // Upload elements and triggers
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  folderInputRef: React.RefObject<HTMLInputElement | null>;
  triggerFileSelect: () => void;
  triggerFolderSelect: () => void;

  // Core file actions
  handleDeleteFolder: (id: string, name: string) => void;
  handleDeleteFile: (id: string) => void;
  handleDownloadFile: (id: string) => void;
  handleContextMenu: (e: React.MouseEvent, item: any, type: "file" | "folder") => void;

  // Bulk operation triggers
  handleBulkDelete: () => void;
  handleBulkMove: () => void;
  handleBulkCopy: () => void;

  // Shared Link Actions
  extendSharedLink: (id: string, hours: number) => Promise<any>;
  revokeSharedLink: (id: string) => Promise<any>;
  refetchSharedLinks: () => void;
  showToast: (msg: string, type?: "info" | "success" | "error") => void;

  // New optional props for operations animations & optimism
  pendingDeleteIds?: Set<string>;
  pendingMoveIds?: Set<string>;
  isCreatingFolder?: boolean;
  newFolderName?: string;
  isSavingTextFile?: boolean;
  textFileName?: string;
  isSavingDocsFile?: boolean;
  docTitle?: string;
  isSavingSheetFile?: boolean;
  sheetName?: string;
  isRenamingProject?: boolean;
  isDeletingProject?: boolean;
  selectedProjectToEdit?: any;
  selectedProjectToDelete?: any;
}

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export function DriveExplorer({
  explorerMode,
  selectedProjectId,
  currentFolderId,
  rawPath,
  folderPath,
  projects,
  session,
  isAdmin,
  contentsLoading,
  sharedFolderPath,
  archiveFolderPath,
  sharedLinksList,
  sharedLinksLoading,
  viewMode,
  searchQuery,
  newDropdownOpen,
  setNewDropdownOpen,
  newDropdownRef,
  projectHeaderMenuOpen,
  setProjectHeaderMenuOpen,
  projectHeaderRef,
  selectedAssetIds,
  selectedFolderIds,
  handleToggleAssetSelection,
  handleToggleFolderSelection,
  isAllSelected,
  handleSelectAll,
  handleClearSelection,
  filteredFolders,
  filteredAssets,
  handleBreadcrumbClick,
  handleBreadcrumbClickShared,
  handleBreadcrumbClickArchive,
  navigateToFolder,
  setSelectedProjectToEdit,
  setEditProjectName,
  setEditProjectClient,
  setEditShareWithAll,
  setEditSelectedUserIds,
  setRenameProjectModalOpen,
  setSelectedProjectToDelete,
  setDeleteProjectModalOpen,
  setFolderModalOpen,
  handleOpenTextCreator,
  handleOpenDocsCreator,
  handleOpenSheetCreator,
  fileInputRef,
  folderInputRef,
  triggerFileSelect,
  triggerFolderSelect,
  handleDeleteFolder,
  handleDeleteFile,
  handleDownloadFile,
  handleContextMenu,
  handleBulkDelete,
  handleBulkMove,
  handleBulkCopy,
  extendSharedLink,
  revokeSharedLink,
  refetchSharedLinks,
  showToast,

  // New optional props for operations animations & optimism
  pendingDeleteIds = new Set<string>(),
  pendingMoveIds = new Set<string>(),
  isCreatingFolder = false,
  newFolderName = "",
  isSavingTextFile = false,
  textFileName = "",
  isSavingDocsFile = false,
  docTitle = "",
  isSavingSheetFile = false,
  sheetName = "",
  isRenamingProject = false,
  isDeletingProject = false,
  selectedProjectToEdit = null,
  selectedProjectToDelete = null,
}: DriveExplorerProps) {

  const currentUserId = session?.user?.id;

  // Support optimistic folder creation
  let foldersToRender = [...filteredFolders];
  if (isCreatingFolder) {
    foldersToRender = [
      {
        id: "optimistic-folder-id",
        name: newFolderName || "Creating Folder...",
        userId: currentUserId,
        isOptimistic: true,
        createdAt: new Date().toISOString()
      } as any,
      ...foldersToRender
    ];
  }

  // Support optimistic file creation
  let assetsToRender = [...filteredAssets];
  if (isSavingTextFile) {
    assetsToRender = [
      {
        id: "optimistic-text-id",
        filename: textFileName || "Untitled.txt",
        size: 0,
        r2Key: "",
        uploadedBy: currentUserId,
        isOptimistic: true,
        createdAt: new Date().toISOString()
      } as any,
      ...assetsToRender
    ];
  }
  if (isSavingDocsFile) {
    assetsToRender = [
      {
        id: "optimistic-doc-id",
        filename: docTitle ? (docTitle.toLowerCase().endsWith(".html") ? docTitle : `${docTitle}.html`) : "Untitled Document.html",
        size: 0,
        r2Key: "",
        uploadedBy: currentUserId,
        isOptimistic: true,
        createdAt: new Date().toISOString()
      } as any,
      ...assetsToRender
    ];
  }
  if (isSavingSheetFile) {
    assetsToRender = [
      {
        id: "optimistic-sheet-id",
        filename: sheetName ? (sheetName.toLowerCase().endsWith(".sheet.json") ? sheetName : `${sheetName}.sheet.json`) : "Untitled Sheet.sheet.json",
        size: 0,
        r2Key: "",
        uploadedBy: currentUserId,
        isOptimistic: true,
        createdAt: new Date().toISOString()
      } as any,
      ...assetsToRender
    ];
  }

  return (
    <div className="explorer animate-fade-in">
      {/* Breadcrumb Path */}
      <div className="breadcrumbs">
        {explorerMode === "shared" ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span 
                className={`breadcrumb-item ${sharedFolderPath.length === 0 ? "active" : ""}`}
                onClick={() => handleBreadcrumbClickShared([])}
              >
                Shared Drive
              </span>
            </div>
            {sharedFolderPath.map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <ChevronRight size={16} style={{ opacity: 0.5 }} />
                <span 
                  className={`breadcrumb-item ${i === sharedFolderPath.length - 1 ? "active" : ""}`}
                  onClick={() => handleBreadcrumbClickShared(sharedFolderPath.slice(0, i + 1))}
                >
                  {item}
                </span>
              </div>
            ))}
          </>
        ) : explorerMode === "archive" ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span 
                className={`breadcrumb-item ${archiveFolderPath.length === 0 ? "active" : ""}`}
                onClick={() => handleBreadcrumbClickArchive([])}
              >
                Archive Drive
              </span>
            </div>
            {archiveFolderPath.map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <ChevronRight size={16} style={{ opacity: 0.5 }} />
                <span 
                  className={`breadcrumb-item ${i === archiveFolderPath.length - 1 ? "active" : ""}`}
                  onClick={() => handleBreadcrumbClickArchive(archiveFolderPath.slice(0, i + 1))}
                >
                  {item}
                </span>
              </div>
            ))}
          </>
        ) : (
          folderPath.map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {i > 0 && <ChevronRight size={16} style={{ opacity: 0.5 }} />}
              <span 
                className={`breadcrumb-item ${i === folderPath.length - 1 ? "active" : ""}`}
                onClick={() => handleBreadcrumbClick(i)}
              >
                {item.name}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="explorer-header">
        <h2 className="explorer-title" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span>
            {explorerMode === "shared" 
              ? (sharedFolderPath[sharedFolderPath.length - 1] || "Shared Drive")
              : explorerMode === "archive"
              ? (archiveFolderPath[archiveFolderPath.length - 1] || "Archive Drive")
              : (folderPath[folderPath.length - 1]?.name || "My Drive")
            }
          </span>
          {((isRenamingProject && selectedProjectToEdit?.id === selectedProjectId) || 
            (isDeletingProject && selectedProjectToDelete?.id === selectedProjectId)) && (
            <Loader2 className="animate-spin brand-accent animate-pulse-light" size={18} />
          )}
        </h2>

          {(() => {
            const currentOpenProject = explorerMode === "personal" && selectedProjectId 
              ? projects.find((p: any) => p.id === selectedProjectId)
              : null;
            
            if (!currentOpenProject) return null;

            return (
              <div ref={projectHeaderRef as any} style={{ position: "relative", display: "inline-flex" }}>
                <button
                  onClick={() => setProjectHeaderMenuOpen(!projectHeaderMenuOpen)}
                  className="btn-icon"
                  style={{
                    padding: "6px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "8px",
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    cursor: "pointer",
                    color: "rgba(255, 255, 255, 0.8)",
                    transition: "all 0.2s"
                  }}
                  title="Project Actions"
                >
                  <MoreVertical size={16} />
                </button>

                {projectHeaderMenuOpen && (
                  <div 
                    className="new-dropdown-menu animate-scale-up" 
                    style={{ 
                      right: "auto", 
                      left: 0, 
                      top: "100%", 
                      marginTop: "8px", 
                      zIndex: 100,
                      minWidth: "200px"
                    }}
                  >
                    <button 
                      onClick={() => {
                        setSelectedProjectToEdit(currentOpenProject);
                        setEditProjectName(currentOpenProject.name);
                        setEditProjectClient(currentOpenProject.clientName || "");
                        
                        const shareAll = currentOpenProject.sharedWith === "all" || !currentOpenProject.sharedWith;
                        setEditShareWithAll(shareAll);
                        setEditSelectedUserIds(!shareAll && currentOpenProject.sharedWith ? currentOpenProject.sharedWith.split(",").map((s: string) => s.trim()).filter(Boolean) : []);
                        
                        setRenameProjectModalOpen(true);
                        setProjectHeaderMenuOpen(false);
                      }}
                      className="dropdown-item"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        width: "100%",
                        padding: "10px 14px",
                        background: "none",
                        border: "none",
                        color: "var(--text-primary)",
                        textAlign: "left",
                        cursor: "pointer",
                        fontSize: "13px",
                        borderRadius: "4px",
                        transition: "background 0.2s"
                      }}
                    >
                      <Edit2 size={14} />
                      <span>Rename / Edit Project</span>
                    </button>
                    
                    {(isAdmin || currentOpenProject?.userId === session?.user?.id) && (
                      <button 
                        onClick={() => {
                          setSelectedProjectToDelete(currentOpenProject);
                          setDeleteProjectModalOpen(true);
                          setProjectHeaderMenuOpen(false);
                        }}
                        className="dropdown-item"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          width: "100%",
                          padding: "10px 14px",
                          background: "none",
                          border: "none",
                          color: "#ff4d4d",
                          textAlign: "left",
                          cursor: "pointer",
                          fontSize: "13px",
                          borderRadius: "4px",
                          transition: "background 0.2s"
                        }}
                      >
                        <Trash2 size={14} style={{ color: "#ff4d4d" }} />
                        <span>Delete Project</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        
        
        <div className="explorer-actions" ref={newDropdownRef as any}>
          {explorerMode !== "archive" && explorerMode !== "links" && (
            <div style={{ position: "relative" }}>
              <button 
                onClick={() => setNewDropdownOpen(!newDropdownOpen)} 
                className="btn-primary"
                style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 18px" }}
              >
                <Plus size={18} />
                <span>New</span>
                <ChevronDown size={14} style={{ opacity: 0.8 }} />
              </button>

              {newDropdownOpen && (
                <div className="new-dropdown-menu animate-scale-up">
                  <button 
                    onClick={() => {
                      setFolderModalOpen(true);
                      setNewDropdownOpen(false);
                    }} 
                    className="dropdown-item"
                  >
                    <FolderPlus size={16} />
                    <span>New Folder</span>
                  </button>
                  
                  <button 
                    onClick={() => {
                      handleOpenTextCreator();
                      setNewDropdownOpen(false);
                    }} 
                    className="dropdown-item"
                  >
                    <FileText size={16} />
                    <span>Create Text File</span>
                  </button>

                  <button 
                    onClick={() => {
                      handleOpenDocsCreator();
                      setNewDropdownOpen(false);
                    }} 
                    className="dropdown-item"
                  >
                    <FileText size={16} style={{ color: "var(--accent-indigo)" }} />
                    <span>Docs (Rich Document)</span>
                  </button>

                  <button 
                    onClick={() => {
                      handleOpenSheetCreator();
                      setNewDropdownOpen(false);
                    }} 
                    className="dropdown-item"
                  >
                    <Table size={16} style={{ color: "var(--accent-success, #10b981)" }} />
                    <span>Blank Sheet</span>
                  </button>

                  <hr className="dropdown-divider" />

                  <button 
                    onClick={() => {
                      triggerFileSelect();
                      setNewDropdownOpen(false);
                    }} 
                    className="dropdown-item"
                  >
                    <Upload size={16} />
                    <span>Upload File</span>
                  </button>

                  <button 
                    onClick={() => {
                      triggerFolderSelect();
                      setNewDropdownOpen(false);
                    }} 
                    className="dropdown-item"
                  >
                    <FolderUp size={16} />
                    <span>Upload Folder</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* VIEW RENDER: TABLE OR ICONS */}
      {explorerMode !== "links" && contentsLoading ? (
        <div style={{ 
          display: "flex", 
          flexDirection: "column",
          alignItems: "center", 
          justifyContent: "center", 
          height: "280px", 
          borderRadius: "16px",
          background: "rgba(255, 255, 255, 0.02)",
          border: "1px dashed rgba(255, 255, 255, 0.1)",
          backdropFilter: "blur(8px)",
          gap: "16px",
          marginTop: "12px"
        }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Loader2 size={36} style={{ color: "var(--brand-accent)", animation: "spin-loader 1s linear infinite" }} />
          </div>
          <span style={{ fontSize: "14px", fontWeight: "500", color: "var(--text-secondary)", letterSpacing: "0.02em" }}>
            {explorerMode === "personal" 
              ? "Querying personal drive from DB..." 
              : explorerMode === "shared" 
                ? "Directly listing Shared R2 S3..." 
                : "Directly listing Archive B2 S3..."}
          </span>
        </div>
      ) : explorerMode === "links" ? (
        /* SHARED LINKS MANAGER VIEW */
        <div>
          {sharedLinksLoading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "240px" }}>
              <Loader2 className="animate-spin" size={32} style={{ color: "var(--brand-accent)" }} />
              <span style={{ marginLeft: "12px", fontSize: "14px", color: "var(--text-secondary)" }}>Loading shared links...</span>
            </div>
          ) : sharedLinksList.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "240px", border: "1px dashed var(--border-color)", borderRadius: "12px", background: "var(--bg-secondary)", color: "var(--text-secondary)" }}>
              <LinkIcon size={36} style={{ marginBottom: "12px", opacity: 0.7 }} />
              <p style={{ fontSize: "14px", fontWeight: "500" }}>No shared links created yet.</p>
              <p style={{ fontSize: "12px", opacity: 0.8, marginTop: "4px" }}>Generate share links by copying any file link in your drives.</p>
            </div>
          ) : (
            <div className="files-container">
              <div className="table-header" style={{ gridTemplateColumns: "2.5fr 1.2fr 1.2fr 1fr" }}>
                <div>File Name</div>
                <div>Created At</div>
                <div>Expires At</div>
                <div style={{ textAlign: "right" }}>Actions</div>
              </div>

              {sharedLinksList.map((link: any) => {
                const isExpired = new Date() > new Date(link.expiresAt);
                const isRevoked = link.isRevoked;
                const isActive = !isExpired && !isRevoked;

                let statusBadge = (
                  <span className="badge success" style={{ color: "#10b981", fontSize: "11px", fontWeight: "700", display: "inline-block", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                    Active
                  </span>
                );
                if (isRevoked) {
                  statusBadge = (
                    <span className="badge danger" style={{ color: "var(--accent-destructive)", fontSize: "11px", fontWeight: "700", display: "inline-block", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                      Revoked
                    </span>
                  );
                } else if (isExpired) {
                  statusBadge = (
                    <span className="badge warning" style={{ color: "#f59e0b", fontSize: "11px", fontWeight: "700", display: "inline-block", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                      Expired
                    </span>
                  );
                }

                return (
                  <div 
                    key={link.id} 
                    className="file-row" 
                    style={{ gridTemplateColumns: "2.5fr 1.2fr 1.2fr 1fr", cursor: "default" }}
                  >
                    <div className="file-info" style={{ minWidth: 0 }}>
                      <LinkIcon size={16} style={{ color: "var(--brand-accent)", opacity: isActive ? 1 : 0.5, flexShrink: 0 }} />
                      <span className="file-name" title={link.filename} style={{ textDecoration: isActive ? "none" : "line-through", opacity: isActive ? 1 : 0.6 }}>
                        {link.filename}
                      </span>
                    </div>

                    <div className="file-size" style={{ opacity: 0.8, fontSize: "13px" }}>
                      {new Date(link.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </div>

                    <div className="file-date" style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                      <span style={{ opacity: isActive ? 0.9 : 0.6, fontSize: "13px" }}>
                        {new Date(link.expiresAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {statusBadge}
                    </div>

                    <div className="file-actions" style={{ gap: "8px", justifyContent: "flex-end" }}>
                      <button
                        onClick={async () => {
                          const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
                          const shareUrl = `${appUrl}/share/${link.id}`;
                          await navigator.clipboard.writeText(shareUrl);
                          showToast("Proxy sharing link copied to clipboard!", "success");
                        }}
                        className="btn-icon"
                        title="Copy Secure Link"
                        style={{ opacity: isActive ? 1 : 0.5 }}
                      >
                        <Copy size={16} />
                      </button>

                      <button
                        onClick={async () => {
                          try {
                            await extendSharedLink(link.id, 24);
                            refetchSharedLinks();
                            showToast("Link lifespan extended by 24h!", "success");
                          } catch (e) {
                            showToast("Failed to extend link", "error");
                          }
                        }}
                        className="btn-icon"
                        title="Extend Age (Add 24h)"
                        style={{ color: "var(--brand-accent)" }}
                      >
                        <Plus size={16} />
                      </button>

                      {isActive && (
                        <button
                          onClick={async () => {
                            try {
                              await revokeSharedLink(link.id);
                              refetchSharedLinks();
                              showToast("Link expired instantly!", "success");
                            } catch (e) {
                              showToast("Failed to revoke link", "error");
                            }
                          }}
                          className="btn-icon delete"
                          title="Revoke / Expire Now"
                        >
                          <Minus size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : foldersToRender.length === 0 && assetsToRender.length === 0 ? (
        /* EMPTY STATE VIEW */
        <div style={{ 
          display: "flex", 
          flexDirection: "column", 
          alignItems: "center", 
          justifyContent: "center", 
          height: "320px", 
          border: "1px dashed var(--border-color)", 
          borderRadius: "16px", 
          background: "rgba(255, 255, 255, 0.01)", 
          color: "var(--text-secondary)",
          gap: "16px",
          marginTop: "12px",
          padding: "24px",
          textAlign: "center"
        }}>
          <FolderOpen size={48} style={{ opacity: 0.5, color: "var(--brand-accent)" }} />
          <div>
            <p style={{ fontSize: "16px", fontWeight: "600", margin: 0, color: "var(--text-primary)" }}>This folder is empty</p>
            <p style={{ fontSize: "13px", opacity: 0.7, margin: "4px 0 0 0", maxWidth: "320px" }}>
              Upload files, create nested directories, or launch live text documents directly from the {"+ New"} toolbar.
            </p>
          </div>
          {explorerMode !== "archive" && (
            <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
              <button onClick={setFolderModalOpen.bind(null, true)} className="btn-secondary" style={{ display: "flex", alignItems: "center", gap: "6px", height: "36px", padding: "0 14px", fontSize: "13px" }}>
                <FolderPlus size={14} />
                <span>Create Folder</span>
              </button>
              <button onClick={triggerFileSelect} className="btn-primary" style={{ display: "flex", alignItems: "center", gap: "6px", height: "36px", padding: "0 14px", fontSize: "13px" }}>
                <Upload size={14} />
                <span>Upload Files</span>
              </button>
            </div>
          )}
        </div>
      ) : viewMode === "table" ? (
        /* 1. COMPACT TABLE VIEW */
        <div className="files-container">
          <div className="table-header" style={{ gridTemplateColumns: "3fr 1.2fr 1.2fr 1fr" }}>
            <div className="file-info" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button 
                onClick={handleSelectAll}
                className={`item-select-checkbox ${isAllSelected ? "selected" : ""}`}
                title={isAllSelected ? "Deselect all" : "Select all"}
              >
                {isAllSelected ? (
                  <CheckSquare size={16} className="brand-accent" />
                ) : (
                  <Square size={16} />
                )}
              </button>
              <span>Name</span>
            </div>
            <div>Size</div>
            <div>Type / Owner</div>
            <div style={{ textAlign: "right" }}>Actions</div>
          </div>

          {/* FOLDERS LIST ROWS FIRST */}
          {foldersToRender.map((folder) => {
            const isFolderSelected = selectedFolderIds.has(folder.id);
            const isOptimistic = (folder as any).isOptimistic;
            const isDeleting = pendingDeleteIds.has(folder.id);
            const isMoving = pendingMoveIds.has(folder.id);

            let rowClasses = `file-row ${isFolderSelected ? "selected" : ""}`;
            if (isOptimistic) rowClasses += " optimistic-item animate-pulse-light animate-scale-in-item optimistic-glow";
            if (isDeleting) rowClasses += " pending-delete animate-scale-out-item";
            if (isMoving) rowClasses += " pending-move animate-pulse-light";

            return (
              <div 
                key={folder.id} 
                className={rowClasses}
                style={{ cursor: (isOptimistic || isDeleting || isMoving) ? "not-allowed" : "pointer", gridTemplateColumns: "3fr 1.2fr 1.2fr 1fr" }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (isOptimistic || isDeleting || isMoving) return;
                  navigateToFolder(folder);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isOptimistic || isDeleting || isMoving) return;
                  navigateToFolder(folder);
                }}
                onContextMenu={(e) => {
                  if (isOptimistic || isDeleting || isMoving) return;
                  handleContextMenu(e, folder, "folder");
                }}
              >
                <div className="file-info">
                  {!isOptimistic && !isDeleting && !isMoving ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleFolderSelection(folder.id);
                      }}
                      className={`item-select-checkbox ${isFolderSelected ? "selected" : ""}`}
                      title={isFolderSelected ? "Deselect folder" : "Select folder"}
                    >
                      {isFolderSelected ? (
                        <CheckSquare size={16} className="brand-accent" />
                      ) : (
                        <Square size={16} className="checkbox-unselected" />
                      )}
                    </button>
                  ) : (
                    <div style={{ width: "24px" }} />
                  )}
                  {isOptimistic || isDeleting || isMoving ? (
                    <Loader2 className="animate-spin" size={18} style={{ color: isDeleting ? "var(--accent-red)" : "var(--accent-indigo)", marginRight: "10px" }} />
                  ) : (
                    <Folder className="folder-icon" size={18} style={{ color: "var(--accent-indigo)" }} />
                  )}
                  <span className="file-name" title={folder.name}>
                    {isDeleting ? `Deleting "${folder.name}"...` : isMoving ? `Moving "${folder.name}"...` : folder.name}
                  </span>
                </div>

                <div className="file-size">-</div>

                <div className="file-date">Folder</div>

                <div className="file-actions">
                  {!isOptimistic && !isDeleting && !isMoving && (isAdmin || ('userId' in folder && folder.userId === currentUserId)) && explorerMode !== "archive" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFolder(folder.id, folder.name);
                      }}
                      className="btn-icon delete"
                      title="Delete Folder"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* FILES LIST ROWS NEXT */}
          {assetsToRender.map((asset) => {
            const isAssetSelected = selectedAssetIds.has(asset.id);
            const isOptimistic = (asset as any).isOptimistic;
            const isDeleting = pendingDeleteIds.has(asset.id);
            const isMoving = pendingMoveIds.has(asset.id);

            let rowClasses = `file-row ${isAssetSelected ? "selected" : ""}`;
            if (isOptimistic) rowClasses += " optimistic-item animate-pulse-light animate-scale-in-item optimistic-glow";
            if (isDeleting) rowClasses += " pending-delete animate-scale-out-item";
            if (isMoving) rowClasses += " pending-move animate-pulse-light";

            return (
              <div 
                key={asset.id} 
                className={rowClasses}
                onContextMenu={(e) => {
                  if (isOptimistic || isDeleting || isMoving) return;
                  handleContextMenu(e, asset, "file");
                }}
                style={{ cursor: (isOptimistic || isDeleting || isMoving) ? "not-allowed" : "pointer", gridTemplateColumns: "3fr 1.2fr 1.2fr 1fr" }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (isOptimistic || isDeleting || isMoving) return;
                  handleDownloadFile(asset.id);
                }}
              >
                <div className="file-info">
                  {!isOptimistic && !isDeleting && !isMoving ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleAssetSelection(asset.id);
                      }}
                      className={`item-select-checkbox ${isAssetSelected ? "selected" : ""}`}
                      title={isAssetSelected ? "Deselect file" : "Select file"}
                    >
                      {isAssetSelected ? (
                        <CheckSquare size={16} className="brand-accent" />
                      ) : (
                        <Square size={16} className="checkbox-unselected" />
                      )}
                    </button>
                  ) : (
                    <div style={{ width: "24px" }} />
                  )}
                  {isOptimistic || isDeleting || isMoving ? (
                    <Loader2 className="animate-spin" size={18} style={{ color: isDeleting ? "var(--accent-red)" : "var(--accent-blue)", marginRight: "10px" }} />
                  ) : (
                    <File className="file-icon" size={18} style={{ color: "var(--accent-blue)" }} />
                  )}
                  <span className="file-name" title={asset.filename}>
                    {isDeleting ? `Deleting "${asset.filename}"...` : isMoving ? `Moving "${asset.filename}"...` : asset.filename}
                  </span>
                </div>

                <div className="file-size">{isOptimistic ? "-" : formatBytes(asset.size)}</div>

                <div className="file-date" title={asset.uploadedBy || "Creator"}>
                  {asset.uploadedBy || "Creator"}
                </div>

                <div className="file-actions">
                  {!isOptimistic && !isDeleting && !isMoving && (
                    <>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadFile(asset.id);
                        }} 
                        className="btn-icon" 
                        title="Download File"
                      >
                        <Download size={16} />
                      </button>
                      {(isAdmin || ('uploadedBy' in asset && asset.uploadedBy === currentUserId)) && explorerMode !== "archive" && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFile(asset.id);
                          }} 
                          className="btn-icon delete" 
                          title="Delete File"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* 2. VISUAL ICONS GRID VIEW */
        <div style={{ display: "flex", flexDirection: "column", gap: "24px", marginTop: "12px" }}>
          {/* Folders Grid Section */}
          {foldersToRender.length > 0 && (
            <div>
              <h3 style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-secondary)", margin: "0 0 12px 0", textTransform: "uppercase", letterSpacing: "0.5px" }}>Folders</h3>
              <div className="folders-grid">
                {foldersToRender.map((folder) => {
                  const isFolderSelected = selectedFolderIds.has(folder.id);
                  const isOptimistic = (folder as any).isOptimistic;
                  const isDeleting = pendingDeleteIds.has(folder.id);
                  const isMoving = pendingMoveIds.has(folder.id);

                  let cardClasses = `folder-card ${isFolderSelected ? "selected" : ""}`;
                  if (isOptimistic) cardClasses += " optimistic-item animate-pulse-light animate-scale-in-item optimistic-glow";
                  if (isDeleting) cardClasses += " pending-delete animate-scale-out-item";
                  if (isMoving) cardClasses += " pending-move animate-pulse-light";

                  return (
                    <div 
                      key={folder.id} 
                      className={cardClasses}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (isOptimistic || isDeleting || isMoving) return;
                        navigateToFolder(folder);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isOptimistic || isDeleting || isMoving) return;
                        navigateToFolder(folder);
                      }}
                      onContextMenu={(e) => {
                        if (isOptimistic || isDeleting || isMoving) return;
                        handleContextMenu(e, folder, "folder");
                      }}
                      style={{ cursor: (isOptimistic || isDeleting || isMoving) ? "not-allowed" : "pointer" }}
                    >
                      <div className="folder-card-top">
                        {isOptimistic || isDeleting || isMoving ? (
                          <Loader2 size={28} className="animate-spin" style={{ color: isDeleting ? "var(--accent-red)" : "var(--accent-indigo)" }} />
                        ) : (
                          <Folder size={28} className="folder-icon" style={{ color: "var(--accent-indigo)" }} />
                        )}
                        {!isOptimistic && !isDeleting && !isMoving && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleFolderSelection(folder.id);
                            }}
                            className={`item-select-checkbox card-check ${isFolderSelected ? "selected" : ""}`}
                          >
                            {isFolderSelected ? (
                              <CheckSquare size={16} className="brand-accent" />
                            ) : (
                              <Square size={16} className="checkbox-unselected" />
                            )}
                          </button>
                        )}
                      </div>
                      <div className="folder-card-info">
                        <span className="folder-card-name" title={folder.name}>
                          {isDeleting ? `Deleting "${folder.name}"...` : isMoving ? `Moving "${folder.name}"...` : folder.name}
                        </span>
                        <span className="folder-card-meta">Directory</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Files Grid Section */}
          {assetsToRender.length > 0 && (
            <div>
              <h3 style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-secondary)", margin: "0 0 12px 0", textTransform: "uppercase", letterSpacing: "0.5px" }}>Files</h3>
              <div className="files-grid">
                {assetsToRender.map((asset) => {
                  const isAssetSelected = selectedAssetIds.has(asset.id);
                  const isOptimistic = (asset as any).isOptimistic;
                  const isDeleting = pendingDeleteIds.has(asset.id);
                  const isMoving = pendingMoveIds.has(asset.id);

                  let cardClasses = `file-card ${isAssetSelected ? "selected" : ""}`;
                  if (isOptimistic) cardClasses += " optimistic-item animate-pulse-light animate-scale-in-item optimistic-glow";
                  if (isDeleting) cardClasses += " pending-delete animate-scale-out-item";
                  if (isMoving) cardClasses += " pending-move animate-pulse-light";

                  return (
                    <div 
                      key={asset.id} 
                      className={cardClasses}
                      onContextMenu={(e) => {
                        if (isOptimistic || isDeleting || isMoving) return;
                        handleContextMenu(e, asset, "file");
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (isOptimistic || isDeleting || isMoving) return;
                        handleDownloadFile(asset.id);
                      }}
                      style={{ cursor: (isOptimistic || isDeleting || isMoving) ? "not-allowed" : "pointer" }}
                    >
                      <div className="file-card-preview">
                        {isOptimistic || isDeleting || isMoving ? (
                          <Loader2 size={36} className="animate-spin" style={{ color: isDeleting ? "var(--accent-red)" : "var(--accent-blue)" }} />
                        ) : (
                          <File size={36} style={{ color: "var(--accent-blue)" }} />
                        )}
                        {!isOptimistic && !isDeleting && !isMoving && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleAssetSelection(asset.id);
                            }}
                            className={`item-select-checkbox card-check ${isAssetSelected ? "selected" : ""}`}
                          >
                            {isAssetSelected ? (
                              <CheckSquare size={16} className="brand-accent" />
                            ) : (
                              <Square size={16} className="checkbox-unselected" />
                            )}
                          </button>
                        )}
                      </div>
                      <div className="file-card-info">
                        <span className="file-card-name" title={asset.filename}>
                          {isDeleting ? `Deleting "${asset.filename}"...` : isMoving ? `Moving "${asset.filename}"...` : asset.filename}
                        </span>
                        <span className="file-card-meta">{isOptimistic ? "Saving..." : formatBytes(asset.size)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* FLOATING SELECTION / BULK ACTIONS BAR */}
      {(selectedAssetIds.size > 0 || selectedFolderIds.size > 0) && (
        <div className="floating-bulk-bar animate-fade-in-up">
          <div className="bulk-bar-content">
            <div className="bulk-selection-count">
              <span className="count-badge">
                {selectedAssetIds.size + selectedFolderIds.size}
              </span>
              <span>item(s) selected</span>
            </div>

            <div style={{ height: "20px", width: "1px", backgroundColor: "rgba(255, 255, 255, 0.15)" }}></div>

            <div className="bulk-action-buttons">
              {explorerMode === "personal" && (
                <>
                  <button 
                    onClick={handleBulkMove}
                    className="bulk-action-btn"
                    title="Move Selected Items"
                  >
                    <FolderInput size={15} />
                    <span>Move</span>
                  </button>

                  <button 
                    onClick={handleBulkCopy}
                    className="bulk-action-btn"
                    title="Copy Selected Items"
                  >
                    <Copy size={15} />
                    <span>Copy</span>
                  </button>
                </>
              )}

              <button 
                onClick={handleBulkDelete}
                className="bulk-action-btn danger"
                title="Delete Selected Items"
              >
                <Trash2 size={15} />
                <span>Delete</span>
              </button>

              <div style={{ height: "20px", width: "1px", backgroundColor: "rgba(255, 255, 255, 0.15)" }}></div>

              <button 
                onClick={handleClearSelection}
                className="bulk-action-btn"
                title="Deselect Items"
                style={{ opacity: 0.8 }}
              >
                <X size={15} />
                <span>Deselect</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Files Select Ref Hooks */}
      <input 
        type="file" 
        ref={fileInputRef as any} 
        style={{ display: "none" }} 
        multiple 
        onChange={() => {}} // Hooked via parent in page.tsx onchange events
      />
      <input 
        type="file" 
        ref={folderInputRef as any} 
        style={{ display: "none" }} 
        webkitdirectory="true"
        directory=""
        multiple 
        onChange={() => {}} // Hooked via parent in page.tsx onchange events
        {...({ webkitdirectory: "", directory: "" } as any)}
      />
    </div>
  );
}
