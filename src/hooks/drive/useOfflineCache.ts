import { useEffect } from "react";
import { isCapacitor } from "@/lib/native-bridge";
import { useQueryClient } from "@tanstack/react-query";

interface UseOfflineCacheParams {
  session: any;
  setSession: (s: any) => void;
  setLoading: (l: boolean) => void;
  explorerMode: string;
  selectedProjectId: string | null;
  currentFolderId: string | null;
  rawPath: string;
  driveData: any;
  projects: any[];
  storageStats: any;
}

export function useOfflineCache({
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
}: UseOfflineCacheParams) {
  const queryClient = useQueryClient();

  // Load offline cache on mount
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
            queryClient.setQueryData(
              ["driveContents", explorerMode, selectedProjectId, currentFolderId, rawPath],
              JSON.parse(cachedContents.value)
            );
          } catch (e) {}
        }
      } catch (err) {
        console.error("Failed to load offline cache:", err);
      }
    }
    loadCachedData();
  }, [queryClient, explorerMode, selectedProjectId, currentFolderId, rawPath, setSession, setLoading]);

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
}
