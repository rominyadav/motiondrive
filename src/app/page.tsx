"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { 
  createFolder, 
  createProject, 
  listProjects, 
  listDriveContents, 
  getDownloadUrl, 
  deleteAsset,
  initiateMultipartUpload,
  getPresignedPartUrls,
  completeMultipartUpload
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
  Loader2 
} from "lucide-react";
import Link from "next/link";
import "./drive.css";

export default function DrivePage() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

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

  // Load folder contents whenever workspace scope changes
  useEffect(() => {
    if (loading || !session) return;

    async function loadContents() {
      try {
        const { folders: loadedFolders, assets: loadedAssets } = await listDriveContents({
          projectId: selectedProjectId,
          folderId: currentFolderId
        });
        setFolders(loadedFolders);
        setAssets(loadedAssets);
      } catch (err) {
        console.error("Failed to load drive contents", err);
      }
    }
    loadContents();
  }, [selectedProjectId, currentFolderId, loading, session]);

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      await createFolder(newFolderName.trim(), selectedProjectId || undefined, currentFolderId);
      setNewFolderName("");
      setFolderModalOpen(false);

      // Reload folders
      const { folders: loadedFolders } = await listDriveContents({
        projectId: selectedProjectId,
        folderId: currentFolderId
      });
      setFolders(loadedFolders);
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
  const navigateToFolder = (folder: { id: string; name: string }) => {
    setCurrentFolderId(folder.id);
    setFolderPath((prev) => [...prev, { id: folder.id, name: folder.name }]);
  };

  // Click on Project
  const selectProject = (projectId: string | null, projectName: string) => {
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

  // Download File via Presigned URL
  const handleDownloadFile = async (assetId: string) => {
    try {
      const { downloadUrl, filename } = await getDownloadUrl(assetId);
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
    if (!confirm("Are you sure you want to delete this file from the Web Drive and Cloudflare R2?")) return;

    try {
      await deleteAsset(assetId);
      // Reload assets
      const { assets: loadedAssets } = await listDriveContents({
        projectId: selectedProjectId,
        folderId: currentFolderId
      });
      setAssets(loadedAssets);
    } catch (err) {
      alert("Failed to delete file");
    }
  };

  // CHUNKED MULTI-PART DIRECT-TO-R2 UPLOAD
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadActive(true);

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
          folderId: currentFolderId
        });

        // B. Get presigned URLs for each chunk
        const partNumbers = Array.from({ length: totalChunks }, (_, index) => index + 1);
        const { partUrls } = await getPresignedPartUrls({ uploadId, r2Key, partNumbers });

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
          assetId
        });

        // Refresh Explorer Contents on finish
        const { assets: loadedAssets } = await listDriveContents({
          projectId: selectedProjectId,
          folderId: currentFolderId
        });
        setAssets(loadedAssets);

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
            className={`nav-link ${selectedProjectId === null ? "active" : ""}`}
          >
            <LayoutGrid size={18} />
            <span>My Drive</span>
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
                className={`nav-link ${selectedProjectId === proj.id ? "active" : ""}`}
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
            {folderPath.map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {i > 0 && <ChevronRight size={16} style={{ opacity: 0.5 }} />}
                <span 
                  className={`breadcrumb-item ${i === folderPath.length - 1 ? "active" : ""}`}
                  onClick={() => handleBreadcrumbClick(i)}
                >
                  {item.name}
                </span>
              </div>
            ))}
          </div>

          <div className="explorer-header">
            <h2 className="explorer-title">
              {folderPath[folderPath.length - 1]?.name || "My Drive"}
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
                  >
                    <Folder className="folder-icon" size={24} />
                    <span className="folder-name">{folder.name}</span>
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
                <div key={asset.id} className="file-row">
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
    </div>
  );
}
