import React, { useState } from "react";
import {
  Folder,
  Users,
  Archive,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Share2,
  X,
  UserPlus,
  Check
} from "lucide-react";
import { Project, User } from "@/types/drive";

interface ProjectsTabProps {
  projects: Project[];
  currentUserId: string;
  users: User[];
  onCreateProject: (name: string, clientName: string, sharedWith: string) => Promise<void>;
  onEditProject: (id: string, name: string, clientName: string, sharedWith: string) => Promise<void>;
  onDeleteProject: (id: string) => Promise<void>;
  onSelectProject: (projectId: string, projectName: string) => void;
}

export function ProjectsTab({
  projects,
  currentUserId,
  users,
  onCreateProject,
  onEditProject,
  onDeleteProject,
  onSelectProject
}: ProjectsTabProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [showMenuForId, setShowMenuForId] = useState<string | null>(null);

  // Filter projects by category
  const myProjects = projects.filter(p => {
    const name = (p.name || "").toLowerCase();
    const client = (p.clientName || "").toLowerCase();
    const isArchive = name.includes("archive") || client.includes("archive");
    return p.userId === currentUserId && !isArchive;
  });

  const sharedProjects = projects.filter(p => {
    const name = (p.name || "").toLowerCase();
    const client = (p.clientName || "").toLowerCase();
    const isArchive = name.includes("archive") || client.includes("archive");
    return p.userId !== currentUserId && !isArchive;
  });

  const archiveProjects = projects.filter(p => {
    const name = (p.name || "").toLowerCase();
    const client = (p.clientName || "").toLowerCase();
    return name.includes("archive") || client.includes("archive");
  });

  const handleMenuClick = (project: Project, action: string) => {
    setActiveProject(project);
    setShowMenuForId(null);
    
    switch (action) {
      case "edit":
        setShowEditModal(true);
        break;
      case "share":
        setShowShareModal(true);
        break;
      case "delete":
        setShowDeleteConfirm(true);
        break;
    }
  };

  const renderProjectCard = (project: Project) => {
    const isOwner = project.userId === currentUserId;
    
    return (
      <div key={project.id} className="mobile-project-card">
        <button
          className="mobile-project-card-main"
          onClick={() => onSelectProject(project.id, project.name)}
        >
          <div className="mobile-project-icon">
            <Folder size={24} />
          </div>
          <div className="mobile-project-info">
            <h4 className="mobile-project-name">{project.name}</h4>
            {project.clientName && (
              <p className="mobile-project-client">{project.clientName}</p>
            )}
          </div>
        </button>
        
        {isOwner && (
          <div className="mobile-project-actions">
            <button
              className="mobile-project-menu-btn"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenuForId(showMenuForId === project.id ? null : project.id);
              }}
            >
              <MoreVertical size={20} />
            </button>
            
            {showMenuForId === project.id && (
              <div className="mobile-project-menu">
                <button onClick={() => handleMenuClick(project, "edit")}>
                  <Edit size={16} /> Edit
                </button>
                <button onClick={() => handleMenuClick(project, "share")}>
                  <Share2 size={16} /> Share
                </button>
                <button onClick={() => handleMenuClick(project, "delete")} className="danger">
                  <Trash2 size={16} /> Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderSection = (title: string, items: Project[], icon: any, emptyText: string) => {
    const Icon = icon;
    
    return (
      <div className="mobile-projects-section">
        <div className="mobile-projects-section-header">
          <Icon size={18} />
          <h3>{title}</h3>
          <span className="mobile-projects-count">{items.length}</span>
        </div>
        
        {items.length > 0 ? (
          <div className="mobile-projects-grid">
            {items.map(renderProjectCard)}
          </div>
        ) : (
          <div className="mobile-projects-empty">
            <Icon size={32} style={{ opacity: 0.3 }} />
            <p>{emptyText}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mobile-projects-tab">
      <div className="mobile-projects-header">
        <h2>Projects</h2>
        <button className="mobile-btn-create" onClick={() => setShowCreateModal(true)}>
          <Plus size={20} /> Create Project
        </button>
      </div>

      <div className="mobile-projects-content">
        {renderSection("My Projects", myProjects, Folder, "No projects yet")}
        {renderSection("Shared with Me", sharedProjects, Users, "No shared projects")}
        {renderSection("Archive", archiveProjects, Archive, "No archived projects")}
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || showEditModal) && (
        <ProjectFormModal
          isEdit={showEditModal}
          project={activeProject}
          users={users}
          currentUserId={currentUserId}
          onClose={() => {
            setShowCreateModal(false);
            setShowEditModal(false);
            setActiveProject(null);
          }}
          onSubmit={async (name, clientName, sharedWith) => {
            if (showEditModal && activeProject) {
              await onEditProject(activeProject.id, name, clientName, sharedWith);
            } else {
              await onCreateProject(name, clientName, sharedWith);
            }
            setShowCreateModal(false);
            setShowEditModal(false);
            setActiveProject(null);
          }}
        />
      )}

      {/* Share Modal */}
      {showShareModal && activeProject && (
        <ShareProjectModal
          project={activeProject}
          users={users}
          currentUserId={currentUserId}
          onClose={() => {
            setShowShareModal(false);
            setActiveProject(null);
          }}
          onSave={async (sharedWith) => {
            await onEditProject(
              activeProject.id,
              activeProject.name,
              activeProject.clientName || "",
              sharedWith
            );
            setShowShareModal(false);
            setActiveProject(null);
          }}
        />
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && activeProject && (
        <DeleteConfirmModal
          projectName={activeProject.name}
          onClose={() => {
            setShowDeleteConfirm(false);
            setActiveProject(null);
          }}
          onConfirm={async () => {
            await onDeleteProject(activeProject.id);
            setShowDeleteConfirm(false);
            setActiveProject(null);
          }}
        />
      )}
    </div>
  );
}

// Project Form Modal (Create/Edit)
function ProjectFormModal({
  isEdit,
  project,
  users,
  currentUserId,
  onClose,
  onSubmit
}: {
  isEdit: boolean;
  project: Project | null;
  users: User[];
  currentUserId: string;
  onClose: () => void;
  onSubmit: (name: string, clientName: string, sharedWith: string) => Promise<void>;
}) {
  const [name, setName] = useState(project?.name || "");
  const [clientName, setClientName] = useState(project?.clientName || "");
  const [shareType, setShareType] = useState<"all" | "specific">(
    project?.sharedWith === "all" || !project?.sharedWith ? "all" : "specific"
  );
  const [selectedUsers, setSelectedUsers] = useState<string[]>(
    project?.sharedWith && project.sharedWith !== "all"
      ? project.sharedWith.split(",").map(id => id.trim())
      : []
  );
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const sharedWith = shareType === "all" ? "all" : selectedUsers.join(",");
      await onSubmit(name, clientName, sharedWith);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mobile-modal-overlay" onClick={onClose}>
      <div className="mobile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mobile-modal-header">
          <h3>{isEdit ? "Edit Project" : "Create Project"}</h3>
          <button onClick={onClose} className="mobile-modal-close">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="mobile-modal-body">
          <div className="mobile-form-group">
            <label>Project Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Marketing Campaign"
              required
            />
          </div>

          <div className="mobile-form-group">
            <label>Client Name (Optional)</label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="e.g., Acme Corp"
            />
          </div>

          <div className="mobile-form-group">
            <label>Share With</label>
            <div className="mobile-radio-group">
              <label className="mobile-radio-label">
                <input
                  type="radio"
                  checked={shareType === "all"}
                  onChange={() => setShareType("all")}
                />
                <span>Everyone</span>
              </label>
              <label className="mobile-radio-label">
                <input
                  type="radio"
                  checked={shareType === "specific"}
                  onChange={() => setShareType("specific")}
                />
                <span>Specific Users</span>
              </label>
            </div>
          </div>

          {shareType === "specific" && (
            <div className="mobile-form-group">
              <label>Select Users</label>
              <div className="mobile-user-select">
                {users
                  .filter(u => u.id !== currentUserId)
                  .map(user => (
                    <label key={user.id} className="mobile-user-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedUsers([...selectedUsers, user.id]);
                          } else {
                            setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                          }
                        }}
                      />
                      <span>{user.name}</span>
                    </label>
                  ))}
              </div>
            </div>
          )}

          <div className="mobile-modal-footer">
            <button type="button" onClick={onClose} className="mobile-btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="mobile-btn-primary">
              {loading ? "Saving..." : isEdit ? "Save Changes" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Share Project Modal
function ShareProjectModal({
  project,
  users,
  currentUserId,
  onClose,
  onSave
}: {
  project: Project;
  users: User[];
  currentUserId: string;
  onClose: () => void;
  onSave: (sharedWith: string) => Promise<void>;
}) {
  const [shareType, setShareType] = useState<"all" | "specific">(
    project.sharedWith === "all" || !project.sharedWith ? "all" : "specific"
  );
  const [selectedUsers, setSelectedUsers] = useState<string[]>(
    project.sharedWith && project.sharedWith !== "all"
      ? project.sharedWith.split(",").map(id => id.trim())
      : []
  );
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      const sharedWith = shareType === "all" ? "all" : selectedUsers.join(",");
      await onSave(sharedWith);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mobile-modal-overlay" onClick={onClose}>
      <div className="mobile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mobile-modal-header">
          <h3>Share Project</h3>
          <button onClick={onClose} className="mobile-modal-close">
            <X size={20} />
          </button>
        </div>
        
        <div className="mobile-modal-body">
          <div className="mobile-project-share-info">
            <Folder size={24} />
            <div>
              <h4>{project.name}</h4>
              {project.clientName && <p>{project.clientName}</p>}
            </div>
          </div>

          <div className="mobile-form-group">
            <label>Share With</label>
            <div className="mobile-radio-group">
              <label className="mobile-radio-label">
                <input
                  type="radio"
                  checked={shareType === "all"}
                  onChange={() => setShareType("all")}
                />
                <span>Everyone</span>
              </label>
              <label className="mobile-radio-label">
                <input
                  type="radio"
                  checked={shareType === "specific"}
                  onChange={() => setShareType("specific")}
                />
                <span>Specific Users</span>
              </label>
            </div>
          </div>

          {shareType === "specific" && (
            <div className="mobile-form-group">
              <label>Select Users</label>
              <div className="mobile-user-select">
                {users
                  .filter(u => u.id !== currentUserId)
                  .map(user => (
                    <label key={user.id} className="mobile-user-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedUsers([...selectedUsers, user.id]);
                          } else {
                            setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                          }
                        }}
                      />
                      <span>{user.name}</span>
                    </label>
                  ))}
              </div>
            </div>
          )}

          <div className="mobile-modal-footer">
            <button onClick={onClose} className="mobile-btn-secondary">
              Cancel
            </button>
            <button onClick={handleSave} disabled={loading} className="mobile-btn-primary">
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Delete Confirmation Modal
function DeleteConfirmModal({
  projectName,
  onClose,
  onConfirm
}: {
  projectName: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mobile-modal-overlay" onClick={onClose}>
      <div className="mobile-modal mobile-modal-danger" onClick={(e) => e.stopPropagation()}>
        <div className="mobile-modal-header">
          <h3>Delete Project</h3>
          <button onClick={onClose} className="mobile-modal-close">
            <X size={20} />
          </button>
        </div>
        
        <div className="mobile-modal-body">
          <div className="mobile-delete-warning">
            <Trash2 size={48} />
            <p>
              Are you sure you want to delete <strong>{projectName}</strong>?
            </p>
            <p className="mobile-delete-warning-text">
              This will permanently delete all files and folders in this project. This action cannot be undone.
            </p>
          </div>

          <div className="mobile-modal-footer">
            <button onClick={onClose} className="mobile-btn-secondary">
              Cancel
            </button>
            <button onClick={handleConfirm} disabled={loading} className="mobile-btn-danger">
              {loading ? "Deleting..." : "Delete Project"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
