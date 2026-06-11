import React from "react";
import { Loader2 } from "lucide-react";

interface FolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  newFolderName: string;
  setNewFolderName: (v: string) => void;
  isCreatingFolder: boolean;
  onCreateFolder: (e: React.FormEvent) => void;
}

export function FolderModal({
  isOpen,
  onClose,
  newFolderName,
  setNewFolderName,
  isCreatingFolder,
  onCreateFolder,
}: FolderModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal animate-scale-up">
        <h3 style={{ fontSize: "18px", fontWeight: "700" }}>Create New Folder</h3>
        <form onSubmit={onCreateFolder} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
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
              disabled={isCreatingFolder}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px" }}>
            <button 
              type="button" 
              onClick={onClose} 
              className="btn-secondary" 
              disabled={isCreatingFolder}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isCreatingFolder}>
              {isCreatingFolder ? (
                <>
                  <Loader2 className="animate-spin" size={16} style={{ marginRight: "6px" }} />
                  Creating...
                </>
              ) : "Create Folder"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
