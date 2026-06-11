import { useState, useRef, useEffect, FormEvent, MouseEvent } from "react";
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
  listSharedDriveContents,
  createSharedFolder,
  deleteSharedAsset,
  deleteSharedFolder,
  getSharedDownloadUrl,
  getArchiveDownloadUrl,
  renameAsset,
  renameFolder,
  renameSharedAsset,
  renameSharedFolder,
  bulkDeleteItems,
  bulkMoveItems,
  bulkCopyItems
} from "@/app/actions/drive";
import { createSharedLink } from "@/app/actions/share";

interface UseDriveActionsParams {
  session: any;
  explorerMode: "personal" | "shared" | "archive" | "links";
  selectedProjectId: string | null;
  currentFolderId: string | null;
  sharedFolderPath: string[];
  archiveFolderPath: string[];
  folders: any[];
  assets: any[];
  showToast: (msg: string, type?: "info" | "success" | "error") => void;
  refreshExplorerContents: () => Promise<void>;
  selectProject: (projectId: string | null, projectName: string) => void;
  queryClient: any;
  selectedAssetIds: Set<string>;
  selectedFolderIds: Set<string>;
  handleClearSelection: () => void;
  setUploadActive: (active: boolean) => void;
  setUploadMinimized: (minimized: boolean) => void;
  setUploadProgress: (updater: (prev: { [filename: string]: number }) => { [filename: string]: number }) => void;
}

export function useDriveActions({
  session,
  explorerMode,
  selectedProjectId,
  currentFolderId,
  sharedFolderPath,
  archiveFolderPath,
  folders,
  assets,
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
}: UseDriveActionsParams) {
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

  // Project Rename & Delete State
  const [renameProjectModalOpen, setRenameProjectModalOpen] = useState(false);
  const [selectedProjectToEdit, setSelectedProjectToEdit] = useState<any | null>(null);
  const [editProjectName, setEditProjectName] = useState("");
  const [editProjectClient, setEditProjectClient] = useState("");

  const [deleteProjectModalOpen, setDeleteProjectModalOpen] = useState(false);
  const [selectedProjectToDelete, setSelectedProjectToDelete] = useState<any | null>(null);

  // Loading Trackers for Forms/Actions
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isRenamingProject, setIsRenamingProject] = useState(false);
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  const [isRenamingItem, setIsRenamingItem] = useState(false);

  // Optimistic Background Tasks
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());
  const [pendingMoveIds, setPendingMoveIds] = useState<Set<string>>(new Set());

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

  const isAdmin = session?.user?.role === "admin" || session?.user?.role === "manager";

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
  const handleRenameSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!renameTarget || !renameValue.trim()) return;

    const { item, type } = renameTarget;
    const nameInput = renameValue.trim();

    setIsRenamingItem(true);
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
      setRenameModalOpen(false);
      setRenameTarget(null);
    } catch (err) {
      showToast("Failed to rename target", "error");
      console.error(err);
    } finally {
      setIsRenamingItem(false);
    }
  };

  // Open Get Info
  const handleOpenInfo = (item: any, type: "file" | "folder") => {
    setInfoTarget({ item, type });
    setInfoModalOpen(true);
  };

  const handleCreateFolder = async (e: FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    setIsCreatingFolder(true);
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
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleCreateProject = async (e: FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    setIsCreatingProject(true);
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
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handleRenameProject = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProjectToEdit || !editProjectName.trim()) return;

    setIsRenamingProject(true);
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
    } finally {
      setIsRenamingProject(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!selectedProjectToDelete) return;

    setIsDeletingProject(true);
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
    } finally {
      setIsDeletingProject(false);
    }
  };

  // Delete File
  const handleDeleteFile = async (assetId: string) => {
    const targetBucketText = explorerMode === "shared" ? "shared Cloudflare R2 bucket (video-assets)" : "Web Drive and Cloudflare R2";
    const fileObj = assets?.find((a: any) => a.id === assetId);
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

        setPendingDeleteIds(prev => {
          const next = new Set(prev);
          next.add(assetId);
          return next;
        });

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
          } finally {
            setPendingDeleteIds(prev => {
              const next = new Set(prev);
              next.delete(assetId);
              return next;
            });
          }
        })();
      }
    });
  };

  // Delete Folder
  const handleDeleteFolder = async (folderId: string, folderName?: string) => {
    const folderObj = folders?.find((f: any) => f.id === folderId);
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

        setPendingDeleteIds(prev => {
          const next = new Set(prev);
          next.add(folderId);
          return next;
        });

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
          } finally {
            setPendingDeleteIds(prev => {
              const next = new Set(prev);
              next.delete(folderId);
              return next;
            });
          }
        })();
      }
    });
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

        setPendingDeleteIds(prev => {
          const next = new Set(prev);
          assetIdsToDelete.forEach(id => next.add(id));
          folderIdsToDelete.forEach(id => next.add(id));
          return next;
        });

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
          } finally {
            setPendingDeleteIds(prev => {
              const next = new Set(prev);
              assetIdsToDelete.forEach(id => next.delete(id));
              folderIdsToDelete.forEach(id => next.delete(id));
              return next;
            });
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
      // Add items to pending move set
      setPendingMoveIds(prev => {
        const next = new Set(prev);
        assetIdsToMove.forEach(id => next.add(id));
        folderIdsToMove.forEach(id => next.add(id));
        return next;
      });

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
      } finally {
        // Clear items from pending move set
        setPendingMoveIds(prev => {
          const next = new Set(prev);
          assetIdsToMove.forEach(id => next.delete(id));
          folderIdsToMove.forEach(id => next.delete(id));
          return next;
        });
      }
    })();
  };

  const handleBulkMove = () => {
    handleOpenDestinationPicker("move");
  };

  const handleBulkCopy = () => {
    handleOpenDestinationPicker("copy");
  };

  // Global click listeners to close dropdowns
  useEffect(() => {
    const handleCloseNewDropdown = (e: MouseEvent) => {
      if (newDropdownRef.current && !newDropdownRef.current.contains(e.target as Node)) {
        setNewDropdownOpen(false);
      }
    };
    const handleCloseProjectHeaderMenu = (e: MouseEvent) => {
      if (projectHeaderRef.current && !projectHeaderRef.current.contains(e.target as Node)) {
        setProjectHeaderMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", handleCloseNewDropdown as any);
    window.addEventListener("mousedown", handleCloseProjectHeaderMenu as any);
    return () => {
      window.removeEventListener("mousedown", handleCloseNewDropdown as any);
      window.removeEventListener("mousedown", handleCloseProjectHeaderMenu as any);
    };
  }, []);

  // Global contextual menu auto-closer
  useEffect(() => {
    const handleCloseMenu = () => setContextMenu(null);
    window.addEventListener("click", handleCloseMenu);
    window.addEventListener("contextmenu", handleCloseMenu);
    return () => {
      window.removeEventListener("click", handleCloseMenu);
      window.removeEventListener("contextmenu", handleCloseMenu);
    };
  }, []);

  // Global keydown listeners (ESC and ENTER confirmation keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFolderModalOpen(false);
        setProjectModalOpen(false);
        setRenameProjectModalOpen(false);
        setDeleteProjectModalOpen(false);
        setConfirmModal(null);
      }

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

  return {
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
    setContextMenu,
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
    setPreviewTarget,
    previewUrl,
    setPreviewUrl,
    previewTextContent,
    setPreviewTextContent,
    previewLoading,
    setPreviewLoading,
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
  };
}
