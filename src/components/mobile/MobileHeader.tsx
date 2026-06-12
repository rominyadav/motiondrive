import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, File, FileText, FolderPlus, Menu, Plus, Table, Upload } from "lucide-react";

interface MobileHeaderProps {
  onMenuOpen: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  title: string;
  subtitle?: string;
  userInitial: string;
  showNewButton?: boolean;
  onUploadFile?: () => void;
  onUploadFolder?: () => void;
  onCreateFolder?: () => void;
  onCreateTextFile?: () => void;
  onCreateDocsFile?: () => void;
  onCreateSheetFile?: () => void;
}

export function MobileHeader({
  onMenuOpen,
  title,
  subtitle,
  userInitial,
  showNewButton = false,
  onUploadFile,
  onUploadFolder,
  onCreateFolder,
  onCreateTextFile,
  onCreateDocsFile,
  onCreateSheetFile
}: MobileHeaderProps) {
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const newMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (newMenuRef.current && !newMenuRef.current.contains(event.target as Node)) {
        setNewMenuOpen(false);
      }
    };

    if (newMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [newMenuOpen]);

  const newActions = [
    { icon: FolderPlus, label: "New Folder", onClick: onCreateFolder },
    { icon: FileText, label: "Text File", onClick: onCreateTextFile },
    { icon: File, label: "Document", onClick: onCreateDocsFile },
    { icon: Table, label: "Spreadsheet", onClick: onCreateSheetFile },
    { icon: Upload, label: "Upload File", onClick: onUploadFile },
    { icon: FolderPlus, label: "Upload Folder", onClick: onUploadFolder }
  ].filter((action) => Boolean(action.onClick));

  return (
    <div className="mobile-header">
      <div className="mobile-header-main">
        <button onClick={onMenuOpen} className="mobile-menu-btn" aria-label="Open menu">
          <Menu size={22} />
        </button>

        <div className="mobile-header-copy">
          <h1 className="mobile-header-title">{title}</h1>
          {subtitle && <p className="mobile-header-subtitle">{subtitle}</p>}
        </div>

        {showNewButton && newActions.length > 0 ? (
          <div className="mobile-new-menu" ref={newMenuRef}>
            <button
              type="button"
              className="mobile-new-button"
              onClick={() => setNewMenuOpen((open) => !open)}
              aria-expanded={newMenuOpen}
            >
              <Plus size={17} />
              <span>New</span>
              <ChevronDown size={14} />
            </button>

            {newMenuOpen && (
              <div className="mobile-new-dropdown">
                {newActions.map((action) => {
                  const Icon = action.icon;

                  return (
                    <button
                      key={action.label}
                      type="button"
                      className="mobile-new-dropdown-item"
                      onClick={() => {
                        action.onClick?.();
                        setNewMenuOpen(false);
                      }}
                    >
                      <Icon size={17} />
                      <span>{action.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="mobile-user-avatar">{userInitial}</div>
        )}
      </div>
    </div>
  );
}
