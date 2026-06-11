import { useState, useRef, ChangeEvent } from "react";
import { 
  initiateMultipartUpload, 
  getPresignedPartUrls, 
  completeMultipartUpload, 
  abortMultipartUpload,
  getDownloadUrl,
  getSharedDownloadUrl,
  getArchiveDownloadUrl,
  createFolder
} from "@/app/actions/drive";
import { 
  isCapacitor, 
  isTauri, 
  pickFilesNative, 
  uploadFileNative, 
  downloadFileNative 
} from "@/lib/native-bridge";

interface UseDriveTransfersParams {
  explorerMode: "personal" | "shared" | "archive" | "links";
  selectedProjectId: string | null;
  currentFolderId: string | null;
  sharedFolderPath: string[];
  folders: any[];
  assets: any[];
  showToast: (msg: string, type?: "info" | "success" | "error") => void;
  refreshExplorerContents: () => Promise<void>;
}

export function useDriveTransfers({
  explorerMode,
  selectedProjectId,
  currentFolderId,
  sharedFolderPath,
  folders,
  assets,
  showToast,
  refreshExplorerContents
}: UseDriveTransfersParams) {
  // Upload Drawer State
  const [uploadProgress, setUploadProgress] = useState<{ [filename: string]: number }>({});
  const [uploadErrors, setUploadErrors] = useState<{ [filename: string]: string }>({});
  const [uploadActive, setUploadActive] = useState(false);
  const [uploadMinimized, setUploadMinimized] = useState(false);

  const [downloadProgress, setDownloadProgress] = useState<{
    [filename: string]: {
      progress: number;
      bytesDownloaded: number;
      totalBytes: number;
      isCancelled: boolean;
      isFailed: boolean;
      controller: AbortController;
    }
  }>({});
  const [downloadActive, setDownloadActive] = useState(false);
  const [transferMetrics, setTransferMetrics] = useState<{
    [filename: string]: { speedText: string; etaText: string }
  }>({});

  // Upload Abort Tracking
  const uploadDetailsRef = useRef<{
    [filename: string]: {
      uploadId: string;
      r2Key: string;
      assetId: string;
      isShared: boolean;
      controller: AbortController;
      filePath?: string;
    };
  }>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const uploadSingleFile = async (
    file: File, 
    targetFolderId: string | null, 
    customPrefix: string = "", 
    existingAssetId?: string | null, 
    existingR2Key?: string | null
  ) => {
    const filename = file.name;
    setUploadProgress((prev) => ({ ...prev, [filename]: 0 }));
    setUploadErrors((prev) => {
      const next = { ...prev };
      delete next[filename];
      return next;
    });
    setUploadMinimized(false); // Auto-expand drawer on new upload

    const isShared = explorerMode === "shared";
    const controller = new AbortController();

    // Register initial tracking in ref so user can cancel immediately
    uploadDetailsRef.current[filename] = {
      controller,
      uploadId: "",
      r2Key: "",
      assetId: "",
      isShared
    };

    let taskId: any = null;

    try {
      // Dynamic chunk sizing tailored for high-concurrency memory efficiency and parallel TCP socket saturation
      let CHUNK_SIZE = 8 * 1024 * 1024; // Default: 8MB
      if (file.size > 3 * 1024 * 1024 * 1024) {
        CHUNK_SIZE = 32 * 1024 * 1024; // 32MB for files > 3GB
      } else if (file.size > 1 * 1024 * 1024 * 1024) {
        CHUNK_SIZE = 24 * 1024 * 1024; // 24MB for files 1GB - 3GB
      } else if (file.size > 250 * 1024 * 1024) {
        CHUNK_SIZE = 16 * 1024 * 1024; // 16MB for files 250MB - 1GB
      }
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

      // A. Initiate upload with R2 via Next.js backend
      const { uploadId, r2Key, assetId } = await initiateMultipartUpload({
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        projectId: selectedProjectId,
        folderId: targetFolderId,
        isSharedDrive: isShared,
        prefix: customPrefix,
        existingAssetId,
        existingR2Key
      });

      if (controller.signal.aborted) {
        throw new DOMException("Upload aborted", "AbortError");
      }

      // Update ref with server-side identifiers for complete cleanup
      uploadDetailsRef.current[filename] = {
        controller,
        uploadId,
        r2Key,
        assetId,
        isShared
      };

      // B. Get presigned URLs for each chunk
      const partNumbers = Array.from({ length: totalChunks }, (_, index) => index + 1);
      const { partUrls } = await getPresignedPartUrls({ 
        uploadId, 
        r2Key, 
        partNumbers,
        isSharedDrive: isShared
      });

      if (controller.signal.aborted) {
        throw new DOMException("Upload aborted", "AbortError");
      }

      // Inline helper to upload a single chunk ArrayBuffer using XMLHttpRequest for precise progress reporting
      const uploadChunk = (
        presignedUrl: string,
        chunkBuffer: ArrayBuffer,
        index: number,
        onProgress: (loaded: number) => void,
        signal: AbortSignal
      ): Promise<string> => {
        return new Promise((resolve, reject) => {
          if (signal.aborted) {
            reject(new DOMException("Upload aborted", "AbortError"));
            return;
          }

          const xhr = new XMLHttpRequest();
          xhr.open("PUT", presignedUrl);

          // Handle abort signal
          const abortHandler = () => {
            xhr.abort();
            reject(new DOMException("Upload aborted", "AbortError"));
          };
          signal.addEventListener("abort", abortHandler);

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              onProgress(event.loaded);
            }
          };

          xhr.onload = () => {
            signal.removeEventListener("abort", abortHandler);
            if (xhr.status >= 200 && xhr.status < 300) {
              const etag = xhr.getResponseHeader("ETag");
              if (etag) {
                resolve(etag);
              } else {
                reject(new Error(`Etag missing from chunk ${index + 1}`));
              }
            } else {
              reject(new Error(`Chunk ${index + 1} upload failed with status ${xhr.status}`));
            }
          };

          xhr.onerror = () => {
            signal.removeEventListener("abort", abortHandler);
            reject(new Error(`Chunk ${index + 1} network error`));
          };

          xhr.onabort = () => {
            signal.removeEventListener("abort", abortHandler);
            reject(new DOMException("Upload aborted", "AbortError"));
          };

          xhr.send(chunkBuffer);
        });
      };

      // C. Upload chunks directly using a highly concurrent sliding-window worker pool
      const parts: { PartNumber: number; ETag: string }[] = [];
      let nextChunkIndex = 0;
      const concurrency = 12; // Raised to 12 concurrent sockets to completely saturate high-speed lines

      // Track byte progress of all chunks
      const chunkProgress = new Array(totalChunks).fill(0);
      let lastProgressUpdateTime = 0;
      const THROTTLE_MS = 150; // Throttle React re-renders to prevent browser-thread choking

      if (isCapacitor()) {
        try {
          const { BackgroundTask } = await import("@capawesome/capacitor-background-task");
          taskId = await BackgroundTask.beforeExit(async () => {});
        } catch (err) {}
      }

      const startTime = Date.now();

      const triggerProgressUpdate = (force = false) => {
        const now = Date.now();
        if (force || now - lastProgressUpdateTime > THROTTLE_MS) {
          const totalUploadedBytes = chunkProgress.reduce((sum, val) => sum + val, 0);
          const percent = Math.min(
            Math.round((totalUploadedBytes / file.size) * 100),
            99 // Keep at 99% max until completeMultipartUpload fully finishes and DB indexes
          );

          // Calculate Speed & ETA
          const elapsedMs = now - startTime;
          const speed = elapsedMs > 0 ? (totalUploadedBytes / elapsedMs) * 1000 : 0;
          const remainingBytes = file.size - totalUploadedBytes;
          const etaSeconds = speed > 0 ? remainingBytes / speed : Infinity;

          const speedText = speed > 0 ? `${(speed / (1024 * 1024)).toFixed(2)} MB/s` : "0 B/s";
          const etaText = etaSeconds === Infinity ? "Estimating..." : etaSeconds < 60 ? `${Math.round(etaSeconds)}s` : `${Math.floor(etaSeconds / 60)}m ${Math.round(etaSeconds % 60)}s`;

          setTransferMetrics((prev) => ({
            ...prev,
            [filename]: { speedText, etaText }
          }));

          setUploadProgress((prev) => {
            if (prev[filename] === -1) return prev;
            if (prev[filename] === percent) return prev;
            return {
              ...prev,
              [filename]: percent
            };
          });

          // Android Local Notification Progress update
          if (isCapacitor()) {
            import("@/lib/mobile-notifications").then(({ updateTransferNotification }) => {
              updateTransferNotification({
                key: filename,
                title: filename,
                type: "upload",
                bytesTransferred: totalUploadedBytes,
                totalBytes: file.size,
              });
            }).catch((err) => console.error("Notification update failed:", err));
          }

          lastProgressUpdateTime = now;
        }
      };

      const worker = async () => {
        while (true) {
          if (controller.signal.aborted) {
            throw new DOMException("Upload aborted", "AbortError");
          }

          const index = nextChunkIndex++;
          if (index >= totalChunks) {
            break;
          }

          const start = index * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunkSlice = file.slice(start, end);
          const presignedUrl = partUrls[index].url;

          try {
            // Convert to ArrayBuffer in-memory first to completely bypass file-reading IPC bottlenecks during active socket transfer
            const chunkBuffer = await chunkSlice.arrayBuffer();

            const etag = await uploadChunk(
              presignedUrl,
              chunkBuffer,
              index,
              (loadedBytes) => {
                chunkProgress[index] = loadedBytes;
                triggerProgressUpdate();
              },
              controller.signal
            );

            parts.push({ PartNumber: index + 1, ETag: etag });

            // Mark this chunk as fully loaded to guarantee accurate sum
            chunkProgress[index] = end - start;
            triggerProgressUpdate(true); // Force update upon chunk completion

          } catch (err) {
            throw err;
          }
        }
      };

      // Run multiple workers in parallel
      const pool = Array.from({ length: Math.min(concurrency, totalChunks) }, () => worker());
      await Promise.all(pool);

      // S3/R2 multipart uploads require the parts list to be in ascending order of PartNumber
      parts.sort((a, b) => a.PartNumber - b.PartNumber);

      if (controller.signal.aborted) {
        throw new DOMException("Upload aborted", "AbortError");
      }

      // D. Complete the Multipart upload on R2 and DB index
      await completeMultipartUpload({
        uploadId,
        r2Key,
        parts,
        assetId,
        isSharedDrive: isShared
      });

      // Set to 100 explicitly upon completion
      setUploadProgress((prev) => {
        if (prev[filename] === -1) return prev;
        return { ...prev, [filename]: 100 };
      });

      if (isCapacitor()) {
        try {
          const { updateTransferNotification } = await import("@/lib/mobile-notifications");
          await updateTransferNotification({
            key: filename,
            title: filename,
            type: "upload",
            bytesTransferred: file.size,
            totalBytes: file.size,
          });
        } catch (err) {}
      }

      return { success: true, r2Key, assetId };

    } catch (err: any) {
      const isAborted = err.name === "AbortError" || err.message === "canceled" || controller.signal.aborted;
      const details = uploadDetailsRef.current[filename];

      if (isCapacitor()) {
        try {
          const { dismissTransferNotification } = await import("@/lib/mobile-notifications");
          await dismissTransferNotification(filename);
        } catch (e) {}
      }

      if (isAborted) {
        if (details && details.uploadId) {
          try {
            await abortMultipartUpload({
              uploadId: details.uploadId,
              r2Key: details.r2Key,
              assetId: details.assetId,
              isSharedDrive: details.isShared
            });
          } catch (abortErr) {
            console.error("Failed to clean up aborted upload on server:", abortErr);
          }
        }
        setUploadProgress((prev) => ({ ...prev, [filename]: -1 }));
      } else {
        const errorMsg = err.message || String(err);
        setUploadErrors((prev) => ({ ...prev, [filename]: errorMsg }));
        setUploadProgress((prev) => ({ ...prev, [filename]: -2 }));
        console.error("Multipart upload failed for " + filename, err);
        showToast(`Failed to upload ${filename}: ${errorMsg}`, "error");
      }
      throw err;
    } finally {
      delete uploadDetailsRef.current[filename];
      if (taskId && isCapacitor()) {
        try {
          const { BackgroundTask } = await import("@capawesome/capacitor-background-task");
          BackgroundTask.finish({ taskId });
        } catch (err) {}
      }
    }
  };

  const handleCancelUpload = async (filename: string) => {
    const details = uploadDetailsRef.current[filename];
    if (!details) return;

    details.controller.abort();

    setUploadProgress((prev) => ({
      ...prev,
      [filename]: -1
    }));

    if (isCapacitor()) {
      try {
        const { dismissTransferNotification } = await import("@/lib/mobile-notifications");
        await dismissTransferNotification(filename);
      } catch (e) {}
    }

    if (details.uploadId) {
      try {
        await abortMultipartUpload({
          uploadId: details.uploadId,
          r2Key: details.r2Key,
          assetId: details.assetId,
          isSharedDrive: details.isShared
        });
      } catch (err) {
        console.error("Error aborting upload on server:", err);
      }
    }

    delete uploadDetailsRef.current[filename];
    showToast(`Cancelled upload: ${filename}`, "info");
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadActive(true);

    const isShared = explorerMode === "shared";
    const prefix = isShared ? (sharedFolderPath.length > 0 ? sharedFolderPath.join("/") + "/" : "") : "";

    for (let i = 0; i < files.length; i++) {
      await uploadSingleFile(files[i], currentFolderId, prefix);
    }

    await refreshExplorerContents();
  };

  const handleFolderUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadActive(true);

    const isShared = explorerMode === "shared";
    const basePrefix = isShared ? (sharedFolderPath.length > 0 ? sharedFolderPath.join("/") + "/" : "") : "";

    const localFolderCache: { [pathKey: string]: string | null } = {};

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relativePath = file.webkitRelativePath || "";

      if (isShared) {
        let filePrefix = basePrefix;
        if (relativePath && relativePath.includes("/")) {
          const parts = relativePath.split("/");
          if (parts.length > 1) {
            const subPrefix = parts.slice(0, -1).join("/") + "/";
            filePrefix = basePrefix + subPrefix;
          }
        }
        await uploadSingleFile(file, null, filePrefix);
      } else {
        let targetFolderId = currentFolderId;

        if (relativePath && relativePath.includes("/")) {
          const parts = relativePath.split("/");
          const folderParts = parts.slice(0, parts.length - 1);
          
          let activeParentId = currentFolderId;
          const pathAccumulator: string[] = [];

          for (const folderName of folderParts) {
            pathAccumulator.push(folderName);
            const pathKey = pathAccumulator.join("/");

            if (localFolderCache[pathKey]) {
              activeParentId = localFolderCache[pathKey];
            } else {
              const existing = folders.find(
                (f: any) => f.name === folderName && f.parentId === activeParentId
              );

              if (existing) {
                activeParentId = existing.id;
                localFolderCache[pathKey] = activeParentId;
              } else {
                const createResult = await createFolder(
                  folderName,
                  selectedProjectId || undefined,
                  activeParentId
                );
                if (createResult && createResult.success && createResult.id) {
                  activeParentId = createResult.id;
                  localFolderCache[pathKey] = activeParentId;
                } else {
                  throw new Error(`Failed to create folder ${folderName}`);
                }
              }
            }
          }
          targetFolderId = activeParentId;
        }

        await uploadSingleFile(file, targetFolderId);
      }
    }

    await refreshExplorerContents();
  };

  const handleNativeUploadFlow = async (options: { directory: boolean }) => {
    try {
      const nativeFiles = await pickFilesNative({
        multiple: true,
        directory: options.directory,
      });

      if (nativeFiles.length === 0) return;

      setUploadActive(true);

      const isShared = explorerMode === "shared";
      const basePrefix = isShared ? (sharedFolderPath.length > 0 ? sharedFolderPath.join("/") + "/" : "") : "";

      for (const nativeFile of nativeFiles) {
        const filename = nativeFile.name;
        setUploadProgress((prev) => ({ ...prev, [filename]: 0 }));
        setUploadErrors((prev) => {
          const next = { ...prev };
          delete next[filename];
          return next;
        });
        setUploadMinimized(false);

        const controller = new AbortController();
        uploadDetailsRef.current[filename] = {
          controller,
          uploadId: "",
          r2Key: "",
          assetId: "",
          isShared,
          filePath: nativeFile.path,
        };

        try {
          if (controller.signal.aborted) {
            throw new DOMException("Upload aborted", "AbortError");
          }

          // A. Calculate chunk size based on file size
          let CHUNK_SIZE = 8 * 1024 * 1024; // 8MB
          if (nativeFile.size > 3 * 1024 * 1024 * 1024) {
            CHUNK_SIZE = 32 * 1024 * 1024; // 32MB
          } else if (nativeFile.size > 1 * 1024 * 1024 * 1024) {
            CHUNK_SIZE = 24 * 1024 * 1024; // 24MB
          } else if (nativeFile.size > 250 * 1024 * 1024) {
            CHUNK_SIZE = 16 * 1024 * 1024; // 16MB
          }
          const totalChunks = Math.ceil(nativeFile.size / CHUNK_SIZE) || 1;

          // B. Initiate Upload on the Next.js server to get IDs and Bucket Key
          const { uploadId, r2Key, assetId } = await initiateMultipartUpload({
            filename: nativeFile.name,
            mimeType: nativeFile.mimeType || "application/octet-stream",
            size: nativeFile.size,
            projectId: selectedProjectId,
            folderId: currentFolderId,
            isSharedDrive: isShared,
            prefix: basePrefix,
          });

          if (controller.signal.aborted) {
            throw new DOMException("Upload aborted", "AbortError");
          }

          // Update details with correct server IDs for proper abort handling
          uploadDetailsRef.current[filename] = {
            controller,
            uploadId,
            r2Key,
            assetId,
            isShared,
            filePath: nativeFile.path,
          };

          // C. Get Presigned PUT URLs from S3
          const partNumbers = Array.from({ length: totalChunks }, (_, index) => index + 1);
          const { partUrls } = await getPresignedPartUrls({
            uploadId,
            r2Key,
            partNumbers,
            isSharedDrive: isShared,
          });

          if (controller.signal.aborted) {
            throw new DOMException("Upload aborted", "AbortError");
          }

          // Prepare parts for the native uploader
          const nativeParts = partUrls.map((p) => ({
            partNumber: p.partNumber,
            url: p.url,
          }));

          // Track progress bytes
          const progressTracker: { [part: number]: number } = {};
          let lastUpdateTime = 0;
          const startTime = Date.now();

          // D. Invoke Native Upload
          const completedParts = await uploadFileNative({
            filePath: nativeFile.path,
            parts: nativeParts,
            chunkSize: CHUNK_SIZE,
            signal: controller.signal,
            onProgress: (bytesSent, partNumber) => {
              progressTracker[partNumber] = bytesSent;
              const totalUploaded = Object.values(progressTracker).reduce((a, b) => a + b, 0);
              const percent = Math.min(Math.round((totalUploaded / nativeFile.size) * 100), 99);

              const now = Date.now();
              if (now - lastUpdateTime > 150) {
                // Calculate Speed & ETA
                const elapsedMs = now - startTime;
                const speed = elapsedMs > 0 ? (totalUploaded / elapsedMs) * 1000 : 0;
                const remainingBytes = nativeFile.size - totalUploaded;
                const etaSeconds = speed > 0 ? remainingBytes / speed : Infinity;

                const speedText = speed > 0 ? `${(speed / (1024 * 1024)).toFixed(2)} MB/s` : "0 B/s";
                const etaText = etaSeconds === Infinity ? "Estimating..." : etaSeconds < 60 ? `${Math.round(etaSeconds)}s` : `${Math.floor(etaSeconds / 60)}m ${Math.round(etaSeconds % 60)}s`;

                setTransferMetrics(prev => ({
                  ...prev,
                  [filename]: { speedText, etaText }
                }));

                setUploadProgress((prev) => ({ ...prev, [filename]: percent }));
                lastUpdateTime = now;
              }
            },
          });

          if (controller.signal.aborted) {
            throw new DOMException("Upload aborted", "AbortError");
          }

          // E. Complete multipart upload
          await completeMultipartUpload({
            uploadId,
            r2Key,
            parts: completedParts,
            assetId,
            isSharedDrive: isShared,
          });

          setUploadProgress((prev) => ({ ...prev, [filename]: 100 }));
        } catch (fileErr: any) {
          const isAborted = fileErr.name === "AbortError" || fileErr.message === "canceled" || controller.signal.aborted;
          const details = uploadDetailsRef.current[filename];

          if (isAborted) {
            if (details && details.uploadId) {
              try {
                await abortMultipartUpload({
                  uploadId: details.uploadId,
                  r2Key: details.r2Key,
                  assetId: details.assetId,
                  isSharedDrive: details.isShared,
                });
              } catch (abortErr) {
                console.error("Failed to clean up aborted upload on server:", abortErr);
              }
            }
            setUploadProgress((prev) => ({ ...prev, [filename]: -1 }));
          } else {
            const errorMsg = fileErr.message || String(fileErr);
            setUploadErrors((prev) => ({ ...prev, [filename]: errorMsg }));
            console.error("Native upload failed for " + filename, fileErr);
            setUploadProgress((prev) => ({ ...prev, [filename]: -2 }));
            showToast(`Failed to upload ${filename}: ${errorMsg}`, "error");
          }
        } finally {
          delete uploadDetailsRef.current[filename];
        }
      }

      await refreshExplorerContents();
    } catch (err) {
      console.error("Native upload flow error:", err);
      showToast("Native file picker or upload failed.", "error");
    }
  };

  const triggerFileSelect = async () => {
    if (isTauri()) {
      await handleNativeUploadFlow({ directory: false });
    } else {
      fileInputRef.current?.click();
    }
  };

  const triggerFolderSelect = async () => {
    if (isTauri()) {
      await handleNativeUploadFlow({ directory: true });
    } else {
      folderInputRef.current?.click();
    }
  };

  const handleCancelDownload = (filename: string) => {
    const item = downloadProgress[filename];
    if (item && item.controller) {
      item.controller.abort();
      setDownloadProgress(prev => {
        if (!prev[filename]) return prev;
        return {
          ...prev,
          [filename]: {
            ...prev[filename],
            isCancelled: true,
            progress: -1,
          }
        };
      });
    }
  };

  const handleDownloadFile = async (assetId: string) => {
    try {
      const { downloadUrl, filename } = explorerMode === "shared"
        ? await getSharedDownloadUrl(assetId)
        : explorerMode === "archive"
        ? await getArchiveDownloadUrl(assetId)
        : await getDownloadUrl(assetId);

      const fileObj = assets?.find((a: any) => a.id === assetId);
      const knownSize = fileObj?.size ? Number(fileObj.size) : undefined;

      if (isTauri() || isCapacitor()) {
        const controller = new AbortController();

        setDownloadProgress(prev => ({
          ...prev,
          [filename]: {
            progress: 0,
            bytesDownloaded: 0,
            totalBytes: knownSize || 0,
            isCancelled: false,
            isFailed: false,
            controller,
          }
        }));
        setDownloadActive(true);
        setUploadMinimized(false); // Open drawer so user sees active download

        const startTime = Date.now();

        try {
          const result = await downloadFileNative({
            url: downloadUrl,
            filename,
            knownSize,
            onProgress: (bytesDownloaded, totalBytes) => {
              const percent = totalBytes > 0 ? Math.round((bytesDownloaded / totalBytes) * 100) : 0;
              
              // Calculate Speed & ETA
              const elapsedMs = Date.now() - startTime;
              const speed = elapsedMs > 0 ? (bytesDownloaded / elapsedMs) * 1000 : 0;
              const remainingBytes = totalBytes - bytesDownloaded;
              const etaSeconds = speed > 0 ? remainingBytes / speed : Infinity;

              const speedText = speed > 0 ? `${(speed / (1024 * 1024)).toFixed(2)} MB/s` : "0 B/s";
              const etaText = etaSeconds === Infinity ? "Estimating..." : etaSeconds < 60 ? `${Math.round(etaSeconds)}s` : `${Math.floor(etaSeconds / 60)}m ${Math.round(etaSeconds % 60)}s`;

              setTransferMetrics(prev => ({
                ...prev,
                [filename]: { speedText, etaText }
              }));

              setDownloadProgress(prev => {
                if (!prev[filename]) return prev;
                return {
                  ...prev,
                  [filename]: {
                    ...prev[filename],
                    progress: percent,
                    bytesDownloaded,
                    totalBytes,
                  }
                };
              });
            },
            signal: controller.signal,
          });

          if (result) {
            // Completed successfully
            setDownloadProgress(prev => {
              if (!prev[filename]) return prev;
              return {
                ...prev,
                [filename]: {
                  ...prev[filename],
                  progress: 100,
                  bytesDownloaded: prev[filename].totalBytes,
                }
              };
            });
            showToast(`Downloaded ${filename} successfully!`, "success");
          } else {
            // User cancelled save dialog, remove from progress panel cleanly
            setDownloadProgress(prev => {
              const updated = { ...prev };
              delete updated[filename];
              return updated;
            });
          }
        } catch (err: any) {
          const isCancelled = err?.name === "AbortError";
          setDownloadProgress(prev => {
            if (!prev[filename]) return prev;
            return {
              ...prev,
              [filename]: {
                ...prev[filename],
                isCancelled,
                isFailed: !isCancelled,
                progress: isCancelled ? -1 : -2,
              }
            };
          });
          if (!isCancelled) {
            showToast(`Failed to download ${filename}`, "error");
          }
        }
      } else {
        // Standard browser/web fallback download
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err) {
      showToast("Failed to download file", "error");
    }
  };

  return {
    uploadProgress,
    uploadErrors,
    uploadActive,
    uploadMinimized,
    downloadProgress,
    downloadActive,
    transferMetrics,
    fileInputRef,
    folderInputRef,
    uploadSingleFile,
    handleCancelUpload,
    handleFileUpload,
    handleFolderUpload,
    triggerFileSelect,
    triggerFolderSelect,
    handleDownloadFile,
    handleCancelDownload,
    setUploadActive,
    setDownloadActive,
    setUploadMinimized,
    setUploadProgress,
    setDownloadProgress
  };
}
