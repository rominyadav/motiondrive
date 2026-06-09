"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { 
  createFolder, 
  deleteFolder,
  createProject, 
  listProjects, 
  listApprovedUsers,
  renameProject,
  deleteProject,
  listDriveContents, 
  getDownloadUrl, 
  deleteAsset,
  initiateMultipartUpload,
  getPresignedPartUrls,
  completeMultipartUpload,
  abortMultipartUpload,
  listSharedDriveContents,
  createSharedFolder,
  deleteSharedAsset,
  deleteSharedFolder,
  getSharedDownloadUrl,
  listArchiveDriveContents,
  getArchiveDownloadUrl,
  renameAsset,
  renameFolder,
  renameSharedAsset,
  renameSharedFolder,
  bulkDeleteItems,
  bulkMoveItems,
  bulkCopyItems,
  getUserStorageStats,
  getUserDetailedUsageStats
} from "@/app/actions/drive";
import { isNativeApp, pickFilesNative, uploadFileNative, isCapacitor } from "@/lib/native-bridge";
import {
  createSharedLink,
  listMySharedLinks,
  revokeSharedLink,
  extendSharedLink
} from "@/app/actions/share";
import { 
  Folder, 
  File, 
  UploadCloud, 
  Plus, 
  Trash2, 
  Download, 
  Search, 
  FolderPlus, 
  LayoutGrid, 
  List,
  ChevronRight, 
  LogOut, 
  Sliders, 
  Loader2,
  Share2,
  Archive,
  FolderOpen,
  Edit2,
  MoreVertical,
  Info,
  AlertTriangle,
  CheckCircle,
  Eye,
  Link as LinkIcon,
  ChevronDown,
  FileText,
  FolderUp,
  Upload,
  Table,
  Menu,
  X,
  CheckSquare,
  Square,
  FolderInput,
  Copy,
  Minus,
  Activity
} from "lucide-react";
import Link from "next/link";
import "./drive.css";

function DrivePageContent() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showDetailedUsageModal, setShowDetailedUsageModal] = useState(false);
  
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Helper to change URL params
  const setParams = (params: Record<string, string | null | undefined>) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    Object.entries(params).forEach(([key, value]) => {
      if (value === null || value === undefined) {
        nextParams.delete(key);
      } else {
        nextParams.set(key, value);
      }
    });
    router.push(`${pathname}?${nextParams.toString()}`);
  };

  // Derived states from searchParams
  const explorerMode = (searchParams.get("mode") as "personal" | "shared" | "archive" | "links") || "personal";
  const selectedProjectId = searchParams.get("projectId");
  const currentFolderId = searchParams.get("folderId");
  const rawPath = searchParams.get("path") || "";
  const sharedFolderPath = explorerMode === "shared" ? rawPath.split("/").filter(Boolean) : [];
  const archiveFolderPath = explorerMode === "archive" ? rawPath.split("/").filter(Boolean) : [];

  // FolderPath state (survives refreshes with sessionStorage)
  const [folderPathState, setFolderPathState] = useState<{ id: string | null; name: string }[]>([]);

  useEffect(() => {
    const cached = sessionStorage.getItem("motiondrive_folder_path");
    if (cached) {
      try {
        setFolderPathState(JSON.parse(cached));
      } catch (e) {
        setFolderPathState([{ id: null, name: "My Drive" }]);
      }
    } else {
      setFolderPathState([{ id: null, name: "My Drive" }]);
    }
  }, []);

  const setFolderPath = (path: { id: string | null; name: string }[]) => {
    setFolderPathState(path);
    sessionStorage.setItem("motiondrive_folder_path", JSON.stringify(path));
  };

  const folderPath = folderPathState;

  // TanStack Query for Projects
  const { data: projects = [], refetch: refetchProjects } = useQuery({
    queryKey: ["projects"],
    queryFn: listProjects,
    enabled: !!session,
  });

  // TanStack Query for Approved Users
  const { data: approvedUsers = [] } = useQuery({
    queryKey: ["approvedUsers"],
    queryFn: listApprovedUsers,
    enabled: !!session,
  });

  // TanStack Query for Storage Stats
  const { data: storageStats = null, refetch: fetchStorageStats } = useQuery({
    queryKey: ["storageStats"],
    queryFn: getUserStorageStats,
    enabled: !!session,
  });

  // TanStack Query for Detailed Storage Analytics (only loaded when modal is shown)
  const { data: detailedUsageStats = null, isLoading: detailedUsageLoading, refetch: refetchDetailedUsageStats } = useQuery({
    queryKey: ["detailedUsageStats"],
    queryFn: getUserDetailedUsageStats,
    enabled: !!session && showDetailedUsageModal,
  });

  // TanStack Query for Shared Links Management
  const { data: sharedLinksList = [], isLoading: sharedLinksLoading, refetch: refetchSharedLinks } = useQuery({
    queryKey: ["sharedLinks"],
    queryFn: listMySharedLinks,
    enabled: !!session && explorerMode === "links",
  });

  // TanStack Query for Drive contents
  const { data: driveData = { folders: [], assets: [] }, isLoading: contentsLoading } = useQuery({
    queryKey: ["driveContents", explorerMode, selectedProjectId, currentFolderId, rawPath],
    queryFn: async () => {
      if (explorerMode === "shared") {
        const prefix = sharedFolderPath.length > 0 ? sharedFolderPath.join("/") + "/" : "";
        return await listSharedDriveContents(prefix);
      } else if (explorerMode === "archive") {
        const prefix = archiveFolderPath.length > 0 ? archiveFolderPath.join("/") + "/" : "";
        return await listArchiveDriveContents(prefix);
      } else {
        return await listDriveContents({
          projectId: selectedProjectId,
          folderId: currentFolderId
        });
      }
    },
    enabled: !!session && explorerMode !== "links",
  });

  const folders = driveData.folders;
  const assets = driveData.assets;

  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "icons">("table");

  const filteredFolders = folders.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAssets = assets.filter((a) =>
    a.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Modals state
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectClient, setNewProjectClient] = useState("");
  const [shareWithAll, setShareWithAll] = useState(true);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [editShareWithAll, setEditShareWithAll] = useState(true);
  const [editSelectedUserIds, setEditSelectedUserIds] = useState<string[]>([]);

  // Upload Drawer State
  const [uploadProgress, setUploadProgress] = useState<{ [filename: string]: number }>({});
  const [uploadErrors, setUploadErrors] = useState<{ [filename: string]: string }>({});
  const [uploadActive, setUploadActive] = useState(false);
  const [uploadMinimized, setUploadMinimized] = useState(false);

  const [downloadProgress, setDownloadProgress] = useState<{
    [filename: string]: {
      progress: number;
      bytesDownloaded: number;
      totalBytes: number;
      isCancelled: boolean;
      isFailed: boolean;
      controller: AbortController;
    }
  }>({});
  const [downloadActive, setDownloadActive] = useState(false);
  const [transferMetrics, setTransferMetrics] = useState<{
    [filename: string]: { speedText: string; etaText: string }
  }>({});

  // Upload Abort Tracking
  const uploadDetailsRef = useRef<{
    [filename: string]: {
      uploadId: string;
      r2Key: string;
      assetId: string;
      isShared: boolean;
      controller: AbortController;
      filePath?: string;
    };
  }>({});

  // Right-Click Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    item: any;
    type: "file" | "folder";
  } | null>(null);

  // Rename Dialog State
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ item: any; type: "file" | "folder" } | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Get Info Modal State
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [infoTarget, setInfoTarget] = useState<{ item: any; type: "file" | "folder" } | null>(null);

  // File Preview Modal State
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewTarget, setPreviewTarget] = useState<any | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewTextContent, setPreviewTextContent] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  // Toast / Notification State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"info" | "success" | "error">("info");

  // Mobile Sidebar & Collapsibility State
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Project Rename & Delete State
  const [renameProjectModalOpen, setRenameProjectModalOpen] = useState(false);
  const [selectedProjectToEdit, setSelectedProjectToEdit] = useState<any | null>(null);
  const [editProjectName, setEditProjectName] = useState("");
  const [editProjectClient, setEditProjectClient] = useState("");

  const [deleteProjectModalOpen, setDeleteProjectModalOpen] = useState(false);
  const [selectedProjectToDelete, setSelectedProjectToDelete] = useState<any | null>(null);

  // Project Section Collapsible & Show More States
  const [yourProjsExpanded, setYourProjsExpanded] = useState(true);
  const [sharedProjsExpanded, setSharedProjsExpanded] = useState(false);
  const [archiveProjsExpanded, setArchiveProjsExpanded] = useState(false);

  const [yourProjsLimit, setYourProjsLimit] = useState(5);
  const [sharedProjsLimit, setSharedProjsLimit] = useState(5);
  const [archiveProjsLimit, setArchiveProjsLimit] = useState(5);

  // Unified Custom Confirm Modal State
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    warning?: string;
    confirmText?: string;
    confirmColor?: string;
    onConfirm: () => void;
  } | null>(null);

  // Bulk Selection States
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set());

  // Destination Folder Picker Modal State
  const [destinationPickerOpen, setDestinationPickerOpen] = useState(false);
  const [pickerAction, setPickerAction] = useState<"move" | "copy" | null>(null);
  const [pickerDriveMode, setPickerDriveMode] = useState<"personal" | "shared">("personal");
  const [pickerCurrentFolderId, setPickerCurrentFolderId] = useState<string | null>(null); // UUID (personal) or Prefix Path (shared)
  const [pickerFolderPath, setPickerFolderPath] = useState<{ id: string | null; name: string }[]>([]);
  const [pickerFolders, setPickerFolders] = useState<any[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);

  // New Dropdown State
  const [newDropdownOpen, setNewDropdownOpen] = useState(false);
  const newDropdownRef = useRef<HTMLDivElement>(null);

  // Project Header Actions State
  const [projectHeaderMenuOpen, setProjectHeaderMenuOpen] = useState(false);
  const projectHeaderRef = useRef<HTMLDivElement>(null);

  // Text File Editor State
  const [textModalOpen, setTextModalOpen] = useState(false);
  const [textFileName, setTextFileName] = useState("");
  const [textContent, setTextContent] = useState("");
  const [textEditorMode, setTextEditorMode] = useState<"create" | "edit">("create");
  const [textEditorAsset, setTextEditorAsset] = useState<any | null>(null);

  // Docs Editor State (Quill)
  const [docsModalOpen, setDocsModalOpen] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docsEditorMode, setDocsEditorMode] = useState<"create" | "edit">("create");
  const [docsEditorAsset, setDocsEditorAsset] = useState<any | null>(null);

  // Offline Caching & Preferences Synchronization for Capacitor
  useEffect(() => {
    if (!isCapacitor()) return;
    async function loadCachedData() {
      try {
        const { Preferences } = await import("@capacitor/preferences");
        
        // 1. Session Cache
        const cachedSession = await Preferences.get({ key: "cached_session" });
        if (cachedSession.value) {
          try {
            setSession(JSON.parse(cachedSession.value));
            setLoading(false);
          } catch (e) {}
        }
        
        // 2. Storage Stats Cache
        const cachedStorage = await Preferences.get({ key: "cached_storage_stats" });
        if (cachedStorage.value) {
          try {
            queryClient.setQueryData(["storageStats"], JSON.parse(cachedStorage.value));
          } catch (e) {}
        }
        
        // 3. Projects Cache
        const cachedProjects = await Preferences.get({ key: "cached_projects" });
        if (cachedProjects.value) {
          try {
            queryClient.setQueryData(["projects"], JSON.parse(cachedProjects.value));
          } catch (e) {}
        }
        
        // 4. Drive Contents Cache
        const cachedContentsKey = `cached_drive_contents_${explorerMode}_${selectedProjectId || "null"}_${currentFolderId || "null"}_${rawPath || "null"}`;
        const cachedContents = await Preferences.get({ key: cachedContentsKey });
        if (cachedContents.value) {
          try {
            queryClient.setQueryData(["driveContents", explorerMode, selectedProjectId, currentFolderId, rawPath], JSON.parse(cachedContents.value));
          } catch (e) {}
        }
      } catch (err) {
        console.error("Failed to load offline cache:", err);
      }
    }
    loadCachedData();
  }, [queryClient, explorerMode, selectedProjectId, currentFolderId, rawPath]);

  // Synchronize Session Cache
  useEffect(() => {
    if (!isCapacitor() || !session) return;
    async function cacheSession() {
      try {
        const { Preferences } = await import("@capacitor/preferences");
        await Preferences.set({ key: "cached_session", value: JSON.stringify(session) });
      } catch (e) {}
    }
    cacheSession();
  }, [session]);

  // Synchronize Drive Contents Cache
  useEffect(() => {
    if (!isCapacitor() || !driveData || (driveData.folders.length === 0 && driveData.assets.length === 0)) return;
    async function cacheDriveContents() {
      try {
        const { Preferences } = await import("@capacitor/preferences");
        const cachedContentsKey = `cached_drive_contents_${explorerMode}_${selectedProjectId || "null"}_${currentFolderId || "null"}_${rawPath || "null"}`;
        await Preferences.set({ key: cachedContentsKey, value: JSON.stringify(driveData) });
      } catch (e) {}
    }
    cacheDriveContents();
  }, [driveData, explorerMode, selectedProjectId, currentFolderId, rawPath]);

  // Synchronize Projects Cache
  useEffect(() => {
    if (!isCapacitor() || !projects || projects.length === 0) return;
    async function cacheProjects() {
      try {
        const { Preferences } = await import("@capacitor/preferences");
        await Preferences.set({ key: "cached_projects", value: JSON.stringify(projects) });
      } catch (e) {}
    }
    cacheProjects();
  }, [projects]);

  // Synchronize Storage Stats Cache
  useEffect(() => {
    if (!isCapacitor() || !storageStats) return;
    async function cacheStorageStats() {
      try {
        const { Preferences } = await import("@capacitor/preferences");
        await Preferences.set({ key: "cached_storage_stats", value: JSON.stringify(storageStats) });
      } catch (e) {}
    }
    cacheStorageStats();
  }, [storageStats]);

  // Blank Sheet Editor State
  const [sheetModalOpen, setSheetModalOpen] = useState(false);
  const [sheetName, setSheetName] = useState("");
  const [sheetCells, setSheetCells] = useState<{ [key: string]: string }>({});
  const [sheetEditorMode, setSheetEditorMode] = useState<"create" | "edit">("create");
  const [sheetEditorAsset, setSheetEditorAsset] = useState<any | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Helper to render individual project item in sidebar
  const renderProjectItem = (proj: any) => {
    const isActive = explorerMode === "personal" && selectedProjectId === proj.id;
    return (
      <div 
        key={proj.id}
        className={`project-sidebar-item ${isActive ? "active" : ""}`}
        onClick={() => {
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
          cursor: "pointer",
          transition: "all 0.2s ease"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flexGrow: 1 }}>
          <Folder size={14} style={{ flexShrink: 0, opacity: 0.7 }} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{proj.name}</span>
        </div>
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
          {isAdmin && (
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

  // Auto-close context menu on window clicks
  useEffect(() => {
    const handleCloseMenu = () => setContextMenu(null);
    window.addEventListener("click", handleCloseMenu);
    window.addEventListener("contextmenu", handleCloseMenu);
    return () => {
      window.removeEventListener("click", handleCloseMenu);
      window.removeEventListener("contextmenu", handleCloseMenu);
    };
  }, []);

  // Sync viewMode from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("motiondrive_view_mode");
    if (saved === "icons" || saved === "table") {
      setViewMode(saved);
    }
  }, []);

  // Global accessibility keydown handlers (ESC to close, Enter to confirm)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESCAPE key to dismiss any active modals/dialogs
      if (e.key === "Escape") {
        setFolderModalOpen(false);
        setShowDetailedUsageModal(false);
        setProjectModalOpen(false);
        setRenameProjectModalOpen(false);
        setDeleteProjectModalOpen(false);
        setConfirmModal(null);
      }

      // ENTER key to confirm actions in delete/confirm modal prompts
      if (e.key === "Enter") {
        const activeEl = document.activeElement;
        const isTyping = activeEl && (
          activeEl.tagName === "INPUT" || 
          activeEl.tagName === "TEXTAREA" || 
          activeEl.getAttribute("contenteditable") === "true"
        );

        if (!isTyping) {
          if (confirmModal && confirmModal.open) {
            e.preventDefault();
            confirmModal.onConfirm();
            setConfirmModal(null);
          } else if (deleteProjectModalOpen && selectedProjectToDelete) {
            e.preventDefault();
            handleDeleteProject();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [confirmModal, deleteProjectModalOpen, selectedProjectToDelete]);

  const changeViewMode = (mode: "table" | "icons") => {
    setViewMode(mode);
    localStorage.setItem("motiondrive_view_mode", mode);
  };

  // Toast message auto-dismiss
  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  // Click outside "+ New" dropdown to dismiss it
  useEffect(() => {
    const handleCloseNewDropdown = (e: MouseEvent) => {
      if (newDropdownRef.current && !newDropdownRef.current.contains(e.target as Node)) {
        setNewDropdownOpen(false);
      }
    };
    window.addEventListener("mousedown", handleCloseNewDropdown);
    return () => window.removeEventListener("mousedown", handleCloseNewDropdown);
  }, []);

  // Click outside Project Header Actions dropdown to dismiss it
  useEffect(() => {
    const handleCloseProjectHeaderMenu = (e: MouseEvent) => {
      if (projectHeaderRef.current && !projectHeaderRef.current.contains(e.target as Node)) {
        setProjectHeaderMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", handleCloseProjectHeaderMenu);
    return () => window.removeEventListener("mousedown", handleCloseProjectHeaderMenu);
  }, []);

  // Dynamically inject Quill 2.0 CDN script and stylesheet
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ((window as any).Quill) return;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.snow.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.js";
    script.async = true;
    script.onload = () => {
      console.log("Quill 2.0 CDN successfully injected!");
    };
    document.head.appendChild(script);
  }, []);

  const editorContainerRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<any>(null);

  // Initialize Quill editor instance on Docs Modal opening
  useEffect(() => {
    if (!docsModalOpen || !editorContainerRef.current) return;
    
    editorContainerRef.current.innerHTML = "";
    const editorDiv = document.createElement("div");
    editorContainerRef.current.appendChild(editorDiv);

    const checkAndInitQuill = setInterval(() => {
      if ((window as any).Quill) {
        clearInterval(checkAndInitQuill);
        quillRef.current = new (window as any).Quill(editorDiv, {
          theme: "snow",
          modules: {
            toolbar: [
              [{ header: [1, 2, 3, false] }],
              ["bold", "italic", "underline", "strike"],
              [{ list: "ordered" }, { list: "bullet" }],
              ["code-block", "blockquote"],
              [{ color: [] }, { background: [] }],
              ["clean"]
            ]
          }
        });

        if (docsEditorMode === "create") {
          quillRef.current.root.innerHTML = "";
        }
      }
    }, 50);

    return () => {
      clearInterval(checkAndInitQuill);
      quillRef.current = null;
    };
  }, [docsModalOpen, docsEditorMode]);

  const showToast = (msg: string, type: "info" | "success" | "error" = "info") => {
    setToastMessage(msg);
    setToastType(type);
  };

  // Context Menu Trigger
  const handleContextMenu = (e: React.MouseEvent, item: any, type: "file" | "folder") => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.pageX,
      y: e.pageY,
      item,
      type
    });
  };

  // Copy Secure Proxy Link to Clipboard
  const handleCopyLink = async (asset: any) => {
    try {
      const isShared = explorerMode === "shared";
      const isArchive = explorerMode === "archive";

      const params = {
        assetId: (!isShared && !isArchive) ? asset.id : null,
        physicalKey: (isShared || isArchive) ? asset.id : null,
        physicalBucket: isShared ? "shared" : isArchive ? "archive" : null,
        filename: asset.filename,
      };

      const result = await createSharedLink(params);
      if (result.success && result.shareUrl) {
        await navigator.clipboard.writeText(result.shareUrl);
        showToast("Secure sharing link copied! (Expires in 24h)", "success");
        queryClient.invalidateQueries({ queryKey: ["sharedLinks"] });
      } else {
        throw new Error("Failed to generate proxy share url");
      }
    } catch (err) {
      showToast("Failed to generate proxy sharing link", "error");
    }
  };

  // Copy Secure Proxy Folder Link to Clipboard
  const handleCopyFolderLink = async (folder: any) => {
    try {
      const isShared = explorerMode === "shared";
      const isArchive = explorerMode === "archive";

      const params = {
        folderId: (!isShared && !isArchive) ? folder.id : null,
        physicalPrefix: (isShared || isArchive) ? folder.id : null,
        physicalBucket: isShared ? "shared" : isArchive ? "archive" : null,
        filename: folder.name,
      };

      const result = await createSharedLink(params);
      if (result.success && result.shareUrl) {
        await navigator.clipboard.writeText(result.shareUrl);
        showToast("Secure folder sharing link copied! (Expires in 24h)", "success");
        queryClient.invalidateQueries({ queryKey: ["sharedLinks"] });
      } else {
        throw new Error("Failed to generate proxy share url");
      }
    } catch (err) {
      showToast("Failed to generate proxy sharing link", "error");
    }
  };

  // Open Preview Modal
  const handleOpenPreview = async (asset: any) => {
    setPreviewTarget(asset);
    setPreviewLoading(true);
    setPreviewModalOpen(true);
    setPreviewTextContent("");
    setPreviewUrl("");

    try {
      const { downloadUrl } = explorerMode === "shared"
        ? await getSharedDownloadUrl(asset.id)
        : explorerMode === "archive"
        ? await getArchiveDownloadUrl(asset.id)
        : await getDownloadUrl(asset.id);

      setPreviewUrl(downloadUrl);

      // Check if it's a text file to load contents
      const ext = asset.filename.split(".").pop()?.toLowerCase() || "";
      const isText = ["txt", "md", "json", "js", "ts", "css", "html", "csv", "xml", "yaml", "yml"].includes(ext);

      if (isText) {
        const response = await fetch(downloadUrl);
        if (response.ok) {
          const text = await response.text();
          setPreviewTextContent(text);
        } else {
          setPreviewTextContent("Failed to load text preview content.");
        }
      }
    } catch (err) {
      console.error("Preview failed", err);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Initialize Rename Modal
  const handleOpenRename = (item: any, type: "file" | "folder") => {
    setRenameTarget({ item, type });
    const initialName = type === "file" 
      ? item.filename 
      : item.name;
    setRenameValue(initialName);
    setRenameModalOpen(true);
  };

  // Rename Submission Handler
  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget || !renameValue.trim()) return;

    const { item, type } = renameTarget;
    const nameInput = renameValue.trim();

    try {
      if (explorerMode === "shared") {
        if (type === "file") {
          // Calculate new physical R2 key
          const parts = item.id.split("/");
          parts[parts.length - 1] = nameInput;
          const newKey = parts.join("/");

          await renameSharedAsset(item.id, newKey);
          showToast(`File renamed to ${nameInput}`, "success");
        } else {
          // Folder: renameTarget item.id is prefix e.g. "Wedding/" or "test/sub/"
          const oldPrefix = item.id;
          
          // To compute the new prefix, find the parent path
          const parts = oldPrefix.split("/").filter(Boolean);
          parts[parts.length - 1] = nameInput;
          const newPrefix = parts.join("/") + "/";

          await renameSharedFolder(oldPrefix, newPrefix);
          showToast(`Folder renamed to ${nameInput}`, "success");
        }
      } else {
        if (type === "file") {
          await renameAsset(item.id, nameInput);
          showToast(`File renamed to ${nameInput}`, "success");
        } else {
          await renameFolder(item.id, nameInput);
          showToast(`Folder renamed to ${nameInput}`, "success");
        }
      }
      await refreshExplorerContents();
    } catch (err) {
      showToast("Failed to rename target", "error");
      console.error(err);
    } finally {
      setRenameModalOpen(false);
      setRenameTarget(null);
    }
  };

  // Open Get Info
  const handleOpenInfo = (item: any, type: "file" | "folder") => {
    setInfoTarget({ item, type });
    setInfoModalOpen(true);
  };

  // Load user session and gatekeep access
  useEffect(() => {
    async function checkAuth() {
      const { data: sessionData } = await authClient.getSession();
      
      if (!sessionData) {
        router.push("/login");
        return;
      }

      const user = sessionData.user as any;
      if (user.status === "pending") {
        router.push("/awaiting-approval");
        return;
      }

      setSession(sessionData);
      setLoading(false);
    }
    checkAuth();
  }, [router]);

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      if (explorerMode === "shared") {
        const prefix = sharedFolderPath.length > 0 ? sharedFolderPath.join("/") + "/" : "";
        await createSharedFolder(prefix, newFolderName.trim());
      } else {
        await createFolder(newFolderName.trim(), selectedProjectId || undefined, currentFolderId);
      }
      setNewFolderName("");
      setFolderModalOpen(false);
      await refreshExplorerContents();
      showToast("Folder created successfully!", "success");
    } catch (err) {
      showToast("Failed to create folder", "error");
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    try {
      const sharedValue = shareWithAll ? "all" : selectedUserIds.join(",");
      await createProject(newProjectName.trim(), newProjectClient.trim() || undefined, sharedValue);
      setNewProjectName("");
      setNewProjectClient("");
      setShareWithAll(true);
      setSelectedUserIds([]);
      setProjectModalOpen(false);

      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      showToast("Project created successfully!", "success");
    } catch (err) {
      showToast("Failed to create project", "error");
    }
  };

  const handleRenameProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectToEdit || !editProjectName.trim()) return;

    try {
      const sharedValue = editShareWithAll ? "all" : editSelectedUserIds.join(",");
      await renameProject(selectedProjectToEdit.id, editProjectName.trim(), editProjectClient.trim() || undefined, sharedValue);
      setRenameProjectModalOpen(false);
      setSelectedProjectToEdit(null);
      setEditProjectName("");
      setEditProjectClient("");
      setEditShareWithAll(true);
      setEditSelectedUserIds([]);

      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      showToast("Project updated successfully!", "success");
    } catch (err) {
      showToast("Failed to update project", "error");
    }
  };

  const handleDeleteProject = async () => {
    if (!selectedProjectToDelete) return;

    try {
      await deleteProject(selectedProjectToDelete.id);
      setDeleteProjectModalOpen(false);
      
      // If the deleted project was the currently selected one, fall back to "My Drive"
      if (selectedProjectId === selectedProjectToDelete.id) {
        selectProject(null, "My Drive");
      }
      setSelectedProjectToDelete(null);

      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      showToast("Project deleted successfully!", "success");
    } catch (err) {
      showToast("Failed to delete project", "error");
    }
  };

  // Click on Folder
  const navigateToFolder = (folder: { id: string; name: string; isR2Physical?: boolean }) => {
    if (folder.isR2Physical) {
      const parts = folder.id.split("/").filter(Boolean);
      setParams({ path: parts.join("/") });
    } else {
      setParams({ folderId: folder.id });
      setFolderPath([...folderPath, { id: folder.id, name: folder.name }]);
    }
  };

  // Click on Project (forces Personal mode)
  const selectProject = (projectId: string | null, projectName: string) => {
    setParams({
      mode: "personal",
      projectId: projectId,
      folderId: null,
      path: null,
    });
    if (projectId === null) {
      setFolderPath([{ id: null, name: "My Drive" }]);
    } else {
      setFolderPath([
        { id: null, name: "My Drive" },
        { id: `project-${projectId}`, name: projectName }
      ]);
    }
  };

  // Switch to Shared Drive mode
  const selectSharedDrive = () => {
    setParams({
      mode: "shared",
      projectId: null,
      folderId: null,
      path: null,
    });
  };

  // Click Breadcrumb
  const handleBreadcrumbClick = (index: number) => {
    const item = folderPath[index];
    if (index === 0) {
      setParams({
        projectId: null,
        folderId: null,
      });
      setFolderPath([{ id: null, name: "My Drive" }]);
    } else if (item.id && item.id.startsWith("project-")) {
      const pId = item.id.replace("project-", "");
      setParams({
        projectId: pId,
        folderId: null,
      });
      setFolderPath(folderPath.slice(0, index + 1));
    } else {
      setParams({
        folderId: item.id,
      });
      setFolderPath(folderPath.slice(0, index + 1));
    }
  };

  const handleBreadcrumbClickShared = (path: string[]) => {
    setParams({ path: path.join("/") || null });
  };

  // Switch to Archive Drive mode
  const selectArchiveDrive = () => {
    setParams({
      mode: "archive",
      projectId: null,
      folderId: null,
      path: null,
    });
  };

  const handleBreadcrumbClickArchive = (path: string[]) => {
    setParams({ path: path.join("/") || null });
  };

  const handleCancelDownload = (filename: string) => {
    const item = downloadProgress[filename];
    if (item && item.controller) {
      item.controller.abort();
      setDownloadProgress(prev => {
        if (!prev[filename]) return prev;
        return {
          ...prev,
          [filename]: {
            ...prev[filename],
            isCancelled: true,
            progress: -1,
          }
        };
      });
    }
  };

  // Download File via Presigned URL (supporting high-performance native streaming inside Tauri)
  const handleDownloadFile = async (assetId: string) => {
    try {
      const { downloadUrl, filename } = explorerMode === "shared"
        ? await getSharedDownloadUrl(assetId)
        : explorerMode === "archive"
        ? await getArchiveDownloadUrl(assetId)
        : await getDownloadUrl(assetId);

      const { isTauri, isCapacitor, downloadFileNative } = await import("@/lib/native-bridge");

      if (isTauri() || isCapacitor()) {
        const controller = new AbortController();

        setDownloadProgress(prev => ({
          ...prev,
          [filename]: {
            progress: 0,
            bytesDownloaded: 0,
            totalBytes: 0,
            isCancelled: false,
            isFailed: false,
            controller,
          }
        }));
        setDownloadActive(true);
        setUploadMinimized(false); // Open drawer so user sees active download

        const startTime = Date.now();

        try {
          const result = await downloadFileNative({
            url: downloadUrl,
            filename,
            onProgress: (bytesDownloaded, totalBytes) => {
              const percent = totalBytes > 0 ? Math.round((bytesDownloaded / totalBytes) * 100) : 0;
              
              // Calculate Speed & ETA
              const elapsedMs = Date.now() - startTime;
              const speed = elapsedMs > 0 ? (bytesDownloaded / elapsedMs) * 1000 : 0;
              const remainingBytes = totalBytes - bytesDownloaded;
              const etaSeconds = speed > 0 ? remainingBytes / speed : Infinity;

              const speedText = speed > 0 ? `${(speed / (1024 * 1024)).toFixed(2)} MB/s` : "0 B/s";
              const etaText = etaSeconds === Infinity ? "Estimating..." : etaSeconds < 60 ? `${Math.round(etaSeconds)}s` : `${Math.floor(etaSeconds / 60)}m ${Math.round(etaSeconds % 60)}s`;

              setTransferMetrics(prev => ({
                ...prev,
                [filename]: { speedText, etaText }
              }));

              setDownloadProgress(prev => {
                if (!prev[filename]) return prev;
                return {
                  ...prev,
                  [filename]: {
                    ...prev[filename],
                    progress: percent,
                    bytesDownloaded,
                    totalBytes,
                  }
                };
              });
            },
            signal: controller.signal,
          });

          if (result) {
            // Completed successfully
            setDownloadProgress(prev => {
              if (!prev[filename]) return prev;
              return {
                ...prev,
                [filename]: {
                  ...prev[filename],
                  progress: 100,
                  bytesDownloaded: prev[filename].totalBytes,
                }
              };
            });
            showToast(`Downloaded ${filename} successfully!`, "success");
          } else {
            // User cancelled save dialog, remove from progress panel cleanly
            setDownloadProgress(prev => {
              const updated = { ...prev };
              delete updated[filename];
              return updated;
            });
          }
        } catch (err: any) {
          const isCancelled = err?.name === "AbortError";
          setDownloadProgress(prev => {
            if (!prev[filename]) return prev;
            return {
              ...prev,
              [filename]: {
                ...prev[filename],
                isCancelled,
                isFailed: !isCancelled,
                progress: isCancelled ? -1 : -2,
              }
            };
          });
          if (!isCancelled) {
            showToast(`Failed to download ${filename}`, "error");
          }
        }
      } else {
        // Standard browser/web fallback download
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err) {
      showToast("Failed to download file", "error");
    }
  };

  // Delete File
  // Delete File
  const handleDeleteFile = async (assetId: string) => {
    const targetBucketText = explorerMode === "shared" ? "shared Cloudflare R2 bucket (video-assets)" : "Web Drive and Cloudflare R2";
    const fileObj = driveData?.assets?.find((a: any) => a.id === assetId);
    const resolvedFilename = fileObj?.filename || "File";
    
    setConfirmModal({
      open: true,
      title: "Delete File?",
      message: `Are you sure you want to delete this file from the ${targetBucketText}?`,
      warning: "This action cannot be undone.",
      confirmText: "Delete Permanently",
      confirmColor: "var(--accent-destructive)",
      onConfirm: async () => {
        const taskLabel = `Deleting ${resolvedFilename}`;
        
        // Show operation as in-progress in progress drawer
        setUploadActive(true);
        setUploadMinimized(false);
        setUploadProgress(prev => ({
          ...prev,
          [taskLabel]: 0
        }));

        // Fire and forget asynchronously
        (async () => {
          try {
            if (explorerMode === "shared") {
              await deleteSharedAsset(assetId);
            } else {
              await deleteAsset(assetId);
            }
            
            // Mark completed in drawer
            setUploadProgress(prev => ({
              ...prev,
              [taskLabel]: 100
            }));
            await refreshExplorerContents();
            showToast("File deleted successfully!", "success");
          } catch (err) {
            // Mark failed in drawer
            setUploadProgress(prev => ({
              ...prev,
              [taskLabel]: -2
            }));
            showToast("Failed to delete file", "error");
          }
        })();
      }
    });
  };

  // Delete Folder
  const handleDeleteFolder = async (folderId: string, folderName?: string) => {
    const folderObj = driveData?.folders?.find((f: any) => f.id === folderId);
    const resolvedFolderName = folderName || folderObj?.name || "Folder";

    setConfirmModal({
      open: true,
      title: "Delete Folder?",
      message: `Are you sure you want to delete folder "${resolvedFolderName}"?`,
      warning: "All nested files and subfolders will be permanently deleted from the Web Drive and Cloudflare R2.",
      confirmText: "Delete Folder Permanently",
      confirmColor: "var(--accent-destructive)",
      onConfirm: async () => {
        const taskLabel = `Deleting folder "${resolvedFolderName}"`;
        
        // Show operation as in-progress in progress drawer
        setUploadActive(true);
        setUploadMinimized(false);
        setUploadProgress(prev => ({
          ...prev,
          [taskLabel]: 0
        }));

        // Fire and forget asynchronously
        (async () => {
          try {
            if (explorerMode === "shared") {
              await deleteSharedFolder(folderId);
            } else {
              await deleteFolder(folderId);
            }
            
            // Mark completed in drawer
            setUploadProgress(prev => ({
              ...prev,
              [taskLabel]: 100
            }));
            await refreshExplorerContents();
            showToast("Folder deleted successfully!", "success");
          } catch (err) {
            // Mark failed in drawer
            setUploadProgress(prev => ({
              ...prev,
              [taskLabel]: -2
            }));
            showToast("Failed to delete folder", "error");
          }
        })();
      }
    });
  };

  // ==========================================
  // BULK SELECTION & OPERATIONS HANDLERS
  // ==========================================

  // Toggle selection for an Asset
  const handleToggleAssetSelection = (assetId: string) => {
    setSelectedAssetIds(prev => {
      const next = new Set(prev);
      if (next.has(assetId)) {
        next.delete(assetId);
      } else {
        next.add(assetId);
      }
      return next;
    });
  };

  // Toggle selection for a Folder
  const handleToggleFolderSelection = (folderId: string) => {
    setSelectedFolderIds(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  // Clear Selection
  const handleClearSelection = () => {
    setSelectedAssetIds(new Set());
    setSelectedFolderIds(new Set());
  };

  // Check if all viewed items are selected
  const isAllSelected = () => {
    if (filteredFolders.length === 0 && filteredAssets.length === 0) return false;
    const allFoldersSelected = filteredFolders.every(f => selectedFolderIds.has(f.id));
    const allAssetsSelected = filteredAssets.every(a => selectedAssetIds.has(a.id));
    return allFoldersSelected && allAssetsSelected;
  };

  // Handle "Select All" toggle
  const handleSelectAll = () => {
    if (isAllSelected()) {
      // Deselect all
      setSelectedFolderIds(prev => {
        const next = new Set(prev);
        filteredFolders.forEach(f => next.delete(f.id));
        return next;
      });
      setSelectedAssetIds(prev => {
        const next = new Set(prev);
        filteredAssets.forEach(a => next.delete(a.id));
        return next;
      });
    } else {
      // Select all in current view
      setSelectedFolderIds(prev => {
        const next = new Set(prev);
        filteredFolders.forEach(f => next.add(f.id));
        return next;
      });
      setSelectedAssetIds(prev => {
        const next = new Set(prev);
        filteredAssets.forEach(a => next.add(a.id));
        return next;
      });
    }
  };

  // Execute bulk deletion
  const handleBulkDelete = async () => {
    const totalCount = selectedAssetIds.size + selectedFolderIds.size;
    if (totalCount === 0) return;

    setConfirmModal({
      open: true,
      title: "Delete Selected Items?",
      message: `Are you sure you want to permanently delete the ${totalCount} selected item(s) from the Web Drive and Cloudflare R2?`,
      warning: "This action cannot be undone.",
      confirmText: `Delete ${totalCount} Item(s)`,
      confirmColor: "var(--accent-destructive)",
      onConfirm: async () => {
        const taskLabel = `Deleting ${totalCount} selected item(s)`;
        const assetIdsToDelete = Array.from(selectedAssetIds);
        const folderIdsToDelete = Array.from(selectedFolderIds);
        const isShared = explorerMode === "shared";

        // Show operation as in-progress in progress drawer
        setUploadActive(true);
        setUploadMinimized(false);
        setUploadProgress(prev => ({
          ...prev,
          [taskLabel]: 0
        }));

        // Clear selection immediately so user can continue using the drive
        handleClearSelection();

        // Run asynchronously in background without blocking UI
        (async () => {
          try {
            await bulkDeleteItems({
              assetIds: assetIdsToDelete,
              folderIds: folderIdsToDelete,
              isSharedDrive: isShared
            });

            // Mark completed in drawer
            setUploadProgress(prev => ({
              ...prev,
              [taskLabel]: 100
            }));
            await refreshExplorerContents();
            showToast("Selected items deleted successfully!", "success");
          } catch (err) {
            console.error("Bulk delete failed", err);
            // Mark failed in drawer
            setUploadProgress(prev => ({
              ...prev,
              [taskLabel]: -2
            }));
            showToast("Failed to delete selected items", "error");
          }
        })();
      }
    });
  };

  // Load folders for destination picker
  const handleLoadPickerDirectories = async (
    folderId: string | null, 
    projectId: string | null, 
    targetDriveMode?: "personal" | "shared"
  ) => {
    setPickerLoading(true);
    try {
      const mode = targetDriveMode || pickerDriveMode;
      const isShared = mode === "shared";
      if (isShared) {
        // Shared Drive: List physical folders under target prefix (folderId is the prefix path string)
        const prefix = folderId || "";
        const { folders: loaded } = await listSharedDriveContents(prefix);
        setPickerFolders(loaded);
      } else {
        // Personal Drive: List virtual DB folders
        if (folderId === null && projectId === null) {
          const projs = await listProjects();
          // Map projects to look like folders
          const mapped = projs.map(p => ({
            id: `PROJECT:${p.id}`,
            name: p.name,
            projectId: p.id,
            isProject: true
          }));
          setPickerFolders(mapped);
        } else {
          const { folders: loaded } = await listDriveContents({
            projectId: projectId,
            folderId: folderId
          });
          setPickerFolders(loaded);
        }
      }
    } catch (err) {
      console.error("Failed to load directories for picker", err);
    } finally {
      setPickerLoading(false);
    }
  };

  // Open Destination Picker Modal
  const handleOpenDestinationPicker = async (action: "move" | "copy") => {
    if (explorerMode === "archive" || explorerMode === "links") return;
    setPickerAction(action);
    const targetMode = explorerMode === "shared" ? "shared" : "personal";
    setPickerDriveMode(targetMode);
    setPickerCurrentFolderId(null);
    setPickerFolderPath([]);
    setDestinationPickerOpen(true);
    await handleLoadPickerDirectories(null, null, targetMode);
  };

  // Toggle Drive Mode Inside Destination Picker
  const handleTogglePickerDriveMode = async (mode: "personal" | "shared") => {
    if (pickerDriveMode === mode) return;
    setPickerDriveMode(mode);
    setPickerCurrentFolderId(null);
    setPickerFolderPath([]);
    await handleLoadPickerDirectories(null, null, mode);
  };

  // Click handler to dive into a subdirectory in picker
  const handlePickerNavigate = async (item: any) => {
    const isShared = pickerDriveMode === "shared";
    if (isShared) {
      const targetPrefix = item.id;
      setPickerCurrentFolderId(targetPrefix);
      setPickerFolderPath(prev => [...prev, { id: targetPrefix, name: item.name }]);
      await handleLoadPickerDirectories(targetPrefix, null, "shared");
    } else {
      if (item.isProject) {
        const projId = item.projectId;
        setPickerCurrentFolderId(null);
        setPickerFolderPath([{ id: `PROJECT:${projId}`, name: item.name }]);
        await handleLoadPickerDirectories(null, projId, "personal");
      } else {
        const firstSegment = pickerFolderPath[0];
        const projId = firstSegment && firstSegment.id?.startsWith("PROJECT:") 
          ? firstSegment.id.substring(8) 
          : null;

        setPickerCurrentFolderId(item.id);
        setPickerFolderPath(prev => [...prev, { id: item.id, name: item.name }]);
        await handleLoadPickerDirectories(item.id, projId, "personal");
      }
    }
  };

  // Picker Breadcrumb Navigation
  const handlePickerBreadcrumbClick = async (index: number) => {
    const isShared = pickerDriveMode === "shared";
    if (index === -1) {
      setPickerCurrentFolderId(null);
      setPickerFolderPath([]);
      await handleLoadPickerDirectories(null, null, pickerDriveMode);
    } else {
      const segment = pickerFolderPath[index];
      const newPath = pickerFolderPath.slice(0, index + 1);
      setPickerFolderPath(newPath);

      if (isShared) {
        setPickerCurrentFolderId(segment.id);
        await handleLoadPickerDirectories(segment.id, null, "shared");
      } else {
        if (segment.id?.startsWith("PROJECT:")) {
          const projId = segment.id.substring(8);
          setPickerCurrentFolderId(null);
          await handleLoadPickerDirectories(null, projId, "personal");
        } else {
          const firstSegment = newPath[0];
          const projId = firstSegment && firstSegment.id?.startsWith("PROJECT:") 
            ? firstSegment.id.substring(8) 
            : null;
          setPickerCurrentFolderId(segment.id);
          await handleLoadPickerDirectories(segment.id, projId, "personal");
        }
      }
    }
  };

  // Execute Bulk Copy / Move
  const handleExecutePickerAction = async () => {
    if (!pickerAction) return;

    setDestinationPickerOpen(false);

    // Save variables needed for async execution since selections will be cleared immediately
    const assetIdsToMove = Array.from(selectedAssetIds);
    const folderIdsToMove = Array.from(selectedFolderIds);
    const currentPickerAction = pickerAction;
    const sourceIsSharedDrive = explorerMode === "shared";
    const targetIsSharedDrive = pickerDriveMode === "shared";
    let targetFolderId: string | null = null;
    let targetProjectId: string | null = null;

    if (targetIsSharedDrive) {
      targetFolderId = pickerCurrentFolderId;
    } else {
      targetFolderId = pickerCurrentFolderId;
      const firstSegment = pickerFolderPath[0];
      if (firstSegment && firstSegment.id?.startsWith("PROJECT:")) {
        targetProjectId = firstSegment.id.substring(8);
      }
    }

    const totalCount = assetIdsToMove.length + folderIdsToMove.length;
    if (totalCount === 0) {
      setPickerAction(null);
      return;
    }

    // Set up background task label
    const actionLabel = currentPickerAction === "move" ? "Moving" : "Copying";
    const taskLabel = `${actionLabel} ${totalCount} item(s) to destination`;

    // Initialize progress tracking in drawer
    setUploadActive(true);
    setUploadMinimized(false);
    setUploadProgress(prev => ({
      ...prev,
      [taskLabel]: 0 // 0 means active / in progress
    }));

    // Clear selection immediately so user can continue using the drive
    handleClearSelection();
    setPickerAction(null);

    // Run in background asynchronously without blocking the UI
    (async () => {
      try {
        if (currentPickerAction === "move") {
          await bulkMoveItems({
            assetIds: assetIdsToMove,
            folderIds: folderIdsToMove,
            targetFolderId,
            targetProjectId,
            sourceIsSharedDrive,
            targetIsSharedDrive
          });
          showToast("Items moved successfully!", "success");
        } else if (currentPickerAction === "copy") {
          await bulkCopyItems({
            assetIds: assetIdsToMove,
            folderIds: folderIdsToMove,
            targetFolderId,
            targetProjectId,
            sourceIsSharedDrive,
            targetIsSharedDrive
          });
          showToast("Items copied successfully!", "success");
        }

        // Complete the progress tracking
        setUploadProgress(prev => ({
          ...prev,
          [taskLabel]: 100
        }));

        // Refresh contents to show newly moved items if still in this folder
        await refreshExplorerContents();
      } catch (err) {
        console.error(`Bulk ${currentPickerAction} failed`, err);
        showToast(`Failed to ${currentPickerAction} selected items`, "error");

        // Mark as failed in progress tracking
        setUploadProgress(prev => ({
          ...prev,
          [taskLabel]: -2
        }));
      }
    })();
  };

  // ==========================================
  // MODULAR CORE UPLOAD & FOLDER RECREATOR
  // ==========================================

  const refreshExplorerContents = async () => {
    await queryClient.invalidateQueries({ queryKey: ["driveContents"] });
    await queryClient.invalidateQueries({ queryKey: ["storageStats"] });
  };

  const uploadSingleFile = async (
    file: File, 
    targetFolderId: string | null, 
    customPrefix: string = "", 
    existingAssetId?: string | null, 
    existingR2Key?: string | null
  ) => {
    const filename = file.name;
    setUploadProgress((prev) => ({ ...prev, [filename]: 0 }));
    setUploadErrors((prev) => {
      const next = { ...prev };
      delete next[filename];
      return next;
    });
    setUploadMinimized(false); // Auto-expand drawer on new upload

    const isShared = explorerMode === "shared";
    const controller = new AbortController();

    // Register initial tracking in ref so user can cancel immediately
    uploadDetailsRef.current[filename] = {
      controller,
      uploadId: "",
      r2Key: "",
      assetId: "",
      isShared
    };

    try {
      // Dynamic chunk sizing tailored for high-concurrency memory efficiency and parallel TCP socket saturation
      let CHUNK_SIZE = 8 * 1024 * 1024; // Default: 8MB
      if (file.size > 3 * 1024 * 1024 * 1024) {
        CHUNK_SIZE = 32 * 1024 * 1024; // 32MB for files > 3GB
      } else if (file.size > 1 * 1024 * 1024 * 1024) {
        CHUNK_SIZE = 24 * 1024 * 1024; // 24MB for files 1GB - 3GB
      } else if (file.size > 250 * 1024 * 1024) {
        CHUNK_SIZE = 16 * 1024 * 1024; // 16MB for files 250MB - 1GB
      }
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

      // A. Initiate upload with R2 via Next.js backend
      const { uploadId, r2Key, assetId } = await initiateMultipartUpload({
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        projectId: selectedProjectId,
        folderId: targetFolderId,
        isSharedDrive: isShared,
        prefix: customPrefix,
        existingAssetId,
        existingR2Key
      });

      if (controller.signal.aborted) {
        throw new DOMException("Upload aborted", "AbortError");
      }

      // Update ref with server-side identifiers for complete cleanup
      uploadDetailsRef.current[filename] = {
        controller,
        uploadId,
        r2Key,
        assetId,
        isShared
      };

      // B. Get presigned URLs for each chunk
      const partNumbers = Array.from({ length: totalChunks }, (_, index) => index + 1);
      const { partUrls } = await getPresignedPartUrls({ 
        uploadId, 
        r2Key, 
        partNumbers,
        isSharedDrive: isShared
      });

      if (controller.signal.aborted) {
        throw new DOMException("Upload aborted", "AbortError");
      }

      // Inline helper to upload a single chunk ArrayBuffer using XMLHttpRequest for precise progress reporting
      const uploadChunk = (
        presignedUrl: string,
        chunkBuffer: ArrayBuffer,
        index: number,
        onProgress: (loaded: number) => void,
        signal: AbortSignal
      ): Promise<string> => {
        return new Promise((resolve, reject) => {
          if (signal.aborted) {
            reject(new DOMException("Upload aborted", "AbortError"));
            return;
          }

          const xhr = new XMLHttpRequest();
          xhr.open("PUT", presignedUrl);

          // Handle abort signal
          const abortHandler = () => {
            xhr.abort();
            reject(new DOMException("Upload aborted", "AbortError"));
          };
          signal.addEventListener("abort", abortHandler);

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              onProgress(event.loaded);
            }
          };

          xhr.onload = () => {
            signal.removeEventListener("abort", abortHandler);
            if (xhr.status >= 200 && xhr.status < 300) {
              const etag = xhr.getResponseHeader("ETag");
              if (etag) {
                resolve(etag);
              } else {
                reject(new Error(`Etag missing from chunk ${index + 1}`));
              }
            } else {
              reject(new Error(`Chunk ${index + 1} upload failed with status ${xhr.status}`));
            }
          };

          xhr.onerror = () => {
            signal.removeEventListener("abort", abortHandler);
            reject(new Error(`Chunk ${index + 1} network error`));
          };

          xhr.onabort = () => {
            signal.removeEventListener("abort", abortHandler);
            reject(new DOMException("Upload aborted", "AbortError"));
          };

          xhr.send(chunkBuffer);
        });
      };

      // C. Upload chunks directly using a highly concurrent sliding-window worker pool
      const parts: { PartNumber: number; ETag: string }[] = [];
      let nextChunkIndex = 0;
      const concurrency = 12; // Raised to 12 concurrent sockets to completely saturate high-speed lines

      // Track byte progress of all chunks
      const chunkProgress = new Array(totalChunks).fill(0);
      let lastProgressUpdateTime = 0;
      const THROTTLE_MS = 150; // Throttle React re-renders to prevent browser-thread choking

      let taskId: any = null;
      if (isCapacitor()) {
        try {
          const { BackgroundTask } = await import("@capawesome/capacitor-background-task");
          taskId = await BackgroundTask.beforeExit(async () => {});
        } catch (err) {}
      }

      const startTime = Date.now();

      const triggerProgressUpdate = (force = false) => {
        const now = Date.now();
        if (force || now - lastProgressUpdateTime > THROTTLE_MS) {
          const totalUploadedBytes = chunkProgress.reduce((sum, val) => sum + val, 0);
          const percent = Math.min(
            Math.round((totalUploadedBytes / file.size) * 100),
            99 // Keep at 99% max until completeMultipartUpload fully finishes and DB indexes
          );

          // Calculate Speed & ETA
          const elapsedMs = now - startTime;
          const speed = elapsedMs > 0 ? (totalUploadedBytes / elapsedMs) * 1000 : 0;
          const remainingBytes = file.size - totalUploadedBytes;
          const etaSeconds = speed > 0 ? remainingBytes / speed : Infinity;

          const speedText = speed > 0 ? `${(speed / (1024 * 1024)).toFixed(2)} MB/s` : "0 B/s";
          const etaText = etaSeconds === Infinity ? "Estimating..." : etaSeconds < 60 ? `${Math.round(etaSeconds)}s` : `${Math.floor(etaSeconds / 60)}m ${Math.round(etaSeconds % 60)}s`;

          setTransferMetrics((prev) => ({
            ...prev,
            [filename]: { speedText, etaText }
          }));

          setUploadProgress((prev) => {
            if (prev[filename] === -1) return prev;
            if (prev[filename] === percent) return prev;
            return {
              ...prev,
              [filename]: percent
            };
          });

          // Android Local Notification Progress update
          if (isCapacitor()) {
            import("@/lib/mobile-notifications").then(({ updateTransferNotification }) => {
              updateTransferNotification({
                key: filename,
                title: filename,
                type: "upload",
                bytesTransferred: totalUploadedBytes,
                totalBytes: file.size,
              });
            }).catch((err) => console.error("Notification update failed:", err));
          }

          lastProgressUpdateTime = now;
        }
      };

      const worker = async () => {
        while (true) {
          if (controller.signal.aborted) {
            throw new DOMException("Upload aborted", "AbortError");
          }

          const index = nextChunkIndex++;
          if (index >= totalChunks) {
            break;
          }

          const start = index * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunkSlice = file.slice(start, end);
          const presignedUrl = partUrls[index].url;

          try {
            // Convert to ArrayBuffer in-memory first to completely bypass file-reading IPC bottlenecks during active socket transfer
            const chunkBuffer = await chunkSlice.arrayBuffer();

            const etag = await uploadChunk(
              presignedUrl,
              chunkBuffer,
              index,
              (loadedBytes) => {
                chunkProgress[index] = loadedBytes;
                triggerProgressUpdate();
              },
              controller.signal
            );

            parts.push({ PartNumber: index + 1, ETag: etag });

            // Mark this chunk as fully loaded to guarantee accurate sum
            chunkProgress[index] = end - start;
            triggerProgressUpdate(true); // Force update upon chunk completion

          } catch (err) {
            throw err;
          }
        }
      };

      // Run multiple workers in parallel
      const pool = Array.from({ length: Math.min(concurrency, totalChunks) }, () => worker());
      await Promise.all(pool);

      // S3/R2 multipart uploads require the parts list to be in ascending order of PartNumber
      parts.sort((a, b) => a.PartNumber - b.PartNumber);

      if (controller.signal.aborted) {
        throw new DOMException("Upload aborted", "AbortError");
      }

      // D. Complete the Multipart upload on R2 and DB index
      await completeMultipartUpload({
        uploadId,
        r2Key,
        parts,
        assetId,
        isSharedDrive: isShared
      });

      // Set to 100 explicitly upon completion
      setUploadProgress((prev) => {
        if (prev[filename] === -1) return prev;
        return { ...prev, [filename]: 100 };
      });

      if (isCapacitor()) {
        try {
          const { updateTransferNotification } = await import("@/lib/mobile-notifications");
          await updateTransferNotification({
            key: filename,
            title: filename,
            type: "upload",
            bytesTransferred: file.size,
            totalBytes: file.size,
          });
        } catch (err) {}
      }

      return { success: true, r2Key, assetId };

    } catch (err: any) {
      const isAborted = err.name === "AbortError" || err.message === "canceled" || controller.signal.aborted;
      const details = uploadDetailsRef.current[filename];

      if (isCapacitor()) {
        try {
          const { dismissTransferNotification } = await import("@/lib/mobile-notifications");
          await dismissTransferNotification(filename);
        } catch (e) {}
      }

      if (isAborted) {
        if (details && details.uploadId) {
          try {
            await abortMultipartUpload({
              uploadId: details.uploadId,
              r2Key: details.r2Key,
              assetId: details.assetId,
              isSharedDrive: details.isShared
            });
          } catch (abortErr) {
            console.error("Failed to clean up aborted upload on server:", abortErr);
          }
        }
        setUploadProgress((prev) => ({ ...prev, [filename]: -1 }));
      } else {
        const errorMsg = err.message || String(err);
        setUploadErrors((prev) => ({ ...prev, [filename]: errorMsg }));
        setUploadProgress((prev) => ({ ...prev, [filename]: -2 }));
        console.error("Multipart upload failed for " + filename, err);
        showToast(`Failed to upload ${filename}: ${errorMsg}`, "error");
      }
      throw err;
    } finally {
      delete uploadDetailsRef.current[filename];
      if (taskId && isCapacitor()) {
        try {
          const { BackgroundTask } = await import("@capawesome/capacitor-background-task");
          BackgroundTask.finish({ taskId });
        } catch (err) {}
      }
    }
  };

  const handleCancelUpload = async (filename: string) => {
    const details = uploadDetailsRef.current[filename];
    if (!details) return;

    details.controller.abort();

    setUploadProgress((prev) => ({
      ...prev,
      [filename]: -1
    }));

    if (isCapacitor()) {
      try {
        const { dismissTransferNotification } = await import("@/lib/mobile-notifications");
        await dismissTransferNotification(filename);
      } catch (e) {}
    }

    if (details.uploadId) {
      try {
        await abortMultipartUpload({
          uploadId: details.uploadId,
          r2Key: details.r2Key,
          assetId: details.assetId,
          isSharedDrive: details.isShared
        });
      } catch (err) {
        console.error("Error aborting upload on server:", err);
      }
    }

    delete uploadDetailsRef.current[filename];
    showToast(`Cancelled upload: ${filename}`, "info");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadActive(true);

    const isShared = explorerMode === "shared";
    const prefix = isShared ? (sharedFolderPath.length > 0 ? sharedFolderPath.join("/") + "/" : "") : "";

    for (let i = 0; i < files.length; i++) {
      await uploadSingleFile(files[i], currentFolderId, prefix);
    }

    await refreshExplorerContents();
  };

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadActive(true);

    const isShared = explorerMode === "shared";
    const basePrefix = isShared ? (sharedFolderPath.length > 0 ? sharedFolderPath.join("/") + "/" : "") : "";

    const localFolderCache: { [pathKey: string]: string | null } = {};

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relativePath = file.webkitRelativePath || "";

      if (isShared) {
        let filePrefix = basePrefix;
        if (relativePath && relativePath.includes("/")) {
          const parts = relativePath.split("/");
          if (parts.length > 1) {
            const subPrefix = parts.slice(0, -1).join("/") + "/";
            filePrefix = basePrefix + subPrefix;
          }
        }
        await uploadSingleFile(file, null, filePrefix);
      } else {
        let targetFolderId = currentFolderId;

        if (relativePath && relativePath.includes("/")) {
          const parts = relativePath.split("/");
          const folderParts = parts.slice(0, parts.length - 1);
          
          let activeParentId = currentFolderId;
          const pathAccumulator: string[] = [];

          for (const folderName of folderParts) {
            pathAccumulator.push(folderName);
            const pathKey = pathAccumulator.join("/");

            if (localFolderCache[pathKey]) {
              activeParentId = localFolderCache[pathKey];
            } else {
              const existing = folders.find(
                (f: any) => f.name === folderName && f.parentId === activeParentId
              );

              if (existing) {
                activeParentId = existing.id;
                localFolderCache[pathKey] = activeParentId;
              } else {
                const createResult = await createFolder(
                  folderName,
                  selectedProjectId || undefined,
                  activeParentId
                );
                if (createResult && createResult.success && createResult.id) {
                  activeParentId = createResult.id;
                  localFolderCache[pathKey] = activeParentId;
                } else {
                  throw new Error(`Failed to create folder ${folderName}`);
                }
              }
            }
          }
          targetFolderId = activeParentId;
        }

        await uploadSingleFile(file, targetFolderId);
      }
    }

    await refreshExplorerContents();
  };

  const handleNativeUploadFlow = async (options: { directory: boolean }) => {
    try {
      const nativeFiles = await pickFilesNative({
        multiple: true,
        directory: options.directory,
      });

      if (nativeFiles.length === 0) return;

      setUploadActive(true);

      const isShared = explorerMode === "shared";
      const basePrefix = isShared ? (sharedFolderPath.length > 0 ? sharedFolderPath.join("/") + "/" : "") : "";

      for (const nativeFile of nativeFiles) {
        const filename = nativeFile.name;
        setUploadProgress((prev) => ({ ...prev, [filename]: 0 }));
        setUploadErrors((prev) => {
          const next = { ...prev };
          delete next[filename];
          return next;
        });
        setUploadMinimized(false);

        const controller = new AbortController();
        uploadDetailsRef.current[filename] = {
          controller,
          uploadId: "",
          r2Key: "",
          assetId: "",
          isShared,
          filePath: nativeFile.path,
        };

        try {
          if (controller.signal.aborted) {
            throw new DOMException("Upload aborted", "AbortError");
          }

          // A. Calculate chunk size based on file size
          let CHUNK_SIZE = 8 * 1024 * 1024; // 8MB
          if (nativeFile.size > 3 * 1024 * 1024 * 1024) {
            CHUNK_SIZE = 32 * 1024 * 1024; // 32MB
          } else if (nativeFile.size > 1 * 1024 * 1024 * 1024) {
            CHUNK_SIZE = 24 * 1024 * 1024; // 24MB
          } else if (nativeFile.size > 250 * 1024 * 1024) {
            CHUNK_SIZE = 16 * 1024 * 1024; // 16MB
          }
          const totalChunks = Math.ceil(nativeFile.size / CHUNK_SIZE) || 1;

          // B. Initiate Upload on the Next.js server to get IDs and Bucket Key
          const { uploadId, r2Key, assetId } = await initiateMultipartUpload({
            filename: nativeFile.name,
            mimeType: nativeFile.mimeType || "application/octet-stream",
            size: nativeFile.size,
            projectId: selectedProjectId,
            folderId: currentFolderId,
            isSharedDrive: isShared,
            prefix: basePrefix,
          });

          if (controller.signal.aborted) {
            throw new DOMException("Upload aborted", "AbortError");
          }

          // Update details with correct server IDs for proper abort handling
          uploadDetailsRef.current[filename] = {
            controller,
            uploadId,
            r2Key,
            assetId,
            isShared,
            filePath: nativeFile.path,
          };

          // C. Get Presigned PUT URLs from S3
          const partNumbers = Array.from({ length: totalChunks }, (_, index) => index + 1);
          const { partUrls } = await getPresignedPartUrls({
            uploadId,
            r2Key,
            partNumbers,
            isSharedDrive: isShared,
          });

          if (controller.signal.aborted) {
            throw new DOMException("Upload aborted", "AbortError");
          }

          // Prepare parts for the native uploader
          const nativeParts = partUrls.map((p) => ({
            partNumber: p.partNumber,
            url: p.url,
          }));

          // Track progress bytes
          const progressTracker: { [part: number]: number } = {};
          let lastUpdateTime = 0;
          const startTime = Date.now();

          // D. Invoke Native Upload
          const completedParts = await uploadFileNative({
            filePath: nativeFile.path,
            parts: nativeParts,
            chunkSize: CHUNK_SIZE,
            signal: controller.signal,
            onProgress: (bytesSent, partNumber) => {
              progressTracker[partNumber] = bytesSent;
              const totalUploaded = Object.values(progressTracker).reduce((a, b) => a + b, 0);
              const percent = Math.min(Math.round((totalUploaded / nativeFile.size) * 100), 99);

              const now = Date.now();
              if (now - lastUpdateTime > 150) {
                // Calculate Speed & ETA
                const elapsedMs = now - startTime;
                const speed = elapsedMs > 0 ? (totalUploaded / elapsedMs) * 1000 : 0;
                const remainingBytes = nativeFile.size - totalUploaded;
                const etaSeconds = speed > 0 ? remainingBytes / speed : Infinity;

                const speedText = speed > 0 ? `${(speed / (1024 * 1024)).toFixed(2)} MB/s` : "0 B/s";
                const etaText = etaSeconds === Infinity ? "Estimating..." : etaSeconds < 60 ? `${Math.round(etaSeconds)}s` : `${Math.floor(etaSeconds / 60)}m ${Math.round(etaSeconds % 60)}s`;

                setTransferMetrics(prev => ({
                  ...prev,
                  [filename]: { speedText, etaText }
                }));

                setUploadProgress((prev) => ({ ...prev, [filename]: percent }));
                lastUpdateTime = now;
              }
            },
          });

          if (controller.signal.aborted) {
            throw new DOMException("Upload aborted", "AbortError");
          }

          // E. Complete multipart upload
          await completeMultipartUpload({
            uploadId,
            r2Key,
            parts: completedParts,
            assetId,
            isSharedDrive: isShared,
          });

          setUploadProgress((prev) => ({ ...prev, [filename]: 100 }));
        } catch (fileErr: any) {
          const isAborted = fileErr.name === "AbortError" || fileErr.message === "canceled" || controller.signal.aborted;
          const details = uploadDetailsRef.current[filename];

          if (isAborted) {
            if (details && details.uploadId) {
              try {
                await abortMultipartUpload({
                  uploadId: details.uploadId,
                  r2Key: details.r2Key,
                  assetId: details.assetId,
                  isSharedDrive: details.isShared,
                });
              } catch (abortErr) {
                console.error("Failed to clean up aborted upload on server:", abortErr);
              }
            }
            setUploadProgress((prev) => ({ ...prev, [filename]: -1 }));
          } else {
            const errorMsg = fileErr.message || String(fileErr);
            setUploadErrors((prev) => ({ ...prev, [filename]: errorMsg }));
            console.error("Native upload failed for " + filename, fileErr);
            setUploadProgress((prev) => ({ ...prev, [filename]: -2 }));
            showToast(`Failed to upload ${filename}: ${errorMsg}`, "error");
          }
        } finally {
          delete uploadDetailsRef.current[filename];
        }
      }

      await refreshExplorerContents();
    } catch (err) {
      console.error("Native upload flow error:", err);
      showToast("Native file picker or upload failed.", "error");
    }
  };

  const triggerFileSelect = async () => {
    if (isNativeApp()) {
      await handleNativeUploadFlow({ directory: false });
    } else {
      fileInputRef.current?.click();
    }
  };

  const triggerFolderSelect = async () => {
    if (isNativeApp()) {
      await handleNativeUploadFlow({ directory: true });
    } else {
      folderInputRef.current?.click();
    }
  };

  // ==========================================
  // PROGRAMMATIC CREATORS & EDITORS HANDLERS
  // ==========================================

  const handleOpenTextCreator = () => {
    setTextFileName("Untitled.txt");
    setTextContent("");
    setTextEditorMode("create");
    setTextEditorAsset(null);
    setTextModalOpen(true);
  };

  const handleOpenTextEditor = async (asset: any) => {
    try {
      setTextFileName(asset.filename);
      setTextEditorMode("edit");
      setTextEditorAsset(asset);
      setTextModalOpen(true);

      const isShared = explorerMode === "shared";
      const downloadResult = isShared 
        ? await getSharedDownloadUrl(asset.id) 
        : await getDownloadUrl(asset.id);

      const res = await fetch(downloadResult.downloadUrl);
      if (res.ok) {
        const text = await res.text();
        setTextContent(text);
      }
    } catch (err) {
      console.error("Failed to load text file content", err);
    }
  };

  const handleSaveTextFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textFileName.trim()) return;

    setUploadActive(true);
    setTextModalOpen(false);

    try {
      const file = new (window as any).File([textContent], textFileName, { type: "text/plain" });
      
      const isShared = explorerMode === "shared";
      const prefix = isShared ? (sharedFolderPath.length > 0 ? sharedFolderPath.join("/") + "/" : "") : "";

      if (textEditorMode === "edit" && textEditorAsset) {
        await uploadSingleFile(
          file, 
          textEditorAsset.folderId, 
          prefix, 
          textEditorAsset.id, 
          textEditorAsset.r2Key
        );
      } else {
        await uploadSingleFile(file, currentFolderId, prefix);
      }

      await refreshExplorerContents();
      showToast("Text file saved successfully!", "success");
    } catch (err) {
      showToast("Failed to save text file", "error");
    }
  };

  const handleOpenDocsCreator = () => {
    setDocTitle("Untitled Document");
    setDocsEditorMode("create");
    setDocsEditorAsset(null);
    setDocsModalOpen(true);
  };

  const handleOpenDocsEditor = async (asset: any) => {
    try {
      setDocTitle(asset.filename.replace(/\.html$/i, ""));
      setDocsEditorMode("edit");
      setDocsEditorAsset(asset);
      setDocsModalOpen(true);

      const isShared = explorerMode === "shared";
      const downloadResult = isShared 
        ? await getSharedDownloadUrl(asset.id) 
        : await getDownloadUrl(asset.id);

      const res = await fetch(downloadResult.downloadUrl);
      if (res.ok) {
        const rawHtml = await res.text();
        
        setTimeout(() => {
          if (quillRef.current) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(rawHtml, "text/html");
            const qlEditor = doc.querySelector(".ql-editor");
            const content = qlEditor ? qlEditor.innerHTML : doc.body.innerHTML;
            quillRef.current.root.innerHTML = content;
          }
        }, 300);
      }
    } catch (err) {
      console.error("Failed to load document content", err);
    }
  };

  const handleSaveDocsFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle.trim() || !quillRef.current) return;

    setUploadActive(true);
    setDocsModalOpen(false);

    try {
      const htmlContent = quillRef.current.root.innerHTML;
      const fullHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${docTitle}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.snow.css">
  <style>
    body { padding: 32px; font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; max-width: 800px; margin: 0 auto; }
    .ql-editor { font-size: 16px; line-height: 1.6; }
    @media (prefers-color-scheme: light) {
      body { background: #ffffff; color: #0f172a; }
    }
  </style>
</head>
<body>
  <div class="ql-container ql-snow">
    <div class="ql-editor">
      ${htmlContent}
    </div>
  </div>
</body>
</html>`;

      const filename = docTitle.toLowerCase().endsWith(".html") ? docTitle : `${docTitle}.html`;
      const file = new (window as any).File([fullHTML], filename, { type: "text/html" });

      const isShared = explorerMode === "shared";
      const prefix = isShared ? (sharedFolderPath.length > 0 ? sharedFolderPath.join("/") + "/" : "") : "";

      if (docsEditorMode === "edit" && docsEditorAsset) {
        await uploadSingleFile(
          file, 
          docsEditorAsset.folderId, 
          prefix, 
          docsEditorAsset.id, 
          docsEditorAsset.r2Key
        );
      } else {
        await uploadSingleFile(file, currentFolderId, prefix);
      }

      await refreshExplorerContents();
      showToast("Document saved successfully!", "success");
    } catch (err) {
      showToast("Failed to save Document", "error");
    }
  };

  const columnsList = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const rowsCount = 20;

  const handleOpenSheetCreator = () => {
    setSheetName("Untitled Sheet");
    setSheetCells({});
    setSheetEditorMode("create");
    setSheetEditorAsset(null);
    setSheetModalOpen(true);
  };

  const handleOpenSheetEditor = async (asset: any) => {
    try {
      setSheetName(asset.filename.replace(/\.sheet\.json$/i, ""));
      setSheetEditorMode("edit");
      setSheetEditorAsset(asset);
      setSheetModalOpen(true);

      const isShared = explorerMode === "shared";
      const downloadResult = isShared 
        ? await getSharedDownloadUrl(asset.id) 
        : await getDownloadUrl(asset.id);

      const res = await fetch(downloadResult.downloadUrl);
      if (res.ok) {
        const data = await res.json();
        if (data && data.cells) {
          setSheetCells(data.cells);
        }
      }
    } catch (err) {
      console.error("Failed to load spreadsheet content", err);
    }
  };

  const handleSaveSheetFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sheetName.trim()) return;

    setUploadActive(true);
    setSheetModalOpen(false);

    try {
      const sheetData = {
        columns: columnsList,
        rowsCount: rowsCount,
        cells: sheetCells
      };

      const filename = sheetName.toLowerCase().endsWith(".sheet.json") 
        ? sheetName 
        : `${sheetName}.sheet.json`;

      const file = new (window as any).File([JSON.stringify(sheetData, null, 2)], filename, { type: "application/json" });

      const isShared = explorerMode === "shared";
      const prefix = isShared ? (sharedFolderPath.length > 0 ? sharedFolderPath.join("/") + "/" : "") : "";

      if (sheetEditorMode === "edit" && sheetEditorAsset) {
        await uploadSingleFile(
          file, 
          sheetEditorAsset.folderId, 
          prefix, 
          sheetEditorAsset.id, 
          sheetEditorAsset.r2Key
        );
      } else {
        await uploadSingleFile(file, currentFolderId, prefix);
      }

      await refreshExplorerContents();
      showToast("Sheet saved successfully!", "success");
    } catch (err) {
      showToast("Failed to save Sheet", "error");
    }
  };

  const handleCellChange = (col: string, row: number, value: string) => {
    const refKey = `${col}${row}`;
    setSheetCells((prev) => ({
      ...prev,
      [refKey]: value
    }));
  };



  const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KiB", "MiB", "GiB", "TiB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  if (loading) {
    return (
      <div className="app-container" style={{ 
        alignItems: "center", 
        justifyContent: "center",
        position: "relative",
        background: "radial-gradient(circle at center, rgba(99, 102, 241, 0.08) 0%, var(--bg-primary) 70%)",
        flexDirection: "column"
      }}>
        {/* Glowing background circle for visual depth */}
        <div style={{
          position: "absolute",
          width: "300px",
          height: "300px",
          background: "radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, transparent 70%)",
          filter: "blur(50px)",
          top: "calc(50% - 150px)",
          left: "calc(50% - 150px)",
          animation: "pulse-glow 3s infinite ease-in-out",
          pointerEvents: "none"
        }} />

        <div className="glass animate-fade-in" style={{
          padding: "48px",
          borderRadius: "24px",
          border: "1px solid var(--border-color)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          boxShadow: "var(--shadow-lg), 0 0 50px rgba(99, 102, 241, 0.08)",
          maxWidth: "420px",
          textAlign: "center",
          zIndex: 10
        }}>
          {/* Circular progress loader container */}
          <div style={{ position: "relative", width: "72px", height: "72px", marginBottom: "28px" }}>
            {/* outer track */}
            <div style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              border: "3px solid rgba(255, 255, 255, 0.03)"
            }} />
            {/* inner spinning glowing arc */}
            <div style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              border: "3px solid transparent",
              borderTopColor: "var(--accent-indigo)",
              borderRightColor: "var(--accent-blue)",
              animation: "spin 1.2s infinite cubic-bezier(0.4, 0.1, 0.6, 1)",
              boxShadow: "0 0 15px rgba(99, 102, 241, 0.25)"
            }} />
            {/* Center glowing dot */}
            <div style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              backgroundColor: "var(--accent-indigo)",
              boxShadow: "0 0 12px var(--accent-indigo)"
            }} />
          </div>

          <h2 style={{ 
            fontSize: "22px", 
            fontWeight: "800", 
            letterSpacing: "-0.5px", 
            marginBottom: "8px",
            background: "linear-gradient(135deg, var(--text-primary), var(--text-secondary))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent"
          }}>
            Motionsewa Drive
          </h2>
          <p style={{ 
            fontSize: "14px", 
            color: "var(--text-secondary)",
            animation: "pulse-glow 2s infinite ease-in-out",
            fontWeight: "500",
            letterSpacing: "0.2px"
          }}>
            Opening your Web Drive...
          </p>
        </div>
      </div>
    );
  }

  const isAdmin = (session?.user as any)?.role === "admin" || (session?.user as any)?.role === "manager";

  return (
    <div className="app-container">
      {/* SIDEBAR BACKDROP FOR MOBILE */}
      {sidebarOpen && (
        <div className="sidebar-backdrop show" onClick={() => setSidebarOpen(false)} />
      )}

      {/* SIDEBAR NAVIGATION */}
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

            {(() => {
              const currentUserId = session?.user?.id;
              
              const yourProjects = (projects || []).filter(proj => {
                const nameLower = (proj.name || "").toLowerCase();
                const clientLower = (proj.clientName || "").toLowerCase();
                const isArchive = nameLower.includes("archive") || nameLower.includes("archived") || clientLower.includes("archive") || clientLower.includes("archived");
                
                // My Projects are owned by the current logged-in user
                const isOwnedByMe = proj.userId === currentUserId;
                return isOwnedByMe && !isArchive;
              });

              const sharedProjects = (projects || []).filter(proj => {
                const nameLower = (proj.name || "").toLowerCase();
                const clientLower = (proj.clientName || "").toLowerCase();
                const isArchive = nameLower.includes("archive") || nameLower.includes("archived") || clientLower.includes("archive") || clientLower.includes("archived");
                
                // Shared Projects are owned by anyone else (or legacy projects with no owner)
                const isOwnedByMe = proj.userId === currentUserId;
                return !isOwnedByMe && !isArchive;
              });

              const archiveProjects = (projects || []).filter(proj => {
                const nameLower = (proj.name || "").toLowerCase();
                const clientLower = (proj.clientName || "").toLowerCase();
                const isArchive = nameLower.includes("archive") || nameLower.includes("archived") || clientLower.includes("archive") || clientLower.includes("archived");
                return isArchive;
              });

              return (
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
              );
            })()}
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
              <span>{(storageStats.available / (1024 * 1024 * 1024)).toFixed(1)} GB Free</span>
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

      {/* MAIN CONTENT EXPLORER */}
      <main className="main-content">
        {/* MOBILE TOP HEADER BAR */}
        <div className="mobile-top-header">
          <button 
            onClick={() => setSidebarOpen(true)} 
            className="mobile-menu-btn" 
            title="Open Menu"
          >
            <Menu size={24} />
          </button>
          <div className="mobile-brand">
            <LayoutGrid size={20} className="brand-accent" />
            <span>Motionsewa <span className="brand-accent">Drive</span></span>
          </div>
          <div className="mobile-user-avatar">
            {session?.user?.name?.charAt(0) || "U"}
          </div>
        </div>

        <header className="header">
          <div className="search-bar-container">
            <Search size={18} />
            <input 
              type="text" 
              className="search-input" 
              placeholder="Search files in organization drive..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </header>

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

              {(() => {
                const currentOpenProject = explorerMode === "personal" && selectedProjectId 
                  ? projects.find((p: any) => p.id === selectedProjectId)
                  : null;
                
                if (!currentOpenProject) return null;

                return (
                  <div ref={projectHeaderRef} style={{ position: "relative", display: "inline-flex" }}>
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
                        
                        {isAdmin && (
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
            </h2>
            <div className="explorer-actions" ref={newDropdownRef}>
              {explorerMode !== "links" && (
                <div className="view-mode-toggle">
                  <button
                    onClick={() => changeViewMode("table")}
                    className={`toggle-btn ${viewMode === "table" ? "active" : ""}`}
                    title="Table View"
                  >
                    <List size={18} />
                  </button>
                  <button
                    onClick={() => changeViewMode("icons")}
                    className={`toggle-btn ${viewMode === "icons" ? "active" : ""}`}
                    title="Icons View"
                  >
                    <LayoutGrid size={18} />
                  </button>
                </div>
              )}

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
            /* ========================================================
               SHARED LINKS MANAGER VIEW
               ======================================================== */
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
                              title="Expire Right Away (Revoke)"
                            >
                              <Minus size={16} style={{ color: "#ef4444" }} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : viewMode === "table" ? (
            /* ========================================================
               1. UNIFIED TABLE LIST VIEW (DEFAULT)
               ======================================================== */
            <div>
              {filteredFolders.length === 0 && filteredAssets.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "240px", border: "1px dashed var(--border-color)", borderRadius: "12px", background: "var(--bg-secondary)", color: "var(--text-secondary)" }}>
                  <File size={36} style={{ marginBottom: "12px" }} />
                  <p style={{ fontSize: "14px" }}>No folders or files found here yet.</p>
                </div>
              ) : (
                <div className="files-container">
                  <div className="table-header">
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectAll();
                        }}
                        className={`master-select-checkbox ${isAllSelected() ? "selected" : ""}`}
                        title="Select All / None"
                      >
                        {isAllSelected() ? (
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
                  {filteredFolders.map((folder) => {
                    const isFolderSelected = selectedFolderIds.has(folder.id);
                    return (
                      <div 
                        key={folder.id} 
                        className={`file-row ${isFolderSelected ? "selected" : ""}`}
                        style={{ cursor: "pointer" }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          navigateToFolder(folder);
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigateToFolder(folder);
                        }}
                        onContextMenu={(e) => handleContextMenu(e, folder, "folder")}
                      >
                        <div className="file-info">
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
                          <Folder className="folder-icon" size={18} style={{ color: "var(--accent-indigo)" }} />
                          <span className="file-name" title={folder.name}>{folder.name}</span>
                        </div>

                        <div className="file-size">-</div>

                        <div className="file-date">Folder</div>

                        <div className="file-actions">
                          {isAdmin && explorerMode !== "archive" && (
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
                  {filteredAssets.map((asset) => {
                    const isAssetSelected = selectedAssetIds.has(asset.id);
                    return (
                      <div 
                        key={asset.id} 
                        className={`file-row ${isAssetSelected ? "selected" : ""}`}
                        onContextMenu={(e) => handleContextMenu(e, asset, "file")}
                        style={{ cursor: "pointer" }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          handleDownloadFile(asset.id);
                        }}
                      >
                        <div className="file-info">
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
                          <File className="file-icon" size={18} style={{ color: "var(--accent-blue)" }} />
                          <span className="file-name" title={asset.filename}>{asset.filename}</span>
                        </div>

                        <div className="file-size">{formatBytes(asset.size)}</div>

                        <div className="file-date" title={asset.uploadedBy || "Creator"}>{asset.uploadedBy || "Creator"}</div>

                        <div className="file-actions">
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
                          {isAdmin && explorerMode !== "archive" && (
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
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* ========================================================
               2. VISUAL ICONS GRID VIEW
               ======================================================== */
            <div>
              {/* Folders Grid Section */}
              {filteredFolders.length > 0 && (
                <div style={{ marginBottom: "32px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                    <h3 className="section-title" style={{ margin: 0 }}>Folders</h3>
                  </div>
                  <div className="folders-grid">
                    {filteredFolders.map((folder) => {
                      const isFolderSelected = selectedFolderIds.has(folder.id);
                      return (
                        <div 
                          key={folder.id} 
                          className={`folder-card ${isFolderSelected ? "selected" : ""}`}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            navigateToFolder(folder);
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigateToFolder(folder);
                          }}
                          onContextMenu={(e) => handleContextMenu(e, folder, "folder")}
                        >
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

                          <Folder className="folder-icon" size={24} />
                          <span className="folder-name">{folder.name}</span>
                          {isAdmin && explorerMode !== "archive" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteFolder(folder.id, folder.name);
                              }}
                              className="btn-icon delete"
                              style={{ marginLeft: "auto", flexShrink: 0 }}
                              title="Delete Folder"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Files Grid Section */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                <h3 className="section-title" style={{ margin: 0 }}>Files</h3>
                {filteredAssets.length > 0 && (
                  <button 
                    onClick={handleSelectAll} 
                    className="btn-text-select-all"
                    style={{ fontSize: "13px", color: "var(--brand-accent)", background: "none", border: "none", cursor: "pointer", fontWeight: "600", padding: "4px 8px", borderRadius: "4px" }}
                  >
                    {isAllSelected() ? "Deselect All" : "Select All"}
                  </button>
                )}
              </div>

              {filteredFolders.length === 0 && filteredAssets.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "180px", border: "1px dashed var(--border-color)", borderRadius: "12px", background: "var(--bg-secondary)", color: "var(--text-secondary)" }}>
                  <File size={36} style={{ marginBottom: "12px" }} />
                  <p style={{ fontSize: "14px" }}>No folders or files found here yet.</p>
                </div>
              ) : filteredAssets.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "180px", border: "1px dashed var(--border-color)", borderRadius: "12px", background: "var(--bg-secondary)", color: "var(--text-secondary)" }}>
                  <File size={36} style={{ marginBottom: "12px" }} />
                  <p style={{ fontSize: "14px" }}>No files uploaded here yet.</p>
                </div>
              ) : (
                <div className="files-grid">
                  {filteredAssets.map((asset) => {
                    const isAssetSelected = selectedAssetIds.has(asset.id);
                    return (
                      <div 
                        key={asset.id} 
                        className={`file-card ${isAssetSelected ? "selected" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleAssetSelection(asset.id);
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          handleDownloadFile(asset.id);
                        }}
                        onContextMenu={(e) => handleContextMenu(e, asset, "file")}
                      >
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

                        <div className="file-card-preview">
                          <File className="file-card-icon" size={40} />
                        </div>

                        <div className="file-card-info">
                          <span className="file-card-name" title={asset.filename}>{asset.filename}</span>
                          <span className="file-card-meta">{formatBytes(asset.size)}</span>
                        </div>

                        <div className="file-card-actions">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadFile(asset.id);
                            }} 
                            className="btn-icon" 
                            title="Download File"
                          >
                            <Download size={14} />
                          </button>
                          {isAdmin && explorerMode !== "archive" && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteFile(asset.id);
                              }} 
                              className="btn-icon delete" 
                              title="Delete File"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* FLOATING MULTI-PART UPLOAD / OPERATION PROCESS DRAWER */}
      {(uploadActive || downloadActive) && !uploadMinimized && (
        <div className="progress-drawer">
          <div className="drawer-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <span className="drawer-title" style={{ fontWeight: '600' }}>
              {Object.keys(uploadProgress).some(k => k.startsWith("Moving") || k.startsWith("Copying") || k.startsWith("Deleting"))
                ? "Transfers & Operations"
                : (Object.keys(downloadProgress).length > 0 && Object.keys(uploadProgress).length > 0)
                  ? "Transfers & Operations"
                  : Object.keys(downloadProgress).length > 0
                    ? "Downloading File(s)"
                    : "Uploading Video Chunk(s)"}
            </span>
            <div className="drawer-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button 
                onClick={() => setUploadMinimized(true)} 
                className="btn-icon" 
                style={{ padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Minimize"
              >
                <Minus size={14} />
              </button>
              {!(
                Object.values(uploadProgress).some(progress => progress >= 0 && progress < 100) ||
                Object.values(downloadProgress).some(item => !item.isCancelled && !item.isFailed && item.progress < 100)
              ) && (
                <button 
                  onClick={() => {
                    setUploadActive(false);
                    setDownloadActive(false);
                    setUploadProgress({});
                    setDownloadProgress({});
                  }} 
                  className="btn-icon" 
                  style={{ padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Close"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="drawer-body">
            {/* Upload items */}
            {Object.entries(uploadProgress).map(([filename, progress]) => {
              const isUploading = progress >= 0 && progress < 100;
              const isCompleted = progress === 100;
              const isCancelled = progress === -1;
              const isFailed = progress === -2;
              const isBackgroundOp = filename.startsWith("Moving") || filename.startsWith("Copying") || filename.startsWith("Deleting");

              return (
                <div key={filename} className="upload-item">
                  <div className="upload-info" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minWidth: 0, marginRight: '8px' }}>
                      <span className="upload-name" title={filename} style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {filename}
                      </span>
                      {isUploading && transferMetrics[filename] && (
                        <span style={{ fontSize: '10px', color: 'var(--text-muted, #9ca3af)', marginTop: '2px' }}>
                          {transferMetrics[filename].speedText} • {transferMetrics[filename].etaText}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <span className="upload-status-text" style={{ 
                        fontSize: '12px', 
                        fontWeight: '500',
                        color: isCompleted 
                          ? 'var(--accent-success, #10b981)' 
                          : isCancelled 
                            ? 'var(--text-secondary)' 
                            : isFailed 
                              ? 'var(--accent-danger, #ef4444)' 
                              : 'var(--text-secondary)'
                      }}>
                        {isCompleted && "Completed"}
                        {isCancelled && "Cancelled"}
                        {isFailed && "Failed"}
                        {isUploading && (isBackgroundOp ? "In Progress" : `${progress}%`)}
                      </span>

                      {isUploading && !isBackgroundOp && (
                        <button
                          onClick={() => handleCancelUpload(filename)}
                          className="btn-icon cancel-upload-btn"
                          style={{ 
                            padding: '2px', 
                            color: 'var(--text-muted)',
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                          title="Cancel Upload"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="progress-track">
                    <div 
                      className={`progress-bar ${isCancelled ? 'cancelled' : isFailed ? 'failed' : ''} ${isBackgroundOp && isUploading ? 'indeterminate' : ''}`} 
                      style={{ 
                        width: `${isCancelled || isFailed ? 100 : (isBackgroundOp && isUploading) ? 100 : progress}%`,
                        background: isCancelled 
                          ? 'var(--border-color, #374151)' 
                          : isFailed 
                            ? 'var(--accent-danger, #ef4444)' 
                            : (isBackgroundOp && isUploading)
                              ? undefined
                              : 'linear-gradient(90deg, var(--accent-blue), var(--accent-indigo))'
                      }} 
                    />
                  </div>
                  {isFailed && uploadErrors[filename] && (
                    <div style={{ fontSize: '10px', color: 'var(--accent-danger, #ef4444)', marginTop: '4px', wordBreak: 'break-all', opacity: 0.9 }}>
                      {uploadErrors[filename]}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Download items */}
            {Object.entries(downloadProgress).map(([filename, item]) => {
              const progress = item.progress;
              const isDownloading = progress >= 0 && progress < 100 && !item.isCancelled && !item.isFailed;
              const isCompleted = progress === 100;
              const isCancelled = item.isCancelled || progress === -1;
              const isFailed = item.isFailed || progress === -2;

              return (
                <div key={filename} className="upload-item">
                  <div className="upload-info" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexGrow: 1, minWidth: 0, marginRight: '8px' }}>
                      <Download size={14} style={{ color: 'var(--accent-indigo, #6366f1)', flexShrink: 0 }} />
                      <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minWidth: 0 }}>
                        <span className="upload-name" title={filename} style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {filename}
                        </span>
                        {isDownloading && transferMetrics[filename] && (
                          <span style={{ fontSize: '10px', color: 'var(--text-muted, #9ca3af)', marginTop: '2px' }}>
                            {transferMetrics[filename].speedText} • {transferMetrics[filename].etaText}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <span className="upload-status-text" style={{ 
                        fontSize: '12px', 
                        fontWeight: '500',
                        color: isCompleted 
                          ? 'var(--accent-success, #10b981)' 
                          : isCancelled 
                            ? 'var(--text-secondary)' 
                            : isFailed 
                              ? 'var(--accent-danger, #ef4444)' 
                              : 'var(--text-secondary)'
                      }}>
                        {isCompleted && "Downloaded"}
                        {isCancelled && "Cancelled"}
                        {isFailed && "Failed"}
                        {isDownloading && `${progress}%`}
                      </span>

                      {isDownloading && (
                        <button
                          onClick={() => handleCancelDownload(filename)}
                          className="btn-icon cancel-upload-btn"
                          style={{ 
                            padding: '2px', 
                            color: 'var(--text-muted)',
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                          title="Cancel Download"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="progress-track">
                    <div 
                      className={`progress-bar ${isCancelled ? 'cancelled' : isFailed ? 'failed' : ''}`} 
                      style={{ 
                        width: `${isCancelled || isFailed ? 100 : progress}%`,
                        background: isCancelled 
                          ? 'var(--border-color, #374151)' 
                          : isFailed 
                            ? 'var(--accent-danger, #ef4444)' 
                            : 'linear-gradient(90deg, #6366f1, #a855f7)' // Indigo to Purple gradient
                      }} 
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* FLOATING MINIMIZED PILL */}
      {(uploadActive || downloadActive) && uploadMinimized && (
        <div 
          className="upload-minimized-pill" 
          onClick={() => setUploadMinimized(false)}
          title="Click to expand status"
        >
          <div className="minimized-pill-content">
            {Object.values(uploadProgress).some(progress => progress >= 0 && progress < 100) ||
             Object.values(downloadProgress).some(item => !item.isCancelled && !item.isFailed && item.progress < 100) ? (
              <Loader2 className="upload-spin-icon" size={16} />
            ) : (
              <CheckCircle size={16} style={{ color: "var(--accent-success, #10b981)" }} />
            )}
            <span className="minimized-pill-text">
              {(() => {
                const activeUploads = Object.entries(uploadProgress).filter(([k, p]) => p >= 0 && p < 100 && !k.startsWith("Moving") && !k.startsWith("Copying") && !k.startsWith("Deleting"));
                const activeOps = Object.entries(uploadProgress).filter(([k, p]) => p >= 0 && p < 100 && (k.startsWith("Moving") || k.startsWith("Copying") || k.startsWith("Deleting")));
                const activeDownloads = Object.entries(downloadProgress).filter(([_, item]) => !item.isCancelled && !item.isFailed && item.progress >= 0 && item.progress < 100);

                const upCount = activeUploads.length;
                const opCount = activeOps.length;
                const downCount = activeDownloads.length;

                if (upCount > 0 || opCount > 0 || downCount > 0) {
                  const parts: string[] = [];
                  if (upCount > 0) {
                    parts.push(`Uploading ${upCount} file${upCount > 1 ? 's' : ''}`);
                  }
                  if (downCount > 0) {
                    parts.push(`Downloading ${downCount} file${downCount > 1 ? 's' : ''}`);
                  }
                  if (opCount > 0) {
                    parts.push(`${opCount} file operation${opCount > 1 ? 's' : ''}`);
                  }
                  return parts.join(" & ") + "...";
                }
                return "Operations completed";
              })()}
            </span>
          </div>
          <div className="minimized-pill-actions" onClick={(e) => e.stopPropagation()}>
            {!(
              Object.values(uploadProgress).some(progress => progress >= 0 && progress < 100) ||
              Object.values(downloadProgress).some(item => !item.isCancelled && !item.isFailed && item.progress < 100)
            ) && (
              <button 
                onClick={() => {
                  setUploadActive(false);
                  setDownloadActive(false);
                  setUploadProgress({});
                  setDownloadProgress({});
                }} 
                className="btn-icon minimized-close-btn"
                style={{ padding: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Close"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* CREATE FOLDER POPUP MODAL */}
      {folderModalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{ fontSize: "18px", fontWeight: "700" }}>Create New Folder</h3>
            <form onSubmit={handleCreateFolder} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Folder Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Edited Shoots"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px" }}>
                <button type="button" onClick={() => setFolderModalOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAILED USER STORAGE ANALYTICS MODAL */}
      {showDetailedUsageModal && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal" style={{ maxWidth: "780px", width: "100%", padding: "32px", background: "#0c0c0e" }}>
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
                onClick={() => setShowDetailedUsageModal(false)} 
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
      )}


      {/* CREATE PROJECT POPUP MODAL */}
      {projectModalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{ fontSize: "18px", fontWeight: "700" }}>Add New Project</h3>
            <form onSubmit={handleCreateProject} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Project Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Wedding Promos"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Client Name (Optional)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Sony Entertainment"
                  value={newProjectClient}
                  onChange={(e) => setNewProjectClient(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ margin: 0, marginTop: "4px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", userSelect: "none" }}>
                  <input 
                    type="checkbox" 
                    checked={shareWithAll}
                    onChange={(e) => setShareWithAll(e.target.checked)}
                    style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: "var(--accent-indigo)" }}
                  />
                  <span style={{ fontSize: "13px", color: "var(--text-primary)", fontWeight: 500 }}>Share with all users (recommended)</span>
                </label>
              </div>

              {!shareWithAll && approvedUsers && approvedUsers.length > 0 && (
                <div className="form-group" style={{ margin: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
                  <label className="form-label" style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Select Specific Users to Share With</label>
                  <div style={{
                    maxHeight: "150px",
                    overflowY: "auto",
                    backgroundColor: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "8px",
                    padding: "8px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px"
                  }} className="custom-scrollbar">
                    {approvedUsers.map((user: any) => {
                      const isChecked = selectedUserIds.includes(user.id);
                      return (
                        <label 
                          key={user.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "6px 8px",
                            borderRadius: "6px",
                            cursor: "pointer",
                            transition: "background-color 0.2s",
                            backgroundColor: isChecked ? "rgba(99, 102, 241, 0.05)" : "transparent"
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flexGrow: 1 }}>
                            <input 
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setSelectedUserIds(selectedUserIds.filter(id => id !== user.id));
                                } else {
                                  setSelectedUserIds([...selectedUserIds, user.id]);
                                }
                              }}
                              style={{ width: "14px", height: "14px", cursor: "pointer", accentColor: "var(--accent-indigo)" }}
                            />
                            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                              <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</span>
                              <span style={{ fontSize: "11px", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</span>
                            </div>
                          </div>
                          <span style={{
                            fontSize: "10px",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            backgroundColor: user.role === "admin" ? "rgba(239, 68, 68, 0.1)" : user.role === "manager" ? "rgba(245, 158, 11, 0.1)" : "rgba(99, 102, 241, 0.1)",
                            color: user.role === "admin" ? "#f87171" : user.role === "manager" ? "#fbbf24" : "#818cf8"
                          }}>
                            {user.role}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px" }}>
                <button type="button" onClick={() => setProjectModalOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Add Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RENAME PROJECT POPUP MODAL */}
      {renameProjectModalOpen && selectedProjectToEdit && (
        <div className="modal-overlay">
          <div className="modal animate-scale-up">
            <h3 style={{ fontSize: "18px", fontWeight: "700" }}>Rename Project</h3>
            <form onSubmit={handleRenameProject} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Project Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={editProjectName}
                  onChange={(e) => setEditProjectName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Client Name (Optional)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={editProjectClient}
                  onChange={(e) => setEditProjectClient(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ margin: 0, marginTop: "4px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", userSelect: "none" }}>
                  <input 
                    type="checkbox" 
                    checked={editShareWithAll}
                    onChange={(e) => setEditShareWithAll(e.target.checked)}
                    style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: "var(--accent-indigo)" }}
                  />
                  <span style={{ fontSize: "13px", color: "var(--text-primary)", fontWeight: 500 }}>Share with all users (recommended)</span>
                </label>
              </div>

              {!editShareWithAll && approvedUsers && approvedUsers.length > 0 && (
                <div className="form-group" style={{ margin: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
                  <label className="form-label" style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Select Specific Users to Share With</label>
                  <div style={{
                    maxHeight: "150px",
                    overflowY: "auto",
                    backgroundColor: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "8px",
                    padding: "8px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px"
                  }} className="custom-scrollbar">
                    {approvedUsers.map((user: any) => {
                      const isChecked = editSelectedUserIds.includes(user.id);
                      return (
                        <label 
                          key={user.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "6px 8px",
                            borderRadius: "6px",
                            cursor: "pointer",
                            transition: "background-color 0.2s",
                            backgroundColor: isChecked ? "rgba(99, 102, 241, 0.05)" : "transparent"
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flexGrow: 1 }}>
                            <input 
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setEditSelectedUserIds(editSelectedUserIds.filter(id => id !== user.id));
                                } else {
                                  setEditSelectedUserIds([...editSelectedUserIds, user.id]);
                                }
                              }}
                              style={{ width: "14px", height: "14px", cursor: "pointer", accentColor: "var(--accent-indigo)" }}
                            />
                            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                              <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</span>
                              <span style={{ fontSize: "11px", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</span>
                            </div>
                          </div>
                          <span style={{
                            fontSize: "10px",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            backgroundColor: user.role === "admin" ? "rgba(239, 68, 68, 0.1)" : user.role === "manager" ? "rgba(245, 158, 11, 0.1)" : "rgba(99, 102, 241, 0.1)",
                            color: user.role === "admin" ? "#f87171" : user.role === "manager" ? "#fbbf24" : "#818cf8"
                          }}>
                            {user.role}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px" }}>
                <button type="button" onClick={() => {
                  setRenameProjectModalOpen(false);
                  setSelectedProjectToEdit(null);
                }} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE PROJECT POPUP MODAL */}
      {deleteProjectModalOpen && selectedProjectToDelete && (
        <div className="modal-overlay">
          <div className="modal animate-scale-up">
            <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--accent-destructive)" }}>Delete Project?</h3>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)", margin: 0, lineHeight: "1.5" }}>
              Are you sure you want to delete the project <strong>{selectedProjectToDelete.name}</strong>?
            </p>
            <div style={{ padding: "12px", backgroundColor: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "8px", fontSize: "12px", color: "var(--accent-destructive)", lineHeight: "1.4" }}>
              <strong>WARNING:</strong> This action cannot be undone. All folders and physical files inside this project will be permanently deleted from Cloudflare R2 and the database.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px" }}>
              <button type="button" onClick={() => {
                setDeleteProjectModalOpen(false);
                setSelectedProjectToDelete(null);
              }} className="btn-secondary">
                Cancel
              </button>
              <button 
                onClick={handleDeleteProject} 
                className="btn-primary" 
                style={{ backgroundColor: "var(--accent-destructive)" }}
                autoFocus
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
      {/* UNIFIED CUSTOM CONFIRM DIALOG MODAL */}
      {confirmModal && confirmModal.open && (
        <div className="modal-overlay">
          <div className="modal animate-scale-up">
            <h3 style={{ fontSize: "18px", fontWeight: "700", color: confirmModal.confirmColor || "var(--accent-destructive)" }}>
              {confirmModal.title}
            </h3>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)", margin: 0, lineHeight: "1.5" }}>
              {confirmModal.message}
            </p>
            {confirmModal.warning && (
              <div style={{ padding: "12px", backgroundColor: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "8px", fontSize: "12px", color: "var(--accent-destructive)", lineHeight: "1.4" }}>
                <strong>WARNING:</strong> {confirmModal.warning}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px" }}>
              <button 
                type="button" 
                onClick={() => setConfirmModal((prev) => prev ? { ...prev, open: false } : null)} 
                className="btn-secondary"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(null);
                }} 
                className="btn-primary" 
                style={{ backgroundColor: confirmModal.confirmColor || "var(--accent-destructive)" }}
                autoFocus
              >
                {confirmModal.confirmText || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM CONTEXT MENU */}
      {contextMenu && contextMenu.visible && (
        <div 
          className="custom-context-menu animate-scale-up" 
          style={{ top: contextMenu.y, left: contextMenu.x, position: "fixed" }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === "folder" ? (
            <>
              <button 
                onClick={() => {
                  navigateToFolder(contextMenu.item);
                  setContextMenu(null);
                }}
                className="context-menu-item"
              >
                <FolderOpen size={16} />
                <span>Open Folder</span>
              </button>
              {explorerMode !== "archive" && (
                <button 
                  onClick={() => {
                    handleOpenRename(contextMenu.item, "folder");
                    setContextMenu(null);
                  }}
                  className="context-menu-item"
                >
                  <Edit2 size={16} />
                  <span>Rename</span>
                </button>
              )}
              <button 
                onClick={() => {
                  handleOpenInfo(contextMenu.item, "folder");
                  setContextMenu(null);
                }}
                className="context-menu-item"
              >
                <Info size={16} />
                <span>Get Info</span>
              </button>
              <button 
                onClick={() => {
                  handleCopyFolderLink(contextMenu.item);
                  setContextMenu(null);
                }}
                className="context-menu-item"
              >
                <LinkIcon size={16} />
                <span>Copy Share Link</span>
              </button>
              {isAdmin && explorerMode !== "archive" && (
                <button 
                  onClick={() => {
                    handleDeleteFolder(contextMenu.item.id, contextMenu.item.name);
                    setContextMenu(null);
                  }}
                  className="context-menu-item delete"
                >
                  <Trash2 size={16} />
                  <span>Delete Folder</span>
                </button>
              )}
            </>
          ) : (
            <>
              <button 
                onClick={() => {
                  handleOpenPreview(contextMenu.item);
                  setContextMenu(null);
                }}
                className="context-menu-item"
              >
                <Eye size={16} />
                <span>Preview File</span>
              </button>
              <button 
                onClick={() => {
                  handleDownloadFile(contextMenu.item.id);
                  setContextMenu(null);
                }}
                className="context-menu-item"
              >
                <Download size={16} />
                <span>Download</span>
              </button>
              <button 
                onClick={() => {
                  handleCopyLink(contextMenu.item);
                  setContextMenu(null);
                }}
                className="context-menu-item"
              >
                <LinkIcon size={16} />
                <span>Copy Link</span>
              </button>
              {explorerMode !== "archive" && (() => {
                const filename = contextMenu.item?.filename || "";
                const isEditable = 
                  filename.endsWith(".txt") || 
                  filename.endsWith(".md") || 
                  filename.endsWith(".html") || 
                  filename.endsWith(".sheet.json");
                
                if (isEditable) {
                  return (
                    <button 
                      onClick={() => {
                        const asset = contextMenu.item;
                        if (filename.endsWith(".sheet.json")) {
                          handleOpenSheetEditor(asset);
                        } else if (filename.endsWith(".html")) {
                          handleOpenDocsEditor(asset);
                        } else {
                          handleOpenTextEditor(asset);
                        }
                        setContextMenu(null);
                      }}
                      className="context-menu-item"
                      style={{ color: "var(--accent-indigo)" }}
                    >
                      <Edit2 size={16} />
                      <span>Edit File</span>
                    </button>
                  );
                }
                return null;
              })()}
              {explorerMode !== "archive" && (
                <button 
                  onClick={() => {
                    handleOpenRename(contextMenu.item, "file");
                    setContextMenu(null);
                  }}
                  className="context-menu-item"
                >
                  <Edit2 size={16} />
                  <span>Rename</span>
                </button>
              )}
              <button 
                onClick={() => {
                  handleOpenInfo(contextMenu.item, "file");
                  setContextMenu(null);
                }}
                className="context-menu-item"
              >
                <Info size={16} />
                <span>Get Info</span>
              </button>
              {isAdmin && explorerMode !== "archive" && (
                <button 
                  onClick={() => {
                    handleDeleteFile(contextMenu.item.id);
                    setContextMenu(null);
                  }}
                  className="context-menu-item delete"
                >
                  <Trash2 size={16} />
                  <span>Delete File</span>
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* RENAME POPUP MODAL */}
      {renameModalOpen && renameTarget && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{ fontSize: "18px", fontWeight: "700" }}>
              Rename {renameTarget.type === "file" ? "File" : "Folder"}
            </h3>
            <form onSubmit={handleRenameSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">New Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px" }}>
                <button 
                  type="button" 
                  onClick={() => {
                    setRenameModalOpen(false);
                    setRenameTarget(null);
                  }} 
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GET INFO POPUP MODAL */}
      {infoModalOpen && infoTarget && (
        <div className="modal-overlay" onClick={() => { setInfoModalOpen(false); setInfoTarget(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "460px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px" }}>
              {infoTarget.type === "folder" ? (
                <Folder className="folder-icon" size={28} />
              ) : (
                <File className="file-icon" size={28} />
              )}
              <h3 style={{ fontSize: "18px", fontWeight: "700", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {infoTarget.type === "folder" ? infoTarget.item.name : infoTarget.item.filename}
              </h3>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "14px", marginTop: "8px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "120px 1fr" }}>
                <span style={{ color: "var(--text-secondary)", fontWeight: "500" }}>Type:</span>
                <span style={{ color: "var(--text-primary)" }}>
                  {infoTarget.type === "folder" ? "Folder / Directory" : infoTarget.item.mimeType || "Unknown Binary File"}
                </span>
              </div>

              {infoTarget.type === "file" && (
                <div style={{ display: "grid", gridTemplateColumns: "120px 1fr" }}>
                  <span style={{ color: "var(--text-secondary)", fontWeight: "500" }}>Size:</span>
                  <span style={{ color: "var(--text-primary)" }}>{formatBytes(infoTarget.item.size)}</span>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "120px 1fr" }}>
                <span style={{ color: "var(--text-secondary)", fontWeight: "500" }}>Storage Bucket:</span>
                <span style={{ color: "var(--text-primary)" }}>
                  {explorerMode === "shared" ? "video-assets (NAS Direct)" : "motionsewa-drive (Personal)"}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "120px 1fr" }}>
                <span style={{ color: "var(--text-secondary)", fontWeight: "500" }}>Physical Path:</span>
                <span style={{ color: "var(--text-primary)", fontFamily: "monospace", fontSize: "11px", wordBreak: "break-all" }}>
                  {infoTarget.item.id}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "120px 1fr" }}>
                <span style={{ color: "var(--text-secondary)", fontWeight: "500" }}>Uploaded At:</span>
                <span style={{ color: "var(--text-primary)" }}>
                  {infoTarget.item.uploadedAt ? new Date(infoTarget.item.uploadedAt).toLocaleString() : "Unknown Date"}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "120px 1fr" }}>
                <span style={{ color: "var(--text-secondary)", fontWeight: "500" }}>Uploaded By:</span>
                <span style={{ color: "var(--text-primary)" }}>
                  {infoTarget.item.uploadedBy || "Creator"}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
              <button 
                type="button" 
                onClick={() => {
                  setInfoModalOpen(false);
                  setInfoTarget(null);
                }} 
                className="btn-primary"
                style={{ height: "36px", padding: "0 20px" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FILE PREVIEW MODAL */}
      {previewModalOpen && previewTarget && (
        <div className="modal-overlay" onClick={() => { setPreviewModalOpen(false); setPreviewTarget(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "80vw", width: "800px", background: "var(--bg-secondary)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <File className="file-icon" size={22} />
                <h3 style={{ fontSize: "16px", fontWeight: "700", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "450px" }}>
                  Preview: {previewTarget.filename}
                </h3>
              </div>
              <button 
                onClick={() => { setPreviewModalOpen(false); setPreviewTarget(null); }}
                className="btn-icon"
                title="Close Preview"
              >
                <ChevronRight size={20} style={{ transform: "rotate(90deg)" }} />
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "200px", maxHeight: "70vh", overflow: "hidden" }}>
              {previewLoading ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                  <Loader2 className="animate-spin brand-accent" size={32} />
                  <span>Loading Preview...</span>
                </div>
              ) : (
                <>
                  {["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(previewTarget.filename.split(".").pop()?.toLowerCase() || "") ? (
                    <img 
                      src={previewUrl} 
                      alt={previewTarget.filename} 
                      style={{ maxWidth: "100%", maxHeight: "65vh", objectFit: "contain", borderRadius: "8px" }} 
                    />
                  ) : ["mp4", "mkv", "mov", "avi", "webm", "ogg"].includes(previewTarget.filename.split(".").pop()?.toLowerCase() || "") ? (
                    <video 
                      src={previewUrl} 
                      controls 
                      autoPlay 
                      style={{ maxWidth: "100%", maxHeight: "65vh", borderRadius: "8px" }} 
                    />
                  ) : ["txt", "md", "json", "js", "ts", "css", "html", "csv", "xml", "yaml", "yml"].includes(previewTarget.filename.split(".").pop()?.toLowerCase() || "") ? (
                    <pre style={{ width: "100%", maxHeight: "65vh", overflow: "auto", padding: "16px", backgroundColor: "var(--bg-primary)", borderRadius: "8px", fontSize: "13px", fontFamily: "monospace", textAlign: "left", whiteSpace: "pre-wrap", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                      {previewTextContent}
                    </pre>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", padding: "32px 16px" }}>
                      <File size={64} style={{ color: "var(--text-muted)" }} />
                      <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
                        No direct preview available for this file type ({previewTarget.mimeType}).
                      </p>
                      <button 
                        onClick={() => {
                          handleDownloadFile(previewTarget.id);
                          setPreviewModalOpen(false);
                          setPreviewTarget(null);
                        }}
                        className="btn-primary"
                        style={{ display: "flex", alignItems: "center", gap: "8px", height: "38px" }}
                      >
                        <Download size={16} />
                        <span>Download File</span>
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* HIDDEN FILE/FOLDER SELECT INPUTS */}
      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: "none" }} 
        multiple 
        onChange={handleFileUpload}
      />
      <input 
        type="file" 
        ref={folderInputRef} 
        style={{ display: "none" }} 
        webkitdirectory="true"
        directory=""
        multiple 
        onChange={handleFolderUpload}
        {...({ webkitdirectory: "", directory: "" } as any)}
      />

      {/* PLAIN TEXT CREATOR / EDITOR MODAL */}
      {textModalOpen && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: "800px", width: "90vw" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "700" }}>
                {textEditorMode === "create" ? "Create Text File" : "Edit Text File"}
              </h3>
            </div>
            <form onSubmit={handleSaveTextFile} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Filename</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={textFileName}
                  onChange={(e) => setTextFileName(e.target.value)}
                  placeholder="e.g. notes.txt"
                  required
                  disabled={textEditorMode === "edit"}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">File Content</label>
                <textarea 
                  className="form-input" 
                  style={{ fontFamily: "monospace", minHeight: "350px", resize: "vertical", fontSize: "14px", lineHeight: "1.5", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Start typing your text here..."
                  autoFocus
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                <button 
                  type="button" 
                  onClick={() => setTextModalOpen(false)} 
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save File
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUILL DOCS RICH-TEXT MODAL */}
      {docsModalOpen && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: "900px", width: "95vw", maxHeight: "95vh", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "700" }}>
                {docsEditorMode === "create" ? "Create Rich Document" : "Edit Rich Document"}
              </h3>
            </div>
            <form onSubmit={handleSaveDocsFile} style={{ display: "flex", flexDirection: "column", gap: "16px", flex: 1, overflow: "hidden" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Document Title</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="e.g. Project Proposal"
                  required
                  disabled={docsEditorMode === "edit"}
                />
              </div>
              
              <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: "350px", overflow: "hidden", backgroundColor: "#fff", color: "#333", borderRadius: "8px" }} className="quill-editor-wrapper">
                <div ref={editorContainerRef} style={{ flex: 1, overflow: "auto" }} />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px" }}>
                <button 
                  type="button" 
                  onClick={() => setDocsModalOpen(false)} 
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Document
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SPREADSHEET SHEET MODAL */}
      {sheetModalOpen && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: "1000px", width: "95vw", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "700" }}>
                {sheetEditorMode === "create" ? "Create Blank Sheet" : "Edit Spreadsheet"}
              </h3>
            </div>
            <form onSubmit={handleSaveSheetFile} style={{ display: "flex", flexDirection: "column", gap: "16px", flex: 1, overflow: "hidden" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Spreadsheet Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={sheetName}
                  onChange={(e) => setSheetName(e.target.value)}
                  placeholder="e.g. Budget 2026"
                  required
                  disabled={sheetEditorMode === "edit"}
                />
              </div>
              
              <div style={{ flex: 1, overflow: "auto", border: "1px solid var(--border-color)", borderRadius: "8px", backgroundColor: "var(--bg-primary)" }} className="sheet-grid-wrapper">
                <table className="spreadsheet-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr>
                      <th style={{ width: "40px", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)", padding: "6px", color: "var(--text-secondary)", textAlign: "center", position: "sticky", top: 0 }}>#</th>
                      {columnsList.map((col) => (
                        <th key={col} style={{ width: "100px", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)", padding: "6px", color: "var(--text-secondary)", textAlign: "center", position: "sticky", top: 0 }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: rowsCount }).map((_, rIdx) => {
                      const rowNumber = rIdx + 1;
                      return (
                        <tr key={rowNumber}>
                          <td style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)", padding: "6px", color: "var(--text-secondary)", fontWeight: "bold", textAlign: "center" }}>{rowNumber}</td>
                          {columnsList.map((col) => {
                            const refKey = `${col}${rowNumber}`;
                            return (
                              <td key={col} style={{ border: "1px solid var(--border-color)", padding: 0 }}>
                                <input 
                                  type="text" 
                                  style={{ width: "100%", border: "none", outline: "none", padding: "8px", backgroundColor: "transparent", color: "var(--text-primary)", fontSize: "13px", fontFamily: "inherit" }}
                                  value={sheetCells[refKey] || ""}
                                  onChange={(e) => handleCellChange(col, rowNumber, e.target.value)}
                                  placeholder=""
                                />
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px" }}>
                <button 
                  type="button" 
                  onClick={() => setSheetModalOpen(false)} 
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Sheet
                </button>
              </div>
            </form>
          </div>
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

            <div className="bulk-bar-actions">
              {explorerMode !== "archive" && (
                <>
                  <button 
                    onClick={() => handleOpenDestinationPicker("copy")}
                    className="btn-bulk btn-bulk-copy"
                    title="Copy selected items to a folder"
                  >
                    <Copy size={16} />
                    <span>Copy</span>
                  </button>

                  <button 
                    onClick={() => handleOpenDestinationPicker("move")}
                    className="btn-bulk btn-bulk-move"
                    title="Move selected items to a folder"
                  >
                    <FolderInput size={16} />
                    <span>Move</span>
                  </button>
                </>
              )}

              {isAdmin && explorerMode !== "archive" && (
                <button 
                  onClick={handleBulkDelete}
                  className="btn-bulk btn-bulk-delete"
                  title="Permanently delete selected items"
                >
                  <Trash2 size={16} />
                  <span>Delete</span>
                </button>
              )}

              {explorerMode !== "archive" && <div className="bulk-bar-divider" />}

              <button 
                onClick={handleClearSelection}
                className="btn-icon bulk-bar-close"
                title="Clear Selection"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DESTINATION PICKER MODAL */}
      {destinationPickerOpen && (
        <div className="modal-overlay" onClick={() => setDestinationPickerOpen(false)}>
          <div className="modal picker-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "560px", width: "90vw" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <FolderInput size={22} className="brand-accent" />
                <h3 style={{ fontSize: "18px", fontWeight: "700" }}>
                  Select Destination for {pickerAction === "copy" ? "Copy" : "Move"}
                </h3>
              </div>
              <button 
                onClick={() => setDestinationPickerOpen(false)}
                className="btn-icon"
                title="Close Destination Picker"
              >
                <X size={20} />
              </button>
            </div>

            {/* Drive Toggle Tabs */}
            <div className="picker-tabs" style={{ display: "flex", gap: "4px", padding: "4px", backgroundColor: "var(--bg-primary)", borderRadius: "8px", border: "1px solid var(--border-color)", marginBottom: "16px" }}>
              <button
                type="button"
                onClick={() => handleTogglePickerDriveMode("personal")}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: pickerDriveMode === "personal" ? "var(--border-color)" : "transparent",
                  color: pickerDriveMode === "personal" ? "var(--text-primary)" : "var(--text-secondary)",
                  fontWeight: pickerDriveMode === "personal" ? "600" : "500",
                  fontSize: "13px",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                My Drive (Personal)
              </button>
              <button
                type="button"
                onClick={() => handleTogglePickerDriveMode("shared")}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: pickerDriveMode === "shared" ? "var(--border-color)" : "transparent",
                  color: pickerDriveMode === "shared" ? "var(--text-primary)" : "var(--text-secondary)",
                  fontWeight: pickerDriveMode === "shared" ? "600" : "500",
                  fontSize: "13px",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                Shared Drive
              </button>
            </div>

            {/* Picker Breadcrumbs */}
            <div className="picker-breadcrumbs" style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "6px", marginBottom: "16px", padding: "8px 12px", background: "var(--bg-primary)", borderRadius: "8px", border: "1px solid var(--border-color)", fontSize: "13px" }}>
              <span 
                className={`picker-breadcrumb-item ${pickerFolderPath.length === 0 ? "active" : ""}`}
                style={{ cursor: "pointer", color: pickerFolderPath.length === 0 ? "var(--brand-accent)" : "var(--text-secondary)", fontWeight: "500" }}
                onClick={() => handlePickerBreadcrumbClick(-1)}
              >
                {pickerDriveMode === "shared" ? "Shared Drive" : "My Drive"}
              </span>
              {pickerFolderPath.map((item, index) => (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <ChevronRight size={14} style={{ opacity: 0.5 }} />
                  <span 
                    className={`picker-breadcrumb-item ${index === pickerFolderPath.length - 1 ? "active" : ""}`}
                    style={{ cursor: "pointer", color: index === pickerFolderPath.length - 1 ? "var(--brand-accent)" : "var(--text-secondary)", fontWeight: "500", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "120px" }}
                    onClick={() => handlePickerBreadcrumbClick(index)}
                  >
                    {item.name}
                  </span>
                </div>
              ))}
            </div>

            {/* Picker Directories List */}
            <div className="picker-dir-container" style={{ minHeight: "260px", maxHeight: "380px", overflowY: "auto", border: "1px solid var(--border-color)", borderRadius: "8px", backgroundColor: "var(--bg-primary)", padding: "8px" }}>
              {pickerLoading ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "240px", gap: "12px" }}>
                  <Loader2 className="animate-spin brand-accent" size={28} />
                  <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Loading directories...</span>
                </div>
              ) : pickerFolders.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "240px", color: "var(--text-muted)", gap: "8px" }}>
                  <FolderOpen size={36} style={{ opacity: 0.4 }} />
                  <span style={{ fontSize: "14px" }}>No folders in this directory</span>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {pickerFolders.map((folder) => (
                    <button
                      key={folder.id}
                      onClick={() => handlePickerNavigate(folder)}
                      className="picker-dir-row"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        width: "100%",
                        padding: "10px 12px",
                        background: "none",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        color: "var(--text-primary)",
                        textAlign: "left",
                        gap: "10px",
                        transition: "background 0.2s"
                      }}
                    >
                      <Folder size={18} style={{ color: "var(--brand-accent)", flexShrink: 0 }} />
                      <span style={{ fontSize: "14px", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {folder.name}
                      </span>
                      <ChevronRight size={14} style={{ opacity: 0.5 }} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Target Display and Triggers */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "20px", paddingTop: "16px", borderTop: "1px solid var(--border-color)" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px", maxWidth: "60%" }}>
                <span style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Target Destination:</span>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {pickerFolderPath.length === 0 
                    ? (pickerDriveMode === "shared" ? "Shared Drive root" : "My Drive (root)")
                    : pickerFolderPath[pickerFolderPath.length - 1].name
                  }
                </span>
              </div>
              <div style={{ display: "flex", gap: "12px" }}>
                <button 
                  type="button" 
                  onClick={() => setDestinationPickerOpen(false)} 
                  className="btn-secondary"
                  style={{ height: "38px" }}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleExecutePickerAction}
                  className="btn-primary"
                  style={{ height: "38px", padding: "0 20px" }}
                >
                  {pickerAction === "copy" ? "Copy Here" : "Move Here"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TOAST OVERLAY */}
      {toastMessage && (
        <div className={`toast toast-${toastType} animate-fade-in-up`}>
          {toastType === "success" && <CheckCircle size={16} />}
          {toastType === "error" && <AlertTriangle size={16} />}
          {toastType === "info" && <Info size={16} />}
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

export default function DrivePage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", height: "100vh", width: "100vw", alignItems: "center", justifyContent: "center", background: "var(--bg-main)", color: "var(--text-main)" }}>
        <Loader2 size={32} style={{ animation: "spin 1s linear infinite", color: "var(--accent-primary)" }} />
      </div>
    }>
      <DrivePageContent />
    </Suspense>
  );
}
