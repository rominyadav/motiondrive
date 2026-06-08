"use client";

import { use, useState, useEffect } from "react";
import { 
  getPublicSharedFolderDetails, 
  listSharedFolderContents, 
  getSharedFileDownloadUrl 
} from "@/app/actions/share";
import { 
  Folder, 
  File, 
  Download, 
  Loader2, 
  AlertTriangle, 
  Clock, 
  ShieldCheck, 
  Calendar,
  HardDrive
} from "lucide-react";
import Link from "next/link";
import "./share.css";

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export default function ShareFolderView({ params }: PageProps) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<{
    id: string;
    filename: string;
    isFolder: boolean;
    expiresAt: Date;
  } | null>(null);
  const [assetsList, setAssetsList] = useState<any[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    async function loadFolderData() {
      try {
        setLoading(true);
        // 1. Fetch details
        const detailsRes = await getPublicSharedFolderDetails(id);
        if (!detailsRes.success) {
          setError(detailsRes.error || "Failed to load shared folder details");
          setLoading(false);
          return;
        }

        setDetails({
          id: detailsRes.id!,
          filename: detailsRes.filename!,
          isFolder: detailsRes.isFolder!,
          expiresAt: new Date(detailsRes.expiresAt!),
        });

        // 2. Fetch contents
        const contentsRes = await listSharedFolderContents(id);
        if (contentsRes.success && contentsRes.assets) {
          setAssetsList(contentsRes.assets);
        }
      } catch (err: any) {
        console.error("Error loading shared folder contents:", err);
        setError("An unexpected error occurred while fetching shared files.");
      } finally {
        setLoading(false);
      }
    }

    loadFolderData();
  }, [id]);

  // Expiration countdown logic
  useEffect(() => {
    if (!details?.expiresAt) return;

    const timer = setInterval(() => {
      const difference = details.expiresAt.getTime() - Date.now();
      if (difference <= 0) {
        setTimeLeft("Expired");
        clearInterval(timer);
        setError("This shared link has expired automatically.");
      } else {
        const hours = Math.floor(difference / (1000 * 60 * 60));
        const minutes = Math.floor((difference / 1000 / 60) % 60);
        const seconds = Math.floor((difference / 1000) % 60);
        
        let formatted = "";
        if (hours > 0) formatted += `${hours}h `;
        formatted += `${minutes}m ${seconds}s`;
        setTimeLeft(formatted);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [details?.expiresAt]);

  const handleDownload = async (asset: any) => {
    try {
      setDownloadingId(asset.id);
      const res = await getSharedFileDownloadUrl(id, asset.id);
      
      // Programmatically trigger the browser download
      const link = document.createElement("a");
      link.href = res.downloadUrl;
      link.setAttribute("download", res.filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert("Failed to download file. Please try again.");
      console.error(err);
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="share-body" style={{ justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
          <Loader2 className="spin-anim" style={{ width: "40px", height: "40px", color: "#6366f1" }} />
          <h2 style={{ fontSize: "1.1rem", fontWeight: 500, color: "#a1a1aa" }}>Verifying secure connection...</h2>
        </div>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="share-body" style={{ justifyContent: "center" }}>
        <div className="error-card animate-fade-in">
          <div className="error-icon-box">
            <AlertTriangle size={24} />
          </div>
          <h1 className="error-title">Link Expired or Invalid</h1>
          <p className="error-desc">
            {error || "This shared folder link has expired, been revoked, or does not exist."}
          </p>
          <Link href="/" className="error-action-btn">
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="share-body">
      {/* Header */}
      <header className="share-header">
        <Link href="/" className="share-logo">
          <div className="share-logo-box">M</div>
          <span>Motion Drive</span>
        </Link>
        <div className="share-badge">
          <ShieldCheck size={14} />
          <span>Proxied Encryption</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="share-container animate-fade-in">
        {/* Info Card */}
        <div className="folder-info-card">
          <div className="folder-details">
            <div className="folder-icon-wrapper">
              <Folder size={26} />
            </div>
            <div>
              <span className="folder-title-sub">Shared Folder</span>
              <h1 className="folder-title-main">{details.filename}</h1>
              <p className="folder-meta-text">
                Contains {assetsList.length} shared {assetsList.length === 1 ? 'item' : 'items'}
              </p>
            </div>
          </div>

          {/* Expiration Countdown */}
          <div className="expiry-clock">
            <Clock className="expiry-clock-icon" size={18} />
            <div>
              <div className="expiry-label">Expires In</div>
              <div className="expiry-time">{timeLeft || "calculating..."}</div>
            </div>
          </div>
        </div>

        {/* Assets List Card */}
        <div className="assets-card">
          <div className="assets-card-header">
            <span className="assets-title">Shared Files</span>
            <span className="assets-date">
              Active Link
            </span>
          </div>

          {assetsList.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon-box">
                <Folder size={20} />
              </div>
              <h3 className="empty-title">This folder is empty</h3>
              <p className="empty-desc">No files are currently shared inside this folder.</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="assets-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th style={{ width: "120px" }}>Size</th>
                    <th style={{ width: "160px" }} className="hidden-mobile">Type</th>
                    <th style={{ width: "80px", textAlign: "right" }}>Download</th>
                  </tr>
                </thead>
                <tbody>
                  {assetsList.map((asset) => (
                    <tr key={asset.id}>
                      <td>
                        <div className="file-name-cell">
                          <div className="file-icon-box">
                            <File size={16} />
                          </div>
                          <span className="file-name-text" title={asset.filename}>
                            {asset.filename}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="file-size-text">{formatBytes(asset.size)}</span>
                      </td>
                      <td className="hidden-mobile">
                        <span className="file-type-text">{asset.mimeType || "Binary File"}</span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="download-btn"
                          onClick={() => handleDownload(asset)}
                          disabled={downloadingId !== null}
                          title="Secure Download"
                        >
                          {downloadingId === asset.id ? (
                            <Loader2 size={15} className="spin-anim" />
                          ) : (
                            <Download size={15} />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="share-footer">
        <p>© {new Date().getFullYear()} Motion Drive. Powered by high-speed proxied sharing architecture.</p>
      </footer>
    </div>
  );
}
