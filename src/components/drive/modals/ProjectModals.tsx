import React from "react";
import { Loader2 } from "lucide-react";

// ==========================================
// 1. CREATE PROJECT MODAL
// ==========================================

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  newProjectName: string;
  setNewProjectName: (v: string) => void;
  newProjectClient: string;
  setNewProjectClient: (v: string) => void;
  shareWithAll: boolean;
  setShareWithAll: (v: boolean) => void;
  approvedUsers: any[];
  selectedUserIds: string[];
  setSelectedUserIds: (ids: string[]) => void;
  isCreatingProject: boolean;
  onCreateProject: (e: React.FormEvent) => void;
}

export function CreateProjectModal({
  isOpen,
  onClose,
  newProjectName,
  setNewProjectName,
  newProjectClient,
  setNewProjectClient,
  shareWithAll,
  setShareWithAll,
  approvedUsers,
  selectedUserIds,
  setSelectedUserIds,
  isCreatingProject,
  onCreateProject,
}: CreateProjectModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal animate-scale-up">
        <h3 style={{ fontSize: "18px", fontWeight: "700" }}>Add New Project</h3>
        <form onSubmit={onCreateProject} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Project Name</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. Wedding Promos"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              required
              autoFocus
              disabled={isCreatingProject}
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Client Name (Optional)</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. Sony Entertainment"
              value={newProjectClient}
              onChange={(e) => setNewProjectClient(e.target.value)}
              disabled={isCreatingProject}
            />
          </div>

          <div className="form-group" style={{ margin: 0, marginTop: "4px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", userSelect: "none" }}>
              <input 
                type="checkbox" 
                checked={shareWithAll}
                onChange={(e) => setShareWithAll(e.target.checked)}
                style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: "var(--accent-indigo)" }}
                disabled={isCreatingProject}
              />
              <span style={{ fontSize: "13px", color: "var(--text-primary)", fontWeight: 500 }}>Share with all users (recommended)</span>
            </label>
          </div>

          {!shareWithAll && approvedUsers && approvedUsers.length > 0 && (
            <div className="form-group" style={{ margin: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
              <label className="form-label" style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Select Specific Users to Share With</label>
              <div style={{
                maxHeight: "150px",
                overflowY: "auto",
                backgroundColor: "rgba(255, 255, 255, 0.02)",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
                padding: "8px",
                display: "flex",
                flexDirection: "column",
                gap: "6px"
              }} className="custom-scrollbar">
                {approvedUsers.map((user: any) => {
                  const isChecked = selectedUserIds.includes(user.id);
                  return (
                    <label 
                      key={user.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "6px 8px",
                        borderRadius: "6px",
                        cursor: "pointer",
                        transition: "background-color 0.2s",
                        backgroundColor: isChecked ? "rgba(99, 102, 241, 0.05)" : "transparent"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flexGrow: 1 }}>
                        <input 
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setSelectedUserIds(selectedUserIds.filter(id => id !== user.id));
                            } else {
                              setSelectedUserIds([...selectedUserIds, user.id]);
                            }
                          }}
                          style={{ width: "14px", height: "14px", cursor: "pointer", accentColor: "var(--accent-indigo)" }}
                          disabled={isCreatingProject}
                        />
                        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                          <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</span>
                          <span style={{ fontSize: "11px", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</span>
                        </div>
                      </div>
                      <span style={{
                        fontSize: "10px",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        backgroundColor: user.role === "admin" ? "rgba(239, 68, 68, 0.1)" : user.role === "manager" ? "rgba(245, 158, 11, 0.1)" : "rgba(99, 102, 241, 0.1)",
                        color: user.role === "admin" ? "#f87171" : user.role === "manager" ? "#fbbf24" : "#818cf8"
                      }}>
                        {user.role}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px" }}>
            <button 
              type="button" 
              onClick={onClose} 
              className="btn-secondary" 
              disabled={isCreatingProject}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isCreatingProject}>
              {isCreatingProject ? (
                <>
                  <Loader2 className="animate-spin" size={16} style={{ marginRight: "6px" }} />
                  Adding...
                </>
              ) : "Add Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// 2. RENAME / EDIT PROJECT MODAL
// ==========================================

interface RenameProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProjectToEdit: any;
  editProjectName: string;
  setEditProjectName: (v: string) => void;
  editProjectClient: string;
  setEditProjectClient: (v: string) => void;
  editShareWithAll: boolean;
  setEditShareWithAll: (v: boolean) => void;
  approvedUsers: any[];
  editSelectedUserIds: string[];
  setEditSelectedUserIds: (ids: string[]) => void;
  isRenamingProject: boolean;
  onRenameProject: (e: React.FormEvent) => void;
}

export function RenameProjectModal({
  isOpen,
  onClose,
  selectedProjectToEdit,
  editProjectName,
  setEditProjectName,
  editProjectClient,
  setEditProjectClient,
  editShareWithAll,
  setEditShareWithAll,
  approvedUsers,
  editSelectedUserIds,
  setEditSelectedUserIds,
  isRenamingProject,
  onRenameProject,
}: RenameProjectModalProps) {
  if (!isOpen || !selectedProjectToEdit) return null;

  return (
    <div className="modal-overlay">
      <div className="modal animate-scale-up">
        <h3 style={{ fontSize: "18px", fontWeight: "700" }}>Rename Project</h3>
        <form onSubmit={onRenameProject} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Project Name</label>
            <input 
              type="text" 
              className="form-input" 
              value={editProjectName}
              onChange={(e) => setEditProjectName(e.target.value)}
              required
              autoFocus
              disabled={isRenamingProject}
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Client Name (Optional)</label>
            <input 
              type="text" 
              className="form-input" 
              value={editProjectClient}
              onChange={(e) => setEditProjectClient(e.target.value)}
              disabled={isRenamingProject}
            />
          </div>

          <div className="form-group" style={{ margin: 0, marginTop: "4px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", userSelect: "none" }}>
              <input 
                type="checkbox" 
                checked={editShareWithAll}
                onChange={(e) => setEditShareWithAll(e.target.checked)}
                style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: "var(--accent-indigo)" }}
                disabled={isRenamingProject}
              />
              <span style={{ fontSize: "13px", color: "var(--text-primary)", fontWeight: 500 }}>Share with all users (recommended)</span>
            </label>
          </div>

          {!editShareWithAll && approvedUsers && approvedUsers.length > 0 && (
            <div className="form-group" style={{ margin: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
              <label className="form-label" style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Select Specific Users to Share With</label>
              <div style={{
                maxHeight: "150px",
                overflowY: "auto",
                backgroundColor: "rgba(255, 255, 255, 0.02)",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
                padding: "8px",
                display: "flex",
                flexDirection: "column",
                gap: "6px"
              }} className="custom-scrollbar">
                {approvedUsers.map((user: any) => {
                  const isChecked = editSelectedUserIds.includes(user.id);
                  return (
                    <label 
                      key={user.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "6px 8px",
                        borderRadius: "6px",
                        cursor: "pointer",
                        transition: "background-color 0.2s",
                        backgroundColor: isChecked ? "rgba(99, 102, 241, 0.05)" : "transparent"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flexGrow: 1 }}>
                        <input 
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setEditSelectedUserIds(editSelectedUserIds.filter(id => id !== user.id));
                            } else {
                              setEditSelectedUserIds([...editSelectedUserIds, user.id]);
                            }
                          }}
                          style={{ width: "14px", height: "14px", cursor: "pointer", accentColor: "var(--accent-indigo)" }}
                          disabled={isRenamingProject}
                        />
                        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                          <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</span>
                          <span style={{ fontSize: "11px", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</span>
                        </div>
                      </div>
                      <span style={{
                        fontSize: "10px",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        backgroundColor: user.role === "admin" ? "rgba(239, 68, 68, 0.1)" : user.role === "manager" ? "rgba(245, 158, 11, 0.1)" : "rgba(99, 102, 241, 0.1)",
                        color: user.role === "admin" ? "#f87171" : user.role === "manager" ? "#fbbf24" : "#818cf8"
                      }}>
                        {user.role}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px" }}>
            <button 
              type="button" 
              onClick={onClose} 
              className="btn-secondary" 
              disabled={isRenamingProject}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isRenamingProject}>
              {isRenamingProject ? (
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
  );
}

// ==========================================
// 3. DELETE PROJECT MODAL
// ==========================================

interface DeleteProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProjectToDelete: any;
  isDeletingProject: boolean;
  onDeleteProject: () => void;
}

export function DeleteProjectModal({
  isOpen,
  onClose,
  selectedProjectToDelete,
  isDeletingProject,
  onDeleteProject,
}: DeleteProjectModalProps) {
  if (!isOpen || !selectedProjectToDelete) return null;

  return (
    <div className="modal-overlay">
      <div className="modal animate-scale-up">
        <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--accent-destructive)" }}>Delete Project?</h3>
        <p style={{ fontSize: "14px", color: "var(--text-secondary)", margin: 0, lineHeight: "1.5" }}>
          Are you sure you want to delete the project <strong>{selectedProjectToDelete.name}</strong>?
        </p>
        <div style={{ padding: "12px", backgroundColor: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "8px", fontSize: "12px", color: "var(--accent-destructive)", lineHeight: "1.4" }}>
          <strong>WARNING:</strong> This action cannot be undone. All folders and physical files inside this project will be permanently deleted from Cloudflare R2 and the database.
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px" }}>
          <button 
            type="button" 
            onClick={onClose} 
            className="btn-secondary" 
            disabled={isDeletingProject}
          >
            Cancel
          </button>
          <button 
            onClick={onDeleteProject} 
            className="btn-primary" 
            style={{ backgroundColor: "var(--accent-destructive)", display: "flex", alignItems: "center" }}
            autoFocus
            disabled={isDeletingProject}
          >
            {isDeletingProject ? (
              <>
                <Loader2 className="animate-spin" size={16} style={{ marginRight: "6px" }} />
                Deleting...
              </>
            ) : "Delete Permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}
