"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { 
  listProjects, 
  listApprovedUsers,
  listDriveContents, 
  listSharedDriveContents,
  listArchiveDriveContents,
  getUserStorageStats,
  getUserDetailedUsageStats
} from "@/app/actions/drive";
import { 
  listMySharedLinks,
  revokeSharedLink,
  extendSharedLink
} from "@/app/actions/share";
import { 
  Folder, 
  File, 
  Loader2,
  Info,
  AlertTriangle,
  CheckCircle
} from "lucide-react";
import "./drive.css";
import "./operations-animations.css";
import "./capacitor-mobile.css";

// Modular drive components
import { Sidebar } from "@/components/drive/Sidebar";
import { Navbar } from "@/components/drive/Navbar";
import { DriveExplorer } from "@/components/drive/DriveExplorer";
import { TransferDrawer } from "@/components/drive/TransferDrawer";

// Mobile components
import { BottomTabBar, MobileHeader, FloatingActionButton, ProjectPickerModal, MobileSidebar } from "@/components/mobile";
import { useMobileTabs } from "@/hooks/mobile/useMobileTabs";
import { useCapacitorClass } from "@/hooks/mobile/useCapacitorClass";
import { isCapacitorApp } from "@/lib/platform";

// Modular modal components
import { ConfirmModal } from "@/components/drive/modals/ConfirmModal";
import { DestinationPickerModal } from "@/components/drive/modals/DestinationPickerModal";
import { PreviewModal } from "@/components/drive/modals/PreviewModal";
import { FolderModal } from "@/components/drive/modals/FolderModal";
import { DetailedUsageModal } from "@/components/drive/modals/DetailedUsageModal";
import { CreateProjectModal, RenameProjectModal, DeleteProjectModal } from "@/components/drive/modals/ProjectModals";
import { TextEditorModal, DocsEditorModal, SheetEditorModal } from "@/components/drive/modals/EditorModals";

// Custom Drive hooks
import { useDriveNavigation } from "@/hooks/drive/useDriveNavigation";
import { useDriveSelection } from "@/hooks/drive/useDriveSelection";
import { useOfflineCache } from "@/hooks/drive/useOfflineCache";
import { useDriveTransfers } from "@/hooks/drive/useDriveTransfers";
import { useDriveEditors } from "@/hooks/drive/useDriveEditors";
import { useDriveActions } from "@/hooks/drive/useDriveActions";

function DrivePageContent() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showDetailedUsageModal, setShowDetailedUsageModal] = useState(false);
  
  const queryClient = useQueryClient();
  const router = useRouter();

  // 1. Navigation Hook (URL routing parameters, directory switching, breadcrumbs)
  const {
    explorerMode,
    selectedProjectId,
    currentFolderId,
    rawPath,
    sharedFolderPath,
    archiveFolderPath,
    folderPath,
    navigateToFolder,
    selectProject,
    selectSharedDrive,
    selectArchiveDrive,
    handleBreadcrumbClick,
    handleBreadcrumbClickShared,
    handleBreadcrumbClickArchive,
    setParams,
  } = useDriveNavigation();

  // TanStack Query for Projects
  const { data: projects = [] } = useQuery({
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
  const { data: storageStats = null } = useQuery({
    queryKey: ["storageStats"],
    queryFn: getUserStorageStats,
    enabled: !!session,
  });

  // TanStack Query for Detailed Storage Analytics (only loaded when modal is shown)
  const { data: detailedUsageStats = null, isLoading: detailedUsageLoading } = useQuery({
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

  // 2. Multi-selection Hook (Checkbox toggle selections)
  const {
    selectedAssetIds,
    selectedFolderIds,
    handleToggleAssetSelection,
    handleToggleFolderSelection,
    handleClearSelection,
    isAllSelected,
    handleSelectAll,
  } = useDriveSelection(filteredFolders, filteredAssets);

  // 3. Offline Caching Hook (Capacitor offline preference caching sync)
  useOfflineCache({
    session,
    setSession,
    setLoading,
    explorerMode,
    selectedProjectId,
    currentFolderId,
    rawPath,
    driveData,
    projects,
    storageStats,
  });

  // Toast / Notification State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"info" | "success" | "error">("info");

  const showToast = (msg: string, type: "info" | "success" | "error" = "info") => {
    setToastMessage(msg);
    setToastType(type);
  };

  const refreshExplorerContents = async () => {
    await queryClient.invalidateQueries({ queryKey: ["driveContents"] });
    await queryClient.invalidateQueries({ queryKey: ["storageStats"] });
  };

  // 4. File transfers & upload/download progress hook
  const {
    uploadProgress,
    uploadErrors,
    uploadActive,
    uploadMinimized,
    downloadProgress,
    downloadActive,
    transferMetrics,
    fileInputRef,
    folderInputRef,
    uploadSingleFile,
    handleCancelUpload,
    handleFileUpload,
    handleFolderUpload,
    triggerFileSelect,
    triggerFolderSelect,
    handleDownloadFile,
    handleCancelDownload,
    setUploadActive,
    setUploadMinimized,
    setUploadProgress,
    setDownloadActive,
    setDownloadProgress,
  } = useDriveTransfers({
    explorerMode,
    selectedProjectId,
    currentFolderId,
    sharedFolderPath,
    folders,
    assets: driveData.assets,
    showToast,
    refreshExplorerContents
  });

  // 5. In-app collaborative text / spreadsheet / quill document editors hook
  const {
    textModalOpen,
    setTextModalOpen,
    textFileName,
    setTextFileName,
    textContent,
    setTextContent,
    textEditorMode,
    docsModalOpen,
    setDocsModalOpen,
    docTitle,
    setDocTitle,
    docsEditorMode,
    sheetModalOpen,
    setSheetModalOpen,
    sheetName,
    setSheetName,
    sheetCells,
    setSheetCells,
    sheetEditorMode,
    editorContainerRef,
    quillRef,
    handleOpenTextCreator,
    handleOpenTextEditor,
    handleSaveTextFile,
    handleOpenDocsCreator,
    handleOpenDocsEditor,
    handleSaveDocsFile,
    handleOpenSheetCreator,
    handleOpenSheetEditor,
    handleSaveSheetFile,
    isSavingTextFile,
    isSavingDocsFile,
    isSavingSheetFile
  } = useDriveEditors({
    explorerMode,
    currentFolderId,
    sharedFolderPath,
    showToast,
    uploadSingleFile,
    refreshExplorerContents,
    setUploadActive
  });

  // 6. Project & File operation actions hook (folder creations, renaming, deletes, picker destination)
  const {
    folderModalOpen,
    setFolderModalOpen,
    newFolderName,
    setNewFolderName,
    projectModalOpen,
    setProjectModalOpen,
    newProjectName,
    setNewProjectName,
    newProjectClient,
    setNewProjectClient,
    shareWithAll,
    setShareWithAll,
    selectedUserIds,
    setSelectedUserIds,
    editShareWithAll,
    setEditShareWithAll,
    editSelectedUserIds,
    setEditSelectedUserIds,
    contextMenu,
    renameModalOpen,
    setRenameModalOpen,
    renameTarget,
    setRenameTarget,
    renameValue,
    setRenameValue,
    infoModalOpen,
    setInfoModalOpen,
    infoTarget,
    setInfoTarget,
    previewModalOpen,
    setPreviewModalOpen,
    previewTarget,
    previewUrl,
    previewTextContent,
    previewLoading,
    renameProjectModalOpen,
    setRenameProjectModalOpen,
    selectedProjectToEdit,
    setSelectedProjectToEdit,
    editProjectName,
    setEditProjectName,
    editProjectClient,
    setEditProjectClient,
    deleteProjectModalOpen,
    setDeleteProjectModalOpen,
    selectedProjectToDelete,
    setSelectedProjectToDelete,
    isCreatingFolder,
    isCreatingProject,
    isRenamingProject,
    isDeletingProject,
    isRenamingItem,
    pendingDeleteIds,
    pendingMoveIds,
    confirmModal,
    setConfirmModal,
    destinationPickerOpen,
    setDestinationPickerOpen,
    pickerAction,
    pickerDriveMode,
    pickerCurrentFolderId,
    pickerFolderPath,
    pickerFolders,
    pickerLoading,
    newDropdownOpen,
    setNewDropdownOpen,
    newDropdownRef,
    projectHeaderMenuOpen,
    setProjectHeaderMenuOpen,
    projectHeaderRef,
    handleContextMenu,
    handleCopyLink,
    handleCopyFolderLink,
    handleOpenPreview,
    handleOpenRename,
    handleRenameSubmit,
    handleOpenInfo,
    handleCreateFolder,
    handleCreateProject,
    handleRenameProject,
    handleDeleteProject,
    handleDeleteFile,
    handleDeleteFolder,
    handleBulkDelete,
    handleBulkMove,
    handleBulkCopy,
    handleOpenDestinationPicker,
    handleTogglePickerDriveMode,
    handlePickerNavigate,
    handlePickerBreadcrumbClick,
    handleExecutePickerAction
  } = useDriveActions({
    session,
    explorerMode,
    selectedProjectId,
    currentFolderId,
    sharedFolderPath,
    archiveFolderPath,
    folders,
    assets: driveData.assets,
    showToast,
    refreshExplorerContents,
    selectProject,
    queryClient,
    selectedAssetIds,
    selectedFolderIds,
    handleClearSelection,
    setUploadActive,
    setUploadMinimized,
    setUploadProgress
  });

  // Mobile Sidebar & Collapsibility State
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Add capacitor-app class to body when running in Capacitor
  useCapacitorClass();

  // Detect if running in Capacitor mobile app
  const [isMobileApp, setIsMobileApp] = useState(false);

  useEffect(() => {
    setIsMobileApp(isCapacitorApp());
  }, []);

  // Mobile tabs navigation hook (only for Capacitor app)
  const {
    activeTab,
    showProjectPicker,
    setShowProjectPicker,
    handleTabChange
  } = useMobileTabs({
    explorerMode,
    selectProject,
    selectSharedDrive,
    selectArchiveDrive,
    setParams
  });

  // Project Section Collapsible & Show More States
  const [yourProjsExpanded, setYourProjsExpanded] = useState(true);
  const [sharedProjsExpanded, setSharedProjsExpanded] = useState(false);
  const [archiveProjsExpanded, setArchiveProjsExpanded] = useState(false);

  const [yourProjsLimit, setYourProjsLimit] = useState(5);
  const [sharedProjsLimit, setSharedProjsLimit] = useState(5);
  const [archiveProjsLimit, setArchiveProjsLimit] = useState(5);

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

  // Sync viewMode from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("motiondrive_view_mode");
    if (saved === "icons" || saved === "table") {
      setViewMode(saved);
    }
  }, []);

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
  }, [docsModalOpen, docsEditorMode, editorContainerRef, quillRef]);

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
          <div style={{ position: "relative", width: "72px", height: "72px", marginBottom: "28px" }}>
            <div style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              border: "3px solid rgba(255, 255, 255, 0.03)"
            }} />
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

  const isAdmin = session?.user?.role === "admin" || session?.user?.role === "manager";

  const getMobileTitle = () => {
    if (explorerMode === "personal") {
      if (selectedProjectId && projects.length > 0) {
        const project = projects.find(p => p.id === selectedProjectId);
        return project?.name || "My Drive";
      }
      return "My Drive";
    }
    if (explorerMode === "shared") return "Shared Drive";
    if (explorerMode === "archive") return "Archive";
    if (explorerMode === "links") return "Shared Links";
    return "Drive";
  };

  return (
    <div className="app-container">
      {/* SIDEBAR BACKDROP FOR MOBILE */}
      {sidebarOpen && (
        <div className="sidebar-backdrop show" onClick={() => setSidebarOpen(false)} />
      )}

      <Sidebar
        session={session}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        explorerMode={explorerMode}
        selectedProjectId={selectedProjectId}
        selectProject={selectProject}
        selectSharedDrive={selectSharedDrive}
        selectArchiveDrive={selectArchiveDrive}
        setParams={setParams}
        setProjectModalOpen={setProjectModalOpen}
        projects={projects}
        isAdmin={isAdmin}
        storageStats={storageStats}
        setShowDetailedUsageModal={setShowDetailedUsageModal}
        handleSignOut={handleSignOut}
        
        setSelectedProjectToEdit={setSelectedProjectToEdit}
        setEditProjectName={setEditProjectName}
        setEditProjectClient={setEditProjectClient}
        setEditShareWithAll={setEditShareWithAll}
        setEditSelectedUserIds={setEditSelectedUserIds}
        setRenameProjectModalOpen={setRenameProjectModalOpen}
        setSelectedProjectToDelete={setSelectedProjectToDelete}
        setDeleteProjectModalOpen={setDeleteProjectModalOpen}

        isCreatingProject={isCreatingProject}
        newProjectName={newProjectName}
        isRenamingProject={isRenamingProject}
        selectedProjectToEdit={selectedProjectToEdit}
        isDeletingProject={isDeletingProject}
        selectedProjectToDelete={selectedProjectToDelete}

        yourProjsExpanded={yourProjsExpanded}
        setYourProjsExpanded={setYourProjsExpanded}
        sharedProjsExpanded={sharedProjsExpanded}
        setSharedProjsExpanded={setSharedProjsExpanded}
        archiveProjsExpanded={archiveProjsExpanded}
        setArchiveProjsExpanded={setArchiveProjsExpanded}

        yourProjsLimit={yourProjsLimit}
        setYourProjsLimit={setYourProjsLimit}
        sharedProjsLimit={sharedProjsLimit}
        setSharedProjsLimit={setSharedProjsLimit}
        archiveProjsLimit={archiveProjsLimit}
        setArchiveProjsLimit={setArchiveProjsLimit}
      />

      <main className="main-content">
        <Navbar
          session={session}
          setSidebarOpen={setSidebarOpen}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          explorerMode={explorerMode}
          viewMode={viewMode}
          changeViewMode={changeViewMode}
        />

        <DriveExplorer
          explorerMode={explorerMode}
          selectedProjectId={selectedProjectId}
          currentFolderId={currentFolderId}
          rawPath={rawPath}
          folderPath={folderPath}
          projects={projects}
          session={session}
          isAdmin={isAdmin}
          contentsLoading={contentsLoading}

          pendingDeleteIds={pendingDeleteIds}
          pendingMoveIds={pendingMoveIds}
          isCreatingFolder={isCreatingFolder}
          newFolderName={newFolderName}
          isSavingTextFile={isSavingTextFile}
          textFileName={textFileName}
          isSavingDocsFile={isSavingDocsFile}
          docTitle={docTitle}
          isSavingSheetFile={isSavingSheetFile}
          sheetName={sheetName}
          isRenamingProject={isRenamingProject}
          isDeletingProject={isDeletingProject}
          selectedProjectToEdit={selectedProjectToEdit}
          selectedProjectToDelete={selectedProjectToDelete}
          sharedFolderPath={sharedFolderPath}
          archiveFolderPath={archiveFolderPath}
          sharedLinksList={sharedLinksList}
          sharedLinksLoading={sharedLinksLoading}
          viewMode={viewMode}
          searchQuery={searchQuery}
          
          newDropdownOpen={newDropdownOpen}
          setNewDropdownOpen={setNewDropdownOpen}
          newDropdownRef={newDropdownRef}

          projectHeaderMenuOpen={projectHeaderMenuOpen}
          setProjectHeaderMenuOpen={setProjectHeaderMenuOpen}
          projectHeaderRef={projectHeaderRef}

          selectedAssetIds={selectedAssetIds}
          selectedFolderIds={selectedFolderIds}
          handleToggleAssetSelection={handleToggleAssetSelection}
          handleToggleFolderSelection={handleToggleFolderSelection}
          isAllSelected={isAllSelected}
          handleSelectAll={handleSelectAll}
          handleClearSelection={handleClearSelection}

          filteredFolders={filteredFolders}
          filteredAssets={filteredAssets}

          handleBreadcrumbClick={handleBreadcrumbClick}
          handleBreadcrumbClickShared={handleBreadcrumbClickShared}
          handleBreadcrumbClickArchive={handleBreadcrumbClickArchive}
          navigateToFolder={navigateToFolder}

          setSelectedProjectToEdit={setSelectedProjectToEdit}
          setEditProjectName={setEditProjectName}
          setEditProjectClient={setEditProjectClient}
          setEditShareWithAll={setEditShareWithAll}
          setEditSelectedUserIds={setEditSelectedUserIds}
          setRenameProjectModalOpen={setRenameProjectModalOpen}
          setSelectedProjectToDelete={setSelectedProjectToDelete}
          setDeleteProjectModalOpen={setDeleteProjectModalOpen}

          setFolderModalOpen={setFolderModalOpen}

          handleOpenTextCreator={handleOpenTextCreator}
          handleOpenDocsCreator={handleOpenDocsCreator}
          handleOpenSheetCreator={handleOpenSheetCreator}

          fileInputRef={fileInputRef}
          folderInputRef={folderInputRef}
          triggerFileSelect={triggerFileSelect}
          triggerFolderSelect={triggerFolderSelect}

          handleDeleteFolder={handleDeleteFolder}
          handleDeleteFile={handleDeleteFile}
          handleDownloadFile={handleDownloadFile}
          handleContextMenu={handleContextMenu}

          handleBulkDelete={handleBulkDelete}
          handleBulkMove={handleBulkMove}
          handleBulkCopy={handleBulkCopy}

          extendSharedLink={extendSharedLink}
          revokeSharedLink={revokeSharedLink}
          refetchSharedLinks={refetchSharedLinks}
          showToast={showToast}
        />
      </main>

      <TransferDrawer
        uploadActive={uploadActive}
        downloadActive={downloadActive}
        uploadMinimized={uploadMinimized}
        setUploadActive={setUploadActive}
        setDownloadActive={setDownloadActive}
        setUploadMinimized={setUploadMinimized}
        uploadProgress={uploadProgress}
        setUploadProgress={setUploadProgress}
        downloadProgress={downloadProgress}
        setDownloadProgress={setDownloadProgress}
        transferMetrics={transferMetrics}
        uploadErrors={uploadErrors}
        handleCancelUpload={handleCancelUpload}
        handleCancelDownload={handleCancelDownload}
      />

      <ConfirmModal
        confirmModal={confirmModal}
        onClose={() => setConfirmModal(null)}
        onConfirm={() => {
          if (confirmModal) {
            confirmModal.onConfirm();
            setConfirmModal(null);
          }
        }}
      />

      <DestinationPickerModal
        isOpen={destinationPickerOpen}
        onClose={() => setDestinationPickerOpen(false)}
        pickerAction={pickerAction}
        pickerDriveMode={pickerDriveMode}
        pickerFolderPath={pickerFolderPath}
        pickerLoading={pickerLoading}
        pickerFolders={pickerFolders}
        onToggleDriveMode={handleTogglePickerDriveMode}
        onBreadcrumbClick={handlePickerBreadcrumbClick}
        onNavigate={handlePickerNavigate}
        onExecute={handleExecutePickerAction}
      />

      <PreviewModal
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        previewTarget={previewTarget}
        previewLoading={previewLoading}
        previewUrl={previewUrl}
        previewTextContent={previewTextContent}
        onDownload={handleDownloadFile}
      />

      <FolderModal
        isOpen={folderModalOpen}
        onClose={() => setFolderModalOpen(false)}
        newFolderName={newFolderName}
        setNewFolderName={setNewFolderName}
        isCreatingFolder={isCreatingFolder}
        onCreateFolder={handleCreateFolder}
      />

      <CreateProjectModal
        isOpen={projectModalOpen}
        onClose={() => setProjectModalOpen(false)}
        newProjectName={newProjectName}
        setNewProjectName={setNewProjectName}
        newProjectClient={newProjectClient}
        setNewProjectClient={setNewProjectClient}
        shareWithAll={shareWithAll}
        setShareWithAll={setShareWithAll}
        approvedUsers={approvedUsers}
        selectedUserIds={selectedUserIds}
        setSelectedUserIds={setSelectedUserIds}
        isCreatingProject={isCreatingProject}
        onCreateProject={handleCreateProject}
      />

      <RenameProjectModal
        isOpen={renameProjectModalOpen}
        onClose={() => {
          setRenameProjectModalOpen(false);
          setSelectedProjectToEdit(null);
          setEditProjectName("");
          setEditProjectClient("");
          setEditShareWithAll(true);
          setEditSelectedUserIds([]);
        }}
        selectedProjectToEdit={selectedProjectToEdit}
        editProjectName={editProjectName}
        setEditProjectName={setEditProjectName}
        editProjectClient={editProjectClient}
        setEditProjectClient={setEditProjectClient}
        editShareWithAll={editShareWithAll}
        setEditShareWithAll={setEditShareWithAll}
        approvedUsers={approvedUsers}
        editSelectedUserIds={editSelectedUserIds}
        setEditSelectedUserIds={setEditSelectedUserIds}
        isRenamingProject={isRenamingProject}
        onRenameProject={handleRenameProject}
      />

      <DeleteProjectModal
        isOpen={deleteProjectModalOpen}
        onClose={() => setDeleteProjectModalOpen(false)}
        selectedProjectToDelete={selectedProjectToDelete}
        isDeletingProject={isDeletingProject}
        onDeleteProject={handleDeleteProject}
      />

      <DetailedUsageModal
        isOpen={showDetailedUsageModal}
        onClose={() => setShowDetailedUsageModal(false)}
        detailedUsageLoading={detailedUsageLoading}
        detailedUsageStats={detailedUsageStats}
      />

      <TextEditorModal
        isOpen={textModalOpen}
        onClose={() => setTextModalOpen(false)}
        textEditorMode={textEditorMode}
        textFileName={textFileName}
        setTextFileName={setTextFileName}
        textContent={textContent}
        setTextContent={setTextContent}
        onSave={handleSaveTextFile}
        isSaving={isSavingTextFile}
      />

      <DocsEditorModal
        isOpen={docsModalOpen}
        onClose={() => setDocsModalOpen(false)}
        docsEditorMode={docsEditorMode}
        docTitle={docTitle}
        setDocTitle={setDocTitle}
        editorContainerRef={editorContainerRef}
        onSave={handleSaveDocsFile}
        isSaving={isSavingDocsFile}
      />

      <SheetEditorModal
        isOpen={sheetModalOpen}
        onClose={() => setSheetModalOpen(false)}
        sheetEditorMode={sheetEditorMode}
        sheetName={sheetName}
        setSheetName={setSheetName}
        sheetCells={sheetCells}
        onCellChange={(col, row, val) => {
          setSheetCells(prev => ({
            ...prev,
            [`${col}${row}`]: val
          }));
        }}
        onSave={handleSaveSheetFile}
        isSaving={isSavingSheetFile}
      />

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
                  disabled={isRenamingItem}
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
                  disabled={isRenamingItem}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isRenamingItem}>
                  {isRenamingItem ? (
                    <>
                      <Loader2 className="animate-spin" size={16} style={{ marginRight: "6px" }} />
                      Saving...
                    </>
                  ) : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

      {/* MOBILE UI COMPONENTS - ONLY FOR CAPACITOR APP */}
      {isMobileApp && (
        <>
          <MobileHeader 
            onMenuOpen={() => setSidebarOpen(true)}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            title={getMobileTitle()}
            userInitial={session?.user?.name?.charAt(0) || "U"}
          />

          <MobileSidebar
            session={session}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            explorerMode={explorerMode}
            isAdmin={isAdmin}
            storageStats={storageStats}
            setShowDetailedUsageModal={setShowDetailedUsageModal}
            handleSignOut={handleSignOut}
            setParams={setParams}
          />

          <BottomTabBar 
            activeTab={activeTab} 
            onTabChange={handleTabChange} 
          />

          <FloatingActionButton
            onUploadFile={triggerFileSelect}
            onUploadFolder={triggerFolderSelect}
            onCreateFolder={() => setFolderModalOpen(true)}
            onCreateTextFile={handleOpenTextCreator}
            onCreateDocsFile={handleOpenDocsCreator}
            onCreateSheetFile={handleOpenSheetCreator}
            disabled={explorerMode === "links" || explorerMode === "shared" || explorerMode === "archive"}
          />

          <ProjectPickerModal
            isOpen={showProjectPicker}
            onClose={() => setShowProjectPicker(false)}
            projects={projects}
            currentUserId={session?.user?.id || ""}
            onSelectProject={selectProject}
          />
        </>
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
