import { useState } from "react";
import { Asset, Folder } from "@/types/drive";

export function useDriveSelection(filteredFolders: Folder[], filteredAssets: Asset[]) {
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set());

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

  return {
    selectedAssetIds,
    setSelectedAssetIds,
    selectedFolderIds,
    setSelectedFolderIds,
    handleToggleAssetSelection,
    handleToggleFolderSelection,
    handleClearSelection,
    isAllSelected: isAllSelected(),
    handleSelectAll,
  };
}
