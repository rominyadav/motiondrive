import React from "react";
import { X, Folder, Users, Archive as ArchiveIcon } from "lucide-react";
import { Project } from "@/types/drive";

interface ProjectPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  currentUserId: string;
  onSelectProject: (projectId: string, projectName: string) => void;
}

export function ProjectPickerModal({
  isOpen,
  onClose,
  projects,
  currentUserId,
  onSelectProject
}: ProjectPickerModalProps) {
  if (!isOpen) return null;

  const yourProjects = projects.filter(p => {
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

  const renderProjectSection = (title: string, items: Project[], icon: any) => {
    const Icon = icon;
    if (items.length === 0) return null;

    return (
      <div className="project-section">
        <div className="project-section-header">
          <Icon size={16} />
          <h3>{title}</h3>
          <span className="project-count">{items.length}</span>
        </div>
        <div className="project-list">
          {items.map(project => (
            <button
              key={project.id}
              className="project-item"
              onClick={() => {
                onSelectProject(project.id, project.name);
                onClose();
              }}
            >
              <Folder size={18} />
              <div className="project-info">
                <span className="project-name">{project.name}</span>
                {project.clientName && (
                  <span className="project-client">{project.clientName}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="project-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Select Project</h2>
          <button onClick={onClose} className="btn-close">
            <X size={20} />
          </button>
        </div>
        
        <div className="modal-body">
          {renderProjectSection("My Projects", yourProjects, Folder)}
          {renderProjectSection("Shared Projects", sharedProjects, Users)}
          {renderProjectSection("Archive Projects", archiveProjects, ArchiveIcon)}
          
          {projects.length === 0 && (
            <div className="empty-state">
              <Folder size={48} style={{ opacity: 0.3 }} />
              <p>No projects available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
