import React from "react";
import { Minus, X, Download, Loader2, CheckCircle } from "lucide-react";

interface DownloadItem {
  progress: number;
  isCancelled?: boolean;
  isFailed?: boolean;
}

interface TransferMetrics {
  [key: string]: {
    speedText: string;
    etaText: string;
  };
}

interface TransferDrawerProps {
  uploadActive: boolean;
  downloadActive: boolean;
  uploadMinimized: boolean;
  setUploadActive: (v: boolean) => void;
  setDownloadActive: (v: boolean) => void;
  setUploadMinimized: (v: boolean) => void;
  uploadProgress: { [filename: string]: number };
  setUploadProgress: (v: any) => void;
  downloadProgress: { [filename: string]: DownloadItem };
  setDownloadProgress: (v: any) => void;
  transferMetrics: TransferMetrics;
  uploadErrors: { [filename: string]: string };
  handleCancelUpload: (filename: string) => void;
  handleCancelDownload: (filename: string) => void;
}

export function TransferDrawer({
  uploadActive,
  downloadActive,
  uploadMinimized,
  setUploadActive,
  setDownloadActive,
  setUploadMinimized,
  uploadProgress,
  setUploadProgress,
  downloadProgress,
  setDownloadProgress,
  transferMetrics,
  uploadErrors,
  handleCancelUpload,
  handleCancelDownload,
}: TransferDrawerProps) {
  const isAnyActiveProgress =
    Object.values(uploadProgress).some(progress => progress >= 0 && progress < 100) ||
    Object.values(downloadProgress).some(item => !item.isCancelled && !item.isFailed && item.progress < 100);

  if (!(uploadActive || downloadActive)) return null;

  if (uploadMinimized) {
    return (
      <div 
        className="upload-minimized-pill" 
        onClick={() => setUploadMinimized(false)}
        title="Click to expand status"
      >
        <div className="minimized-pill-content">
          {isAnyActiveProgress ? (
            <Loader2 className="upload-spin-icon" size={16} />
          ) : (
            <CheckCircle size={16} style={{ color: "var(--accent-success, #10b981)" }} />
          )}
          <span className="minimized-pill-text">
            {(() => {
              const activeUploads = Object.entries(uploadProgress).filter(([k, p]) => p >= 0 && p < 100 && !k.startsWith("Moving") && !k.startsWith("Copying") && !k.startsWith("Deleting"));
              const activeOps = Object.entries(uploadProgress).filter(([k, p]) => p >= 0 && p < 100 && (k.startsWith("Moving") || k.startsWith("Copying") || k.startsWith("Deleting")));
              const activeDownloads = Object.entries(downloadProgress).filter(([_, item]) => !item.isCancelled && !item.isFailed && item.progress >= 0 && item.progress < 100);

              const upCount = activeUploads.length;
              const opCount = activeOps.length;
              const downCount = activeDownloads.length;

              if (upCount > 0 || opCount > 0 || downCount > 0) {
                const parts: string[] = [];
                if (upCount > 0) {
                  parts.push(`Uploading ${upCount} file${upCount > 1 ? 's' : ''}`);
                }
                if (downCount > 0) {
                  parts.push(`Downloading ${downCount} file${downCount > 1 ? 's' : ''}`);
                }
                if (opCount > 0) {
                  parts.push(`${opCount} file operation${opCount > 1 ? 's' : ''}`);
                }
                return parts.join(" & ") + "...";
              }
              return "Operations completed";
            })()}
          </span>
        </div>
        <div className="minimized-pill-actions" onClick={(e) => e.stopPropagation()}>
          {!isAnyActiveProgress && (
            <button 
              onClick={() => {
                setUploadActive(false);
                setDownloadActive(false);
                setUploadProgress({});
                setDownloadProgress({});
              }} 
              className="btn-icon minimized-close-btn"
              style={{ padding: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Close"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="progress-drawer">
      <div className="drawer-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <span className="drawer-title" style={{ fontWeight: '600' }}>
          {Object.keys(uploadProgress).some(k => k.startsWith("Moving") || k.startsWith("Copying") || k.startsWith("Deleting"))
            ? "Transfers & Operations"
            : (Object.keys(downloadProgress).length > 0 && Object.keys(uploadProgress).length > 0)
              ? "Transfers & Operations"
              : Object.keys(downloadProgress).length > 0
                ? "Downloading File(s)"
                : "Uploading Video Chunk(s)"}
        </span>
        <div className="drawer-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button 
            onClick={() => setUploadMinimized(true)} 
            className="btn-icon" 
            style={{ padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Minimize"
          >
            <Minus size={14} />
          </button>
          {!isAnyActiveProgress && (
            <button 
              onClick={() => {
                setUploadActive(false);
                setDownloadActive(false);
                setUploadProgress({});
                setDownloadProgress({});
              }} 
              className="btn-icon" 
              style={{ padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Close"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>
      <div className="drawer-body">
        {/* Upload items */}
        {Object.entries(uploadProgress).map(([filename, progress]) => {
          const isUploading = progress >= 0 && progress < 100;
          const isCompleted = progress === 100;
          const isCancelled = progress === -1;
          const isFailed = progress === -2;
          const isBackgroundOp = filename.startsWith("Moving") || filename.startsWith("Copying") || filename.startsWith("Deleting");

          return (
            <div key={filename} className="upload-item">
              <div className="upload-info" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 0%', minWidth: 0 }}>
                  <span className="upload-name" title={filename} style={{ fontSize: '13px', fontWeight: '600' }}>
                    {filename}
                  </span>
                  {isUploading && transferMetrics[filename] && (
                    <span style={{ fontSize: '10px', color: 'var(--text-muted, #9ca3af)', marginTop: '1px' }}>
                      {transferMetrics[filename].speedText} • {transferMetrics[filename].etaText}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginTop: '2px' }}>
                  <span className="upload-status-text" style={{ 
                    fontSize: '11px',
                    fontWeight: '700',
                    color: isCompleted 
                      ? 'var(--accent-success, #10b981)' 
                      : isCancelled 
                        ? 'var(--text-secondary)' 
                        : isFailed 
                          ? 'var(--accent-danger, #ef4444)' 
                          : 'var(--brand-accent)'
                  }}>
                    {isCompleted && "COMPLETED"}
                    {isCancelled && "CANCELLED"}
                    {isFailed && "FAILED"}
                    {isUploading && (isBackgroundOp ? "WORKING..." : `${progress}%`)}
                  </span>

                  {isUploading && !isBackgroundOp && (
                    <button
                      onClick={() => handleCancelUpload(filename)}
                      className="btn-icon cancel-upload-btn"
                      style={{ 
                        padding: '1px',
                        color: 'var(--text-muted)',
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        cursor: 'pointer'
                      }}
                      title="Cancel Upload"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
              <div className="progress-track">
                <div 
                  className={`progress-bar ${isCancelled ? 'cancelled' : isFailed ? 'failed' : ''} ${isBackgroundOp && isUploading ? 'indeterminate' : ''}`} 
                  style={{ 
                    width: `${isCancelled || isFailed ? 100 : (isBackgroundOp && isUploading) ? 100 : progress}%`,
                    background: isCancelled 
                      ? 'var(--border-color, #374151)' 
                      : isFailed 
                        ? 'var(--accent-danger, #ef4444)' 
                        : (isBackgroundOp && isUploading)
                          ? undefined
                          : 'linear-gradient(90deg, var(--accent-blue), var(--accent-indigo))'
                  }} 
                />
              </div>
              {isFailed && uploadErrors[filename] && (
                <div style={{ fontSize: '10px', color: 'var(--accent-danger, #ef4444)', marginTop: '4px', wordBreak: 'break-all', opacity: 0.9 }}>
                  {uploadErrors[filename]}
                </div>
              )}
            </div>
          );
        })}

        {/* Download items */}
        {Object.entries(downloadProgress).map(([filename, item]) => {
          const progress = item.progress;
          const isDownloading = progress >= 0 && progress < 100 && !item.isCancelled && !item.isFailed;
          const isCompleted = progress === 100;
          const isCancelled = item.isCancelled || progress === -1;
          const isFailed = item.isFailed || progress === -2;

          return (
            <div key={filename} className="upload-item">
              <div className="upload-info" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '1 1 0%', minWidth: 0 }}>
                  <Download size={14} style={{ color: 'var(--accent-indigo, #6366f1)', flexShrink: 0 }} />
                  <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minWidth: 0 }}>
                    <span className="upload-name" title={filename} style={{ fontSize: '13px', fontWeight: '600' }}>
                      {filename}
                    </span>
                    {isDownloading && transferMetrics[filename] && (
                      <span style={{ fontSize: '10px', color: 'var(--text-muted, #9ca3af)', marginTop: '1px' }}>
                        {transferMetrics[filename].speedText} • {transferMetrics[filename].etaText}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginTop: '2px' }}>
                  <span className="upload-status-text" style={{ 
                    fontSize: '11px',
                    fontWeight: '700',
                    color: isCompleted 
                      ? 'var(--accent-success, #10b981)' 
                      : isCancelled 
                        ? 'var(--text-secondary)' 
                        : isFailed 
                          ? 'var(--accent-danger, #ef4444)' 
                          : 'var(--accent-indigo)'
                  }}>
                    {isCompleted && "DOWNLOADED"}
                    {isCancelled && "CANCELLED"}
                    {isFailed && "FAILED"}
                    {isDownloading && `${progress}%`}
                  </span>

                  {isDownloading && (
                    <button
                      onClick={() => handleCancelDownload(filename)}
                      className="btn-icon cancel-upload-btn"
                      style={{ 
                        padding: '1px',
                        color: 'var(--text-muted)',
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        cursor: 'pointer'
                      }}
                      title="Cancel Download"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
              <div className="progress-track">
                <div 
                  className={`progress-bar ${isCancelled ? 'cancelled' : isFailed ? 'failed' : ''}`} 
                  style={{ 
                    width: `${isCancelled || isFailed ? 100 : progress}%`,
                    background: isCancelled 
                      ? 'var(--border-color, #374151)' 
                      : isFailed 
                        ? 'var(--accent-danger, #ef4444)' 
                        : 'linear-gradient(90deg, #6366f1, #a855f7)' // Indigo to Purple gradient
                  }} 
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
