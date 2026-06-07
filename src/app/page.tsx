"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { 
  createFolder, 
  deleteFolder,
  createProject, 
  listProjects, 
  renameProject,
  deleteProject,
  listDriveContents, 
  getDownloadUrl, 
  deleteAsset,
  initiateMultipartUpload,
  getPresignedPartUrls,
  completeMultipartUpload,
  listSharedDriveContents,
  createSharedFolder,
  deleteSharedAsset,
  deleteSharedFolder,
  getSharedDownloadUrl,
  renameAsset,
  renameFolder,
  renameSharedAsset,
  renameSharedFolder,
  bulkDeleteItems,
  bulkMoveItems,
  bulkCopyItems
} from "@/app/actions/drive";
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
  ChevronRight, 
  LogOut, 
  Sliders, 
  Loader2,
  Share2,
  FolderOpen,
  Edit2,
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
  Copy
} from "lucide-react";
import Link from "next/link";
import "./drive.css";

export default function DrivePage() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Dual-Drive State
  const [explorerMode, setExplorerMode] = useState<"personal" | "shared">("personal");
  const [sharedFolderPath, setSharedFolderPath] = useState<string[]>([]);

  // Drive Navigation State
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<{ id: string | null; name: string }[]>([]);

  // Explorer Contents
  const [folders, setFolders] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectClient, setNewProjectClient] = useState("");

  // Upload Drawer State
  const [uploadProgress, setUploadProgress] = useState<{ [filename: string]: number }>({});
  const [uploadActive, setUploadActive] = useState(false);

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

  // Blank Sheet Editor State
  const [sheetModalOpen, setSheetModalOpen] = useState(false);
  const [sheetName, setSheetName] = useState("");
  const [sheetCells, setSheetCells] = useState<{ [key: string]: string }>({});
  const [sheetEditorMode, setSheetEditorMode] = useState<"create" | "edit">("create");
  const [sheetEditorAsset, setSheetEditorAsset] = useState<any | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

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

  // Copy Direct Link to Clipboard
  const handleCopyLink = async (asset: any) => {
    try {
      const { downloadUrl } = explorerMode === "shared"
        ? await getSharedDownloadUrl(asset.id)
        : await getDownloadUrl(asset.id);

      await navigator.clipboard.writeText(downloadUrl);
      showToast("Download URL copied to clipboard!", "success");
    } catch (err) {
      showToast("Failed to generate download URL", "error");
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

        // Reload shared contents
        const prefix = sharedFolderPath.length > 0 ? sharedFolderPath.join("/") + "/" : "";
        const { folders: loadedFolders, assets: loadedAssets } = await listSharedDriveContents(prefix);
        setFolders(loadedFolders);
        setAssets(loadedAssets);
      } else {
        // Personal Drive (Database Rename)
        if (type === "file") {
          await renameAsset(item.id, nameInput);
          showToast(`File renamed to ${nameInput}`, "success");
        } else {
          await renameFolder(item.id, nameInput);
          showToast(`Folder renamed to ${nameInput}`, "success");
        }

        // Reload personal contents
        const { folders: loadedFolders, assets: loadedAssets } = await listDriveContents({
          projectId: selectedProjectId,
          folderId: currentFolderId
        });
        setFolders(loadedFolders);
        setAssets(loadedAssets);
      }
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

      // Load initial Drive data
      try {
        const loadedProjects = await listProjects();
        setProjects(loadedProjects);
        setFolderPath([{ id: null, name: "My Drive" }]);
      } catch (err) {
        console.error("Failed to load projects", err);
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, [router]);

  // Load folder contents whenever workspace scope or active drive mode changes
  useEffect(() => {
    if (loading || !session) return;

    async function loadContents() {
      try {
        if (explorerMode === "shared") {
          const prefix = sharedFolderPath.length > 0 ? sharedFolderPath.join("/") + "/" : "";
          const { folders: loadedFolders, assets: loadedAssets } = await listSharedDriveContents(prefix);
          setFolders(loadedFolders);
          setAssets(loadedAssets);
        } else {
          const { folders: loadedFolders, assets: loadedAssets } = await listDriveContents({
            projectId: selectedProjectId,
            folderId: currentFolderId
          });
          setFolders(loadedFolders);
          setAssets(loadedAssets);
        }
      } catch (err) {
        console.error("Failed to load drive contents", err);
      }
    }
    loadContents();
  }, [selectedProjectId, currentFolderId, explorerMode, sharedFolderPath, loading, session]);

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
        setNewFolderName("");
        setFolderModalOpen(false);

        // Reload folders
        const { folders: loadedFolders } = await listSharedDriveContents(prefix);
        setFolders(loadedFolders);
      } else {
        await createFolder(newFolderName.trim(), selectedProjectId || undefined, currentFolderId);
        setNewFolderName("");
        setFolderModalOpen(false);

        // Reload folders
        const { folders: loadedFolders } = await listDriveContents({
          projectId: selectedProjectId,
          folderId: currentFolderId
        });
        setFolders(loadedFolders);
      }
      showToast("Folder created successfully!", "success");
    } catch (err) {
      showToast("Failed to create folder", "error");
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    try {
      await createProject(newProjectName.trim(), newProjectClient.trim() || undefined);
      setNewProjectName("");
      setNewProjectClient("");
      setProjectModalOpen(false);

      // Reload projects list
      const loadedProjects = await listProjects();
      setProjects(loadedProjects);
      showToast("Project created successfully!", "success");
    } catch (err) {
      showToast("Failed to create project", "error");
    }
  };

  const handleRenameProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectToEdit || !editProjectName.trim()) return;

    try {
      await renameProject(selectedProjectToEdit.id, editProjectName.trim(), editProjectClient.trim() || undefined);
      setRenameProjectModalOpen(false);
      setSelectedProjectToEdit(null);
      setEditProjectName("");
      setEditProjectClient("");

      // Reload projects list
      const loadedProjects = await listProjects();
      setProjects(loadedProjects);
      showToast("Project renamed successfully!", "success");
    } catch (err) {
      showToast("Failed to rename project", "error");
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

      // Reload projects list
      const loadedProjects = await listProjects();
      setProjects(loadedProjects);
      showToast("Project deleted successfully!", "success");
    } catch (err) {
      showToast("Failed to delete project", "error");
    }
  };

  // Click on Folder
  const navigateToFolder = (folder: { id: string; name: string; isR2Physical?: boolean }) => {
    if (folder.isR2Physical) {
      const parts = folder.id.split("/").filter(Boolean);
      setSharedFolderPath(parts);
    } else {
      setCurrentFolderId(folder.id);
      setFolderPath((prev) => [...prev, { id: folder.id, name: folder.name }]);
    }
  };

  // Click on Project (forces Personal mode)
  const selectProject = (projectId: string | null, projectName: string) => {
    setExplorerMode("personal");
    setSelectedProjectId(projectId);
    setCurrentFolderId(null);
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
    setExplorerMode("shared");
    setSharedFolderPath([]);
    setSelectedProjectId(null);
    setCurrentFolderId(null);
  };

  // Click Breadcrumb
  const handleBreadcrumbClick = (index: number) => {
    const item = folderPath[index];
    if (index === 0) {
      setSelectedProjectId(null);
      setCurrentFolderId(null);
      setFolderPath([{ id: null, name: "My Drive" }]);
    } else if (item.id && item.id.startsWith("project-")) {
      const pId = item.id.replace("project-", "");
      setSelectedProjectId(pId);
      setCurrentFolderId(null);
      setFolderPath(folderPath.slice(0, index + 1));
    } else {
      setCurrentFolderId(item.id);
      setFolderPath(folderPath.slice(0, index + 1));
    }
  };

  const handleBreadcrumbClickShared = (path: string[]) => {
    setSharedFolderPath(path);
  };

  // Download File via Presigned URL
  const handleDownloadFile = async (assetId: string) => {
    try {
      const { downloadUrl, filename } = explorerMode === "shared"
        ? await getSharedDownloadUrl(assetId)
        : await getDownloadUrl(assetId);

      // Create a temporary anchor element to trigger high-speed direct uploader
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      showToast("Failed to download file", "error");
    }
  };

  // Delete File
  const handleDeleteFile = async (assetId: string) => {
    const targetBucketText = explorerMode === "shared" ? "shared Cloudflare R2 bucket (video-assets)" : "Web Drive and Cloudflare R2";
    
    setConfirmModal({
      open: true,
      title: "Delete File?",
      message: `Are you sure you want to delete this file from the ${targetBucketText}?`,
      warning: "This action cannot be undone.",
      confirmText: "Delete Permanently",
      confirmColor: "var(--accent-danger)",
      onConfirm: async () => {
        try {
          if (explorerMode === "shared") {
            await deleteSharedAsset(assetId);
            const prefix = sharedFolderPath.length > 0 ? sharedFolderPath.join("/") + "/" : "";
            const { assets: loadedAssets } = await listSharedDriveContents(prefix);
            setAssets(loadedAssets);
          } else {
            await deleteAsset(assetId);
            // Reload assets
            const { assets: loadedAssets } = await listDriveContents({
              projectId: selectedProjectId,
              folderId: currentFolderId
            });
            setAssets(loadedAssets);
          }
          showToast("File deleted successfully!", "success");
        } catch (err) {
          showToast("Failed to delete file", "error");
        }
      }
    });
  };

  // Delete Folder
  const handleDeleteFolder = async (folderId: string, folderName: string) => {
    setConfirmModal({
      open: true,
      title: "Delete Folder?",
      message: `Are you sure you want to delete folder "${folderName}"?`,
      warning: "All nested files and subfolders will be permanently deleted from the Web Drive and Cloudflare R2.",
      confirmText: "Delete Folder Permanently",
      confirmColor: "var(--accent-danger)",
      onConfirm: async () => {
        try {
          if (explorerMode === "shared") {
            await deleteSharedFolder(folderId);
            const prefix = sharedFolderPath.length > 0 ? sharedFolderPath.join("/") + "/" : "";
            const { folders: loadedFolders, assets: loadedAssets } = await listSharedDriveContents(prefix);
            setFolders(loadedFolders);
            setAssets(loadedAssets);
          } else {
            await deleteFolder(folderId);
            // Reload drive contents
            const { folders: loadedFolders, assets: loadedAssets } = await listDriveContents({
              projectId: selectedProjectId,
              folderId: currentFolderId
            });
            setFolders(loadedFolders);
            setAssets(loadedAssets);
          }
          showToast("Folder deleted successfully!", "success");
        } catch (err) {
          showToast("Failed to delete folder", "error");
        }
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
    if (folders.length === 0 && assets.length === 0) return false;
    const allFoldersSelected = folders.every(f => selectedFolderIds.has(f.id));
    const allAssetsSelected = assets.every(a => selectedAssetIds.has(a.id));
    return allFoldersSelected && allAssetsSelected;
  };

  // Handle "Select All" toggle
  const handleSelectAll = () => {
    if (isAllSelected()) {
      // Deselect all
      setSelectedFolderIds(prev => {
        const next = new Set(prev);
        folders.forEach(f => next.delete(f.id));
        return next;
      });
      setSelectedAssetIds(prev => {
        const next = new Set(prev);
        assets.forEach(a => next.delete(a.id));
        return next;
      });
    } else {
      // Select all in current view
      setSelectedFolderIds(prev => {
        const next = new Set(prev);
        folders.forEach(f => next.add(f.id));
        return next;
      });
      setSelectedAssetIds(prev => {
        const next = new Set(prev);
        assets.forEach(a => next.add(a.id));
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
      confirmColor: "var(--accent-danger)",
      onConfirm: async () => {
        setLoading(true);
        try {
          const isShared = explorerMode === "shared";
          await bulkDeleteItems({
            assetIds: Array.from(selectedAssetIds),
            folderIds: Array.from(selectedFolderIds),
            isSharedDrive: isShared
          });

          handleClearSelection();
          await refreshExplorerContents();
          showToast("Selected items deleted successfully!", "success");
        } catch (err) {
          console.error("Bulk delete failed", err);
          showToast("Failed to delete selected items", "error");
        } finally {
          setLoading(false);
        }
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
    setPickerAction(action);
    setPickerDriveMode(explorerMode);
    setPickerCurrentFolderId(null);
    setPickerFolderPath([]);
    setDestinationPickerOpen(true);
    await handleLoadPickerDirectories(null, null, explorerMode);
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

    setLoading(true);
    setDestinationPickerOpen(false);

    try {
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

      if (pickerAction === "move") {
        await bulkMoveItems({
          assetIds: Array.from(selectedAssetIds),
          folderIds: Array.from(selectedFolderIds),
          targetFolderId,
          targetProjectId,
          sourceIsSharedDrive,
          targetIsSharedDrive
        });
        showToast("Items moved successfully!", "success");
      } else if (pickerAction === "copy") {
        await bulkCopyItems({
          assetIds: Array.from(selectedAssetIds),
          folderIds: Array.from(selectedFolderIds),
          targetFolderId,
          targetProjectId,
          sourceIsSharedDrive,
          targetIsSharedDrive
        });
        showToast("Items copied successfully!", "success");
      }

      handleClearSelection();
      await refreshExplorerContents();
    } catch (err) {
      console.error(`Bulk ${pickerAction} failed`, err);
      showToast(`Failed to ${pickerAction} selected items`, "error");
    } finally {
      setLoading(false);
      setPickerAction(null);
    }
  };

  // ==========================================
  // MODULAR CORE UPLOAD & FOLDER RECREATOR
  // ==========================================

  const refreshExplorerContents = async () => {
    const isShared = explorerMode === "shared";
    const prefix = isShared ? (sharedFolderPath.length > 0 ? sharedFolderPath.join("/") + "/" : "") : "";
    if (isShared) {
      const { folders: loadedFolders, assets: loadedAssets } = await listSharedDriveContents(prefix);
      setFolders(loadedFolders);
      setAssets(loadedAssets);
    } else {
      const { folders: loadedFolders, assets: loadedAssets } = await listDriveContents({
        projectId: selectedProjectId,
        folderId: currentFolderId
      });
      setFolders(loadedFolders);
      setAssets(loadedAssets);
    }
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

    const isShared = explorerMode === "shared";

    try {
      // 10MB Chunks
      const CHUNK_SIZE = 10 * 1024 * 1024;
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

      // B. Get presigned URLs for each chunk
      const partNumbers = Array.from({ length: totalChunks }, (_, index) => index + 1);
      const { partUrls } = await getPresignedPartUrls({ 
        uploadId, 
        r2Key, 
        partNumbers,
        isSharedDrive: isShared
      });

      // C. Upload chunks to Cloudflare R2 directly in parallel batches
      const parts: { PartNumber: number; ETag: string }[] = [];
      const batchSize = 3; // Upload 3 chunks concurrently

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += batchSize) {
        const batch = [];
        for (let b = 0; b < batchSize && chunkIndex + b < totalChunks; b++) {
          const index = chunkIndex + b;
          const start = index * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunkSlice = file.slice(start, end);
          const presignedUrl = partUrls[index].url;

          batch.push(
            fetch(presignedUrl, {
              method: "PUT",
              body: chunkSlice,
            }).then(async (res) => {
              if (!res.ok) throw new Error(`Chunk ${index + 1} upload failed`);
              const etag = res.headers.get("ETag");
              if (!etag) throw new Error(`Etag missing from chunk ${index + 1}`);
              parts.push({ PartNumber: index + 1, ETag: etag });
              
              // Progress tracking
              const completedPartsCount = parts.length;
              setUploadProgress((prev) => ({
                ...prev,
                [filename]: Math.round((completedPartsCount / totalChunks) * 100)
              }));
            })
          );
        }
        await Promise.all(batch);
      }

      // D. Complete the Multipart upload on R2 and DB index
      await completeMultipartUpload({
        uploadId,
        r2Key,
        parts,
        assetId,
        isSharedDrive: isShared
      });

      return { success: true, r2Key, assetId };

    } catch (err) {
      console.error("Multipart upload failed for " + filename, err);
      showToast(`Failed to upload ${filename}`, "error");
      throw err;
    }
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
                (f) => f.name === folderName && f.parentId === activeParentId
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

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const triggerFolderSelect = () => {
    folderInputRef.current?.click();
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

  const filteredAssets = assets.filter((a) =>
    a.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      <div className="app-container" style={{ alignItems: "center", justifyContent: "center" }}>
        <Loader2 className="animate-spin brand-accent" size={42} />
        <h3 style={{ marginLeft: "16px" }}>Opening your Web Drive...</h3>
      </div>
    );
  }

  const isAdmin = (session?.user as any)?.role === "admin";

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

          <div style={{ marginTop: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", marginBottom: "8px" }}>
              <span className="section-title" style={{ margin: 0, fontSize: "11px" }}>Projects</span>
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

            {projects.map((proj) => {
              const isActive = explorerMode === "personal" && selectedProjectId === proj.id;
              return (
                <div 
                  key={proj.id}
                  className={`project-sidebar-item ${isActive ? "active" : ""}`}
                  onClick={() => {
                    selectProject(proj.id, proj.name);
                    setSidebarOpen(false);
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0, flexGrow: 1 }}>
                    <ChevronRight size={14} style={{ flexShrink: 0 }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{proj.name}</span>
                  </div>
                  <div className="project-sidebar-item-actions">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProjectToEdit(proj);
                        setEditProjectName(proj.name);
                        setEditProjectClient(proj.clientName || "");
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
            })}
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
            <h2 className="explorer-title">
              {explorerMode === "shared" 
                ? (sharedFolderPath[sharedFolderPath.length - 1] || "Shared Drive")
                : (folderPath[folderPath.length - 1]?.name || "My Drive")
              }
            </h2>
            <div className="explorer-actions" ref={newDropdownRef}>
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
            </div>
          </div>

          {/* FOLDERS GRID SECTION */}
          {folders.length > 0 && (
            <div style={{ marginBottom: "32px" }}>
              <h3 className="section-title">Folders</h3>
              <div className="folders-grid">
                {folders.map((folder) => {
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
                      {isAdmin && (
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

          {/* COMPLETED FILES TABLE SECTION */}
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

          {filteredAssets.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "180px", border: "1px dashed var(--border-color)", borderRadius: "12px", background: "var(--bg-secondary)", color: "var(--text-secondary)" }}>
              <File size={36} style={{ marginBottom: "12px" }} />
              <p style={{ fontSize: "14px" }}>No files uploaded here yet.</p>
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
                <div>Uploaded By</div>
                <div style={{ textAlign: "right" }}>Actions</div>
              </div>

              {filteredAssets.map((asset) => {
                const isAssetSelected = selectedAssetIds.has(asset.id);
                return (
                  <div 
                    key={asset.id} 
                    className={`file-row ${isAssetSelected ? "selected" : ""}`}
                    onContextMenu={(e) => handleContextMenu(e, asset, "file")}
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
                      <File className="file-icon" size={18} />
                      <span className="file-name" title={asset.filename}>{asset.filename}</span>
                    </div>

                    <div className="file-size">{formatBytes(asset.size)}</div>

                    <div className="file-date">{asset.uploadedBy || "Creator"}</div>

                    <div className="file-actions">
                      <button 
                        onClick={() => handleDownloadFile(asset.id)} 
                        className="btn-icon" 
                        title="Download File"
                      >
                        <Download size={16} />
                      </button>
                      {isAdmin && (
                        <button 
                          onClick={() => handleDeleteFile(asset.id)} 
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
      </main>

      {/* FLOATING MULTI-PART UPLOAD PROCESS DRAWER */}
      {uploadActive && (
        <div className="progress-drawer">
          <div className="drawer-header">
            <span className="drawer-title">Uploading Video Chunk(s)</span>
            <button onClick={() => setUploadActive(false)} className="btn-icon" style={{ padding: 2 }}>
              <ChevronRight size={14} style={{ transform: "rotate(90deg)" }} />
            </button>
          </div>
          <div className="drawer-body">
            {Object.entries(uploadProgress).map(([filename, progress]) => (
              <div key={filename} className="upload-item">
                <div className="upload-info">
                  <span className="upload-name">{filename}</span>
                  <span className="upload-percentage">{progress}%</span>
                </div>
                <div className="progress-track">
                  <div className="progress-bar" style={{ width: `${progress}%` }} />
                </div>
              </div>
            ))}
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
            <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--accent-danger)" }}>Delete Project?</h3>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)", margin: 0, lineHeight: "1.5" }}>
              Are you sure you want to delete the project <strong>{selectedProjectToDelete.name}</strong>?
            </p>
            <div style={{ padding: "12px", backgroundColor: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "8px", fontSize: "12px", color: "var(--accent-danger)", lineHeight: "1.4" }}>
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
                style={{ backgroundColor: "var(--accent-danger)" }}
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
            <h3 style={{ fontSize: "18px", fontWeight: "700", color: confirmModal.confirmColor || "var(--accent-danger)" }}>
              {confirmModal.title}
            </h3>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)", margin: 0, lineHeight: "1.5" }}>
              {confirmModal.message}
            </p>
            {confirmModal.warning && (
              <div style={{ padding: "12px", backgroundColor: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "8px", fontSize: "12px", color: "var(--accent-danger)", lineHeight: "1.4" }}>
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
                style={{ backgroundColor: confirmModal.confirmColor || "var(--accent-danger)" }}
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
              {isAdmin && (
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
              {(() => {
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
              {isAdmin && (
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

              {isAdmin && (
                <button 
                  onClick={handleBulkDelete}
                  className="btn-bulk btn-bulk-delete"
                  title="Permanently delete selected items"
                >
                  <Trash2 size={16} />
                  <span>Delete</span>
                </button>
              )}

              <div className="bulk-bar-divider" />

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
