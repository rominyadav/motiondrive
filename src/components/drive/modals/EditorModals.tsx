import React from "react";

// ==========================================
// 1. PLAIN TEXT CREATOR / EDITOR MODAL
// ==========================================

interface TextEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  textEditorMode: "create" | "edit";
  textFileName: string;
  setTextFileName: (v: string) => void;
  textContent: string;
  setTextContent: (v: string) => void;
  onSave: (e: React.FormEvent) => void;
}

export function TextEditorModal({
  isOpen,
  onClose,
  textEditorMode,
  textFileName,
  setTextFileName,
  textContent,
  setTextContent,
  onSave,
}: TextEditorModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: "800px", width: "90vw" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px", marginBottom: "16px" }}>
          <h3 style={{ fontSize: "18px", fontWeight: "700" }}>
            {textEditorMode === "create" ? "Create Text File" : "Edit Text File"}
          </h3>
        </div>
        <form onSubmit={onSave} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Filename</label>
            <input 
              type="text" 
              className="form-input" 
              value={textFileName}
              onChange={(e) => setTextFileName(e.target.value)}
              placeholder="e.g. notes.txt"
              required
              disabled={textEditorMode === "edit"}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">File Content</label>
            <textarea 
              className="form-input" 
              style={{
                fontFamily: "monospace",
                minHeight: "350px",
                resize: "vertical",
                fontSize: "14px",
                lineHeight: "1.5",
                backgroundColor: "var(--bg-primary)",
                color: "var(--text-primary)"
              }}
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="Start typing your text here..."
              autoFocus
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
            <button 
              type="button" 
              onClick={onClose} 
              className="btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save File
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// 2. QUILL DOCS RICH-TEXT EDITOR MODAL
// ==========================================

interface DocsEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  docsEditorMode: "create" | "edit";
  docTitle: string;
  setDocTitle: (v: string) => void;
  editorContainerRef: React.RefObject<HTMLDivElement | null>;
  onSave: (e: React.FormEvent) => void;
}

export function DocsEditorModal({
  isOpen,
  onClose,
  docsEditorMode,
  docTitle,
  setDocTitle,
  editorContainerRef,
  onSave,
}: DocsEditorModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: "900px", width: "95vw", maxHeight: "95vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px", marginBottom: "16px" }}>
          <h3 style={{ fontSize: "18px", fontWeight: "700" }}>
            {docsEditorMode === "create" ? "Create Rich Document" : "Edit Rich Document"}
          </h3>
        </div>
        <form onSubmit={onSave} style={{ display: "flex", flexDirection: "column", gap: "16px", flex: 1, overflow: "hidden" }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Document Title</label>
            <input 
              type="text" 
              className="form-input" 
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              placeholder="e.g. Project Proposal"
              required
              disabled={docsEditorMode === "edit"}
            />
          </div>
          
          <div style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: "350px",
            overflow: "hidden",
            backgroundColor: "#fff",
            color: "#333",
            borderRadius: "8px"
          }} className="quill-editor-wrapper">
            <div ref={editorContainerRef as any} style={{ flex: 1, overflow: "auto" }} />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px" }}>
            <button 
              type="button" 
              onClick={onClose} 
              className="btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save Document
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// 3. SPREADSHEET GRID SHEET MODAL
// ==========================================

interface SheetEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  sheetEditorMode: "create" | "edit";
  sheetName: string;
  setSheetName: (v: string) => void;
  sheetCells: { [key: string]: string };
  onCellChange: (col: string, row: number, val: string) => void;
  onSave: (e: React.FormEvent) => void;
}

export function SheetEditorModal({
  isOpen,
  onClose,
  sheetEditorMode,
  sheetName,
  setSheetName,
  sheetCells,
  onCellChange,
  onSave,
}: SheetEditorModalProps) {
  if (!isOpen) return null;

  const columnsList = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const rowsCount = 20;

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: "1000px", width: "95vw", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px", marginBottom: "16px" }}>
          <h3 style={{ fontSize: "18px", fontWeight: "700" }}>
            {sheetEditorMode === "create" ? "Create Blank Sheet" : "Edit Spreadsheet"}
          </h3>
        </div>
        <form onSubmit={onSave} style={{ display: "flex", flexDirection: "column", gap: "16px", flex: 1, overflow: "hidden" }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Spreadsheet Name</label>
            <input 
              type="text" 
              className="form-input" 
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
              placeholder="e.g. Budget 2026"
              required
              disabled={sheetEditorMode === "edit"}
            />
          </div>
          
          <div style={{
            flex: 1,
            overflow: "auto",
            border: "1px solid var(--border-color)",
            borderRadius: "8px",
            backgroundColor: "var(--bg-primary)"
          }} className="sheet-grid-wrapper">
            <table className="spreadsheet-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr>
                  <th style={{
                    width: "40px",
                    backgroundColor: "var(--bg-secondary)",
                    border: "1px solid var(--border-color)",
                    padding: "6px",
                    color: "var(--text-secondary)",
                    textAlign: "center",
                    position: "sticky",
                    top: 0
                  }}>#</th>
                  {columnsList.map((col) => (
                    <th key={col} style={{
                      width: "100px",
                      backgroundColor: "var(--bg-secondary)",
                      border: "1px solid var(--border-color)",
                      padding: "6px",
                      color: "var(--text-secondary)",
                      textAlign: "center",
                      position: "sticky",
                      top: 0
                    }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: rowsCount }).map((_, rIdx) => {
                  const rowNumber = rIdx + 1;
                  return (
                    <tr key={rowNumber}>
                      <td style={{
                        backgroundColor: "var(--bg-secondary)",
                        border: "1px solid var(--border-color)",
                        padding: "6px",
                        color: "var(--text-secondary)",
                        fontWeight: "bold",
                        textAlign: "center"
                      }}>{rowNumber}</td>
                      {columnsList.map((col) => {
                        const refKey = `${col}${rowNumber}`;
                        return (
                          <td key={col} style={{ border: "1px solid var(--border-color)", padding: 0 }}>
                            <input 
                              type="text" 
                              style={{
                                width: "100%",
                                border: "none",
                                outline: "none",
                                padding: "8px",
                                backgroundColor: "transparent",
                                color: "var(--text-primary)",
                                fontSize: "13px",
                                fontFamily: "inherit"
                              }}
                              value={sheetCells[refKey] || ""}
                              onChange={(e) => onCellChange(col, rowNumber, e.target.value)}
                              placeholder=""
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px" }}>
            <button 
              type="button" 
              onClick={onClose} 
              className="btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save Sheet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
