import React from "react";
import { FolderInput, X, ChevronRight, Loader2, FolderOpen, Folder } from "lucide-react";
import { FolderPathNode } from "@/types/drive";

interface DestinationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pickerAction: "move" | "copy" | null;
  pickerDriveMode: "personal" | "shared";
  pickerFolderPath: FolderPathNode[];
  pickerLoading: boolean;
  pickerFolders: any[];
  onToggleDriveMode: (mode: "personal" | "shared") => void;
  onBreadcrumbClick: (index: number) => void;
  onNavigate: (folder: any) => void;
  onExecute: () => void;
}

export function DestinationPickerModal({
  isOpen,
  onClose,
  pickerAction,
  pickerDriveMode,
  pickerFolderPath,
  pickerLoading,
  pickerFolders,
  onToggleDriveMode,
  onBreadcrumbClick,
  onNavigate,
  onExecute,
}: DestinationPickerModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal picker-modal" 
        onClick={(e) => e.stopPropagation()} 
        style={{ maxWidth: "560px", width: "90vw" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <FolderInput size={22} className="brand-accent" />
            <h3 style={{ fontSize: "18px", fontWeight: "700" }}>
              Select Destination for {pickerAction === "copy" ? "Copy" : "Move"}
            </h3>
          </div>
          <button 
            onClick={onClose}
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
            onClick={() => onToggleDriveMode("personal")}
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
            onClick={() => onToggleDriveMode("shared")}
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
            onClick={() => onBreadcrumbClick(-1)}
          >
            {pickerDriveMode === "shared" ? "Shared Drive" : "My Drive"}
          </span>
          {pickerFolderPath.map((item, index) => (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <ChevronRight size={14} style={{ opacity: 0.5 }} />
              <span 
                className={`picker-breadcrumb-item ${index === pickerFolderPath.length - 1 ? "active" : ""}`}
                style={{ cursor: "pointer", color: index === pickerFolderPath.length - 1 ? "var(--brand-accent)" : "var(--text-secondary)", fontWeight: "500", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "120px" }}
                onClick={() => onBreadcrumbClick(index)}
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
                  onClick={() => onNavigate(folder)}
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
              onClick={onClose} 
              className="btn-secondary"
              style={{ height: "38px" }}
            >
              Cancel
            </button>
            <button 
              onClick={onExecute}
              className="btn-primary"
              style={{ height: "38px", padding: "0 20px" }}
            >
              {pickerAction === "copy" ? "Copy Here" : "Move Here"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
