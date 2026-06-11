import React from "react";
import { File, ChevronRight, Loader2, Download } from "lucide-react";
import { Asset } from "@/types/drive";

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  previewTarget: Asset | null;
  previewLoading: boolean;
  previewUrl: string;
  previewTextContent: string;
  onDownload: (id: string) => void;
}

export function PreviewModal({
  isOpen,
  onClose,
  previewTarget,
  previewLoading,
  previewUrl,
  previewTextContent,
  onDownload,
}: PreviewModalProps) {
  if (!isOpen || !previewTarget) return null;

  const fileExtension = previewTarget.filename.split(".").pop()?.toLowerCase() || "";
  const isImage = ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(fileExtension);
  const isVideo = ["mp4", "mkv", "mov", "avi", "webm", "ogg"].includes(fileExtension);
  const isText = ["txt", "md", "json", "js", "ts", "css", "html", "csv", "xml", "yaml", "yml"].includes(fileExtension);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "80vw", width: "800px", background: "var(--bg-secondary)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <File className="file-icon" size={22} />
            <h3 style={{ fontSize: "16px", fontWeight: "700", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "450px" }}>
              Preview: {previewTarget.filename}
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="btn-icon"
            title="Close Preview"
          >
            <ChevronRight size={20} style={{ transform: "rotate(90deg)" }} />
          </button>
        </div>

        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "200px", maxHeight: "70vh", overflow: "hidden" }}>
          {previewLoading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
              <Loader2 className="animate-spin brand-accent" size={32} />
              <span>Loading Preview...</span>
            </div>
          ) : (
            <>
              {isImage ? (
                <img 
                  src={previewUrl} 
                  alt={previewTarget.filename} 
                  style={{ maxWidth: "100%", maxHeight: "65vh", objectFit: "contain", borderRadius: "8px" }} 
                />
              ) : isVideo ? (
                <video 
                  src={previewUrl} 
                  controls 
                  autoPlay 
                  style={{ maxWidth: "100%", maxHeight: "65vh", borderRadius: "8px" }} 
                />
              ) : isText ? (
                <pre style={{
                  width: "100%",
                  maxHeight: "65vh",
                  overflow: "auto",
                  padding: "16px",
                  backgroundColor: "var(--bg-primary)",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontFamily: "monospace",
                  textAlign: "left",
                  whiteSpace: "pre-wrap",
                  border: "1px solid var(--border-color)",
                  color: "var(--text-primary)"
                }}>
                  {previewTextContent}
                </pre>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", padding: "32px 16px" }}>
                  <File size={64} style={{ color: "var(--text-muted)" }} />
                  <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
                    No direct preview available for this file type ({previewTarget.mimeType}).
                  </p>
                  <button 
                    onClick={() => onDownload(previewTarget.id)}
                    className="btn-primary"
                    style={{ display: "flex", alignItems: "center", gap: "8px", height: "38px" }}
                  >
                    <Download size={16} />
                    <span>Download File</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
