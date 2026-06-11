import { useState, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

export interface FolderPathSegment {
  id: string | null;
  name: string;
}

export function useDriveNavigation() {
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
  const [folderPathState, setFolderPathState] = useState<FolderPathSegment[]>([]);

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

  const setFolderPath = (path: FolderPathSegment[]) => {
    setFolderPathState(path);
    sessionStorage.setItem("motiondrive_folder_path", JSON.stringify(path));
  };

  // Click on Folder
  const navigateToFolder = (folder: { id: string; name: string; isR2Physical?: boolean }) => {
    if (folder.isR2Physical) {
      const parts = folder.id.split("/").filter(Boolean);
      setParams({ path: parts.join("/") });
    } else {
      setParams({ folderId: folder.id });
      setFolderPath([...folderPathState, { id: folder.id, name: folder.name }]);
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
    const item = folderPathState[index];
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
      setFolderPath(folderPathState.slice(0, index + 1));
    } else {
      setParams({
        folderId: item.id,
      });
      setFolderPath(folderPathState.slice(0, index + 1));
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

  return {
    explorerMode,
    selectedProjectId,
    currentFolderId,
    rawPath,
    sharedFolderPath,
    archiveFolderPath,
    folderPath: folderPathState,
    setFolderPath,
    navigateToFolder,
    selectProject,
    selectSharedDrive,
    selectArchiveDrive,
    handleBreadcrumbClick,
    handleBreadcrumbClickShared,
    handleBreadcrumbClickArchive,
    setParams,
  };
}
