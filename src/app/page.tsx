"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { 
  createFolder, 
  deleteFolder,
  createProject, 
  listProjects, 
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
  renameSharedFolder
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
  Eye,
  Link as LinkIcon
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

  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const showToast = (msg: string) => {
    setToastMessage(msg);
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
      showToast("Download URL copied to clipboard!");
    } catch (err) {
      alert("Failed to generate download URL");
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
          showToast(`File renamed to ${nameInput}`);
        } else {
          // Folder: renameTarget item.id is prefix e.g. "Wedding/" or "test/sub/"
          const oldPrefix = item.id;
          
          // To compute the new prefix, find the parent path
          const parts = oldPrefix.split("/").filter(Boolean);
          parts[parts.length - 1] = nameInput;
          const newPrefix = parts.join("/") + "/";

          await renameSharedFolder(oldPrefix, newPrefix);
          showToast(`Folder renamed to ${nameInput}`);
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
          showToast(`File renamed to ${nameInput}`);
        } else {
          await renameFolder(item.id, nameInput);
          showToast(`Folder renamed to ${nameInput}`);
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
      alert("Failed to rename target");
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
    } catch (err) {
      alert("Failed to create folder");
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
    } catch (err) {
      alert("Failed to create project");
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
      alert("Failed to download file");
    }
  };

  // Delete File
  const handleDeleteFile = async (assetId: string) => {
    const targetBucketText = explorerMode === "shared" ? "shared Cloudflare R2 bucket (video-assets)" : "Web Drive and Cloudflare R2";
    if (!confirm(`Are you sure you want to delete this file from the ${targetBucketText}?`)) return;

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
    } catch (err) {
      alert("Failed to delete file");
    }
  };

  // Delete Folder
  const handleDeleteFolder = async (folderId: string, folderName: string) => {
    if (!confirm(`Are you sure you want to delete folder "${folderName}"? All nested files and subfolders will be permanently deleted from the Web Drive and Cloudflare R2.`)) return;

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
    } catch (err) {
      alert("Failed to delete folder");
    }
  };

  // CHUNKED MULTI-PART DIRECT-TO-R2 UPLOAD
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadActive(true);

    const isShared = explorerMode === "shared";
    const prefix = isShared ? (sharedFolderPath.length > 0 ? sharedFolderPath.join("/") + "/" : "") : "";

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filename = file.name;
      setUploadProgress((prev) => ({ ...prev, [filename]: 0 }));

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
          folderId: currentFolderId,
          isSharedDrive: isShared,
          prefix: prefix
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

        for (let chunkIndex = 0; indexLimit(chunkIndex, totalChunks); chunkIndex += batchSize) {
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

        // Refresh Explorer Contents on finish
        if (isShared) {
          const { assets: loadedAssets } = await listSharedDriveContents(prefix);
          setAssets(loadedAssets);
        } else {
          const { assets: loadedAssets } = await listDriveContents({
            projectId: selectedProjectId,
            folderId: currentFolderId
          });
          setAssets(loadedAssets);
        }

      } catch (err) {
        console.error("Multipart upload failed for " + filename, err);
        alert(`Failed to upload ${filename}`);
      }
    }
  };

  const indexLimit = (index: number, total: number) => index < total;

  const filteredAssets = assets.filter((a) =>
    a.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
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
      <div className="app-container" style={{ alignItems: "center", justifyContent: "center" }}>
        <Loader2 className="animate-spin brand-accent" size={42} />
        <h3 style={{ marginLeft: "16px" }}>Opening your Web Drive...</h3>
      </div>
    );
  }

  const isAdmin = (session?.user as any)?.role === "admin";

  return (
    <div className="app-container">
      {/* SIDEBAR NAVIGATION */}
      <aside className="sidebar">
        <div className="brand">
          <LayoutGrid size={24} className="brand-accent" />
          <span>Motionsewa <span className="brand-accent">Drive</span></span>
        </div>

        <button onClick={triggerFileSelect} className="btn-upload-trigger">
          <UploadCloud size={20} />
          <span>Upload Video</span>
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: "none" }} 
          multiple 
          onChange={handleFileUpload}
        />

        <nav className="nav-links">
          <button 
            onClick={() => selectProject(null, "My Drive")} 
            className={`nav-link ${explorerMode === "personal" && selectedProjectId === null ? "active" : ""}`}
          >
            <LayoutGrid size={18} />
            <span>My Drive</span>
          </button>

          <button 
            onClick={selectSharedDrive} 
            className={`nav-link ${explorerMode === "shared" ? "active" : ""}`}
          >
            <Share2 size={18} />
            <span>Shared Drive</span>
          </button>

          <div style={{ marginTop: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", marginBottom: "8px" }}>
              <span className="section-title" style={{ margin: 0, fontSize: "11px" }}>Projects</span>
              <button onClick={() => setProjectModalOpen(true)} title="New Project" className="btn-icon">
                <Plus size={14} />
              </button>
            </div>

            {projects.map((proj) => (
              <button 
                key={proj.id}
                onClick={() => selectProject(proj.id, proj.name)}
                className={`nav-link ${explorerMode === "personal" && selectedProjectId === proj.id ? "active" : ""}`}
                style={{ paddingLeft: "24px" }}
              >
                <ChevronRight size={14} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{proj.name}</span>
              </button>
            ))}
          </div>

          {isAdmin && (
            <Link href="/admin" className="nav-link" style={{ marginTop: "24px" }}>
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
            <div className="explorer-actions">
              <button onClick={() => setFolderModalOpen(true)} className="btn-secondary">
                <FolderPlus size={18} />
                <span>New Folder</span>
              </button>
            </div>
          </div>

          {/* FOLDERS GRID SECTION */}
          {folders.length > 0 && (
            <div style={{ marginBottom: "32px" }}>
              <h3 className="section-title">Folders</h3>
              <div className="folders-grid">
                {folders.map((folder) => (
                  <div 
                    key={folder.id} 
                    className="folder-card"
                    onDoubleClick={() => navigateToFolder(folder)}
                    onClick={() => navigateToFolder(folder)}
                    onContextMenu={(e) => handleContextMenu(e, folder, "folder")}
                  >
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
                ))}
              </div>
            </div>
          )}

          {/* COMPLETED FILES TABLE SECTION */}
          <h3 className="section-title">Files</h3>
          {filteredAssets.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "180px", border: "1px dashed var(--border-color)", borderRadius: "12px", background: "var(--bg-secondary)", color: "var(--text-secondary)" }}>
              <File size={36} style={{ marginBottom: "12px" }} />
              <p style={{ fontSize: "14px" }}>No files uploaded here yet.</p>
            </div>
          ) : (
            <div className="files-container">
              <div className="table-header">
                <div>Name</div>
                <div>Size</div>
                <div>Uploaded By</div>
                <div style={{ textAlign: "right" }}>Actions</div>
              </div>

              {filteredAssets.map((asset) => (
                <div 
                  key={asset.id} 
                  className="file-row"
                  onContextMenu={(e) => handleContextMenu(e, asset, "file")}
                >
                  <div className="file-info">
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
              ))}
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

      {/* TOAST OVERLAY */}
      {toastMessage && (
        <div className="toast animate-fade-in-up">
          <Info size={16} />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
