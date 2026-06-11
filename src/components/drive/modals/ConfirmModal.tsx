import React from "react";

interface ConfirmModalData {
  open: boolean;
  title: string;
  message: string;
  warning?: string;
  confirmText?: string;
  confirmColor?: string;
  onConfirm: () => void;
}

interface ConfirmModalProps {
  confirmModal: ConfirmModalData | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function ConfirmModal({ confirmModal, onClose, onConfirm }: ConfirmModalProps) {
  if (!confirmModal || !confirmModal.open) return null;

  return (
    <div className="modal-overlay">
      <div className="modal animate-scale-up">
        <h3 style={{ fontSize: "18px", fontWeight: "700", color: confirmModal.confirmColor || "var(--accent-destructive)" }}>
          {confirmModal.title}
        </h3>
        <p style={{ fontSize: "14px", color: "var(--text-secondary)", margin: 0, lineHeight: "1.5" }}>
          {confirmModal.message}
        </p>
        {confirmModal.warning && (
          <div style={{
            padding: "12px",
            backgroundColor: "rgba(239, 68, 68, 0.05)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            borderRadius: "8px",
            fontSize: "12px",
            color: "var(--accent-destructive)",
            lineHeight: "1.4"
          }}>
            <strong>WARNING:</strong> {confirmModal.warning}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px" }}>
          <button 
            type="button" 
            onClick={onClose} 
            className="btn-secondary"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm} 
            className="btn-primary" 
            style={{ backgroundColor: confirmModal.confirmColor || "var(--accent-destructive)" }}
            autoFocus
          >
            {confirmModal.confirmText || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
