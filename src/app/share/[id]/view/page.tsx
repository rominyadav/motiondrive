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
        // Trigger page re-fetch or show expired state
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
      <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
          <h2 className="text-xl font-medium text-slate-300">Loading secure shared folder...</h2>
          <p className="text-sm text-slate-500">Decrypting links and files list</p>
        </div>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-slate-900/50 backdrop-blur-xl border border-red-500/20 rounded-2xl p-8 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-red-500/30" />
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold mb-3 bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">
            Access Denied
          </h1>
          <p className="text-slate-400 mb-8 leading-relaxed">
            {error || "The link you are trying to access is invalid, revoked, or expired."}
          </p>
          <Link 
            href="/"
            className="inline-flex items-center justify-center bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-medium px-6 py-3 rounded-xl transition-all shadow-lg hover:shadow-indigo-500/20 transform hover:-translate-y-0.5"
          >
            Go to Motion Drive
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col relative overflow-hidden">
      {/* Background glowing effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-white/5 bg-slate-900/20 backdrop-blur-md px-6 py-4 flex items-center justify-between z-10">
        <Link href="/" className="flex items-center space-x-3">
          <div className="w-9 h-9 bg-gradient-to-tr from-indigo-600 to-blue-500 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <span className="text-white font-bold text-lg">M</span>
          </div>
          <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            Motion Drive <span className="text-indigo-400 font-medium text-sm ml-1 px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">SECURE LINK</span>
          </span>
        </Link>
        
        <div className="flex items-center space-x-2 text-xs font-medium text-slate-400 bg-slate-800/40 px-3 py-1.5 rounded-full border border-white/5">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Proxied Encryption Active</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8 z-10 flex flex-col space-y-6">
        {/* Banner/Header Info */}
        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 md:p-8 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start space-x-4">
            <div className="w-14 h-14 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400 shrink-0">
              <Folder className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-indigo-400 uppercase tracking-widest">Shared Folder</span>
              </div>
              <h1 className="text-xl md:text-2xl font-bold mt-1 text-white leading-tight">
                {details.filename}
              </h1>
              <p className="text-sm text-slate-400 mt-1 flex items-center gap-1.5">
                <HardDrive className="w-4 h-4 text-slate-500" />
                <span>Contains {assetsList.length} shared {assetsList.length === 1 ? 'item' : 'items'}</span>
              </p>
            </div>
          </div>

          {/* Expiration Card */}
          <div className="flex items-center space-x-4 bg-slate-800/30 border border-white/5 px-5 py-4 rounded-xl md:self-stretch">
            <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-center text-amber-400 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Link Expires In</p>
              <p className="text-lg font-mono font-bold text-amber-300 mt-0.5">{timeLeft || "Checking..."}</p>
            </div>
          </div>
        </div>

        {/* Files Grid/Table */}
        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-2xl shadow-xl overflow-hidden flex-1 flex flex-col">
          <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-200">Shared Contents</h2>
            <div className="text-xs text-slate-500 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>Generated: {details.expiresAt ? new Date(details.expiresAt.getTime() - 24 * 60 * 60 * 1000).toLocaleDateString() : ""}</span>
            </div>
          </div>

          {assetsList.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <div className="w-14 h-14 bg-slate-800/50 rounded-full flex items-center justify-center mb-4 text-slate-500 border border-white/5">
                <Folder className="w-6 h-6" />
              </div>
              <p className="text-slate-400 font-medium text-lg">This folder is empty</p>
              <p className="text-slate-500 text-sm mt-1 max-w-xs">No files are currently available in this shared link.</p>
            </div>
          ) : (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-slate-400 text-xs font-medium uppercase tracking-wider">
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4 hidden sm:table-cell">Size</th>
                    <th className="px-6 py-4 hidden md:table-cell">Type</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {assetsList.map((asset) => (
                    <tr 
                      key={asset.id} 
                      className="group hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3 max-w-md">
                          <div className="w-9 h-9 bg-slate-800/40 group-hover:bg-slate-800/80 border border-white/5 rounded-lg flex items-center justify-center text-slate-400 transition-colors shrink-0">
                            <File className="w-5 h-5" />
                          </div>
                          <span className="text-sm font-medium text-slate-200 truncate group-hover:text-white transition-colors">
                            {asset.filename}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400 hidden sm:table-cell font-mono">
                        {formatBytes(asset.size)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400 hidden md:table-cell truncate max-w-[150px]">
                        {asset.mimeType || "Binary File"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDownload(asset)}
                          disabled={downloadingId !== null}
                          className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-600/10 hover:bg-indigo-600 border border-indigo-500/20 hover:border-indigo-500 text-indigo-400 hover:text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group/btn"
                          title="Download File"
                        >
                          {downloadingId === asset.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4 transition-transform group-hover/btn:translate-y-[1px]" />
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
      <footer className="border-t border-white/5 py-6 px-6 text-center text-xs text-slate-500 z-10">
        <p>© {new Date().getFullYear()} Motion Drive. Powered by high-speed proxied sharing architecture.</p>
      </footer>
    </div>
  );
}
