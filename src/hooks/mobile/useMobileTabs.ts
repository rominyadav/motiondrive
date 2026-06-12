import { useState, useEffect } from "react";
import { DriveMode } from "@/types/drive";

export type MobileTab = DriveMode | "projects";

interface UseMobileTabsProps {
  explorerMode: DriveMode;
  selectProject: (id: string | null, name: string) => void;
  selectSharedDrive: () => void;
  selectArchiveDrive: () => void;
  setParams: (params: Record<string, string | null | undefined>) => void;
}

export function useMobileTabs({
  explorerMode,
  selectProject,
  selectSharedDrive,
  selectArchiveDrive,
  setParams
}: UseMobileTabsProps) {
  const [activeTab, setActiveTab] = useState<MobileTab>(explorerMode);
  const [showProjectPicker, setShowProjectPicker] = useState(false);

  useEffect(() => {
    setActiveTab(explorerMode);
  }, [explorerMode]);

  const handleTabChange = (tab: MobileTab) => {
    setActiveTab(tab);
    
    switch (tab) {
      case "personal":
        selectProject(null, "My Drive");
        break;
      case "shared":
        selectSharedDrive();
        break;
      case "archive":
        selectArchiveDrive();
        break;
      case "projects":
        setShowProjectPicker(true);
        break;
      default:
        break;
    }
  };

  return {
    activeTab,
    showProjectPicker,
    setShowProjectPicker,
    handleTabChange
  };
}
