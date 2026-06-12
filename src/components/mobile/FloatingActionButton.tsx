import React, { useState, useRef, useEffect } from "react";
import { Plus, Upload, FolderPlus, FileText, File, Table } from "lucide-react";

interface FloatingActionButtonProps {
  onUploadFile: () => void;
  onUploadFolder: () => void;
  onCreateFolder: () => void;
  onCreateTextFile: () => void;
  onCreateDocsFile: () => void;
  onCreateSheetFile: () => void;
  disabled?: boolean;
}

export function FloatingActionButton({
  onUploadFile,
  onUploadFolder,
  onCreateFolder,
  onCreateTextFile,
  onCreateDocsFile,
  onCreateSheetFile,
  disabled = false
}: FloatingActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const fabRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const actions = [
    { icon: Upload, label: "Upload File", onClick: onUploadFile, color: "#6366f1" },
    { icon: FolderPlus, label: "Upload Folder", onClick: onUploadFolder, color: "#3b82f6" },
    { icon: FolderPlus, label: "New Folder", onClick: onCreateFolder, color: "#10b981" },
    { icon: FileText, label: "Text File", onClick: onCreateTextFile, color: "#f59e0b" },
    { icon: File, label: "Document", onClick: onCreateDocsFile, color: "#ec4899" },
    { icon: Table, label: "Spreadsheet", onClick: onCreateSheetFile, color: "#8b5cf6" }
  ];

  return (
    <div className="fab-container" ref={fabRef}>
      {isOpen && (
        <div className="fab-menu">
          {actions.map((action, idx) => {
            const Icon = action.icon;
            return (
              <button
                key={idx}
                className="fab-menu-item"
                onClick={() => {
                  action.onClick();
                  setIsOpen(false);
                }}
                style={{ "--fab-color": action.color } as React.CSSProperties}
              >
                <Icon size={20} />
                <span>{action.label}</span>
              </button>
            );
          })}
        </div>
      )}
      
      <button
        className={`fab-main ${isOpen ? "active" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
      >
        <Plus size={24} className={isOpen ? "rotate-45" : ""} />
      </button>
    </div>
  );
}
