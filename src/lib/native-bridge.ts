/**
 * Motionsewa Drive: Client-Side Native App Integration Bridge
 * 
 * Centralizes environmental checks and communication interfaces with Tauri (Desktop) and Capacitor (Mobile)
 * to bypass browser engine limits and run high-speed parallel uploads natively.
 */

// Helper to check if running in a browser environment
const isClient = typeof window !== "undefined";

/**
 * Check if the application is running inside a Native App container (Tauri or Capacitor)
 */
export function isNativeApp(): boolean {
  if (!isClient) return false;
  return isTauri() || isCapacitor();
}

/**
 * Check if the application is running inside Tauri (macOS / Windows Desktop)
 */
export function isTauri(): boolean {
  if (!isClient) return false;
  // Tauri v2 sets these global variables in the webview
  return !!((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__);
}

/**
 * Check if the application is running inside Capacitor (Android Mobile)
 */
export function isCapacitor(): boolean {
  if (!isClient) return false;
  return !!(window as any).Capacitor;
}

/**
 * Interface for native file pickers
 */
export interface NativeFile {
  path: string;
  name: string;
  size: number;
  mimeType: string;
}

/**
 * Open a native OS File Dialog to select files.
 * This returns the actual, absolute filesystem paths which can be read directly by native code,
 * bypassing the browser's sandboxed virtual File object.
 */
export async function pickFilesNative(options: {
  multiple?: boolean;
  directory?: boolean;
}): Promise<NativeFile[]> {
  if (!isClient) return [];

  // A. TAURI (DESKTOP) IMPLEMENTATION
  if (isTauri()) {
    try {
      // Dynamic import of Tauri dialog plugin to prevent SSR and bundle bloat
      const { open } = await import("@tauri-apps/plugin-dialog");
      const { basename } = await import("@tauri-apps/api/path");

      const selected = await open({
        multiple: options.multiple ?? true,
        directory: options.directory ?? false,
      });

      if (!selected) return [];

      const paths = Array.isArray(selected) ? selected : [selected];
      const files: NativeFile[] = [];
      const { invoke } = await import("@tauri-apps/api/core");

      for (const filePath of paths) {
        try {
          const metadata = await invoke<any>("get_file_metadata", { filePath });
          files.push({
            path: filePath,
            name: metadata.name,
            size: metadata.size,
            mimeType: "application/octet-stream",
          });
        } catch (metaErr) {
          console.error("[Native Bridge] Failed to read metadata for " + filePath, metaErr);
          const name = await basename(filePath);
          files.push({
            path: filePath,
            name,
            size: 0,
            mimeType: "application/octet-stream",
          });
        }
      }

      return files;
    } catch (err) {
      console.error("[Native Bridge] Tauri file picker failed:", err);
      throw err;
    }
  }

  // B. CAPACITOR (ANDROID) IMPLEMENTATION
  if (isCapacitor()) {
    try {
      const { registerPlugin } = await import("@capacitor/core");
      const FilePicker = registerPlugin<any>("FilePicker");

      const result = await FilePicker.pickFiles({
        multiple: options.multiple ?? true,
        readData: false, // We only need the local URI path
      });

      if (!result || !result.files) return [];

      return result.files.map((f: any) => ({
        path: f.path, // Native Android content:// URI or cache path
        name: f.name,
        size: f.size || 0,
        mimeType: f.mimeType || "application/octet-stream",
      }));
    } catch (err) {
      console.error("[Native Bridge] Capacitor file picker failed:", err);
      throw err;
    }
  }

  return [];
}

/**
 * Triggers a multi-threaded parallel chunk upload natively via Rust (Desktop) or Java (Android).
 * Returns the array of PartNumber and ETag responses required to complete the multipart upload.
 */
export async function uploadFileNative(params: {
  filePath: string;
  parts: { partNumber: number; url: string }[];
  chunkSize: number;
  onProgress: (bytesSent: number, partNumber: number) => void;
  signal?: AbortSignal;
}): Promise<{ PartNumber: number; ETag: string }[]> {
  if (!isClient) throw new Error("Native code can only be executed on the client-side.");

  // A. TAURI (DESKTOP) UPLOAD BRIDGE
  if (isTauri()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const { listen } = await import("@tauri-apps/api/event");

      if (params.signal?.aborted) {
        throw new DOMException("Upload aborted", "AbortError");
      }

      // Setup a listener for progress updates emitted by our Rust thread pool
      const unlisten = await listen<any>("upload-progress", (event) => {
        const { bytesSent, partNumber } = event.payload;
        params.onProgress(bytesSent, partNumber);
      });

      let abortHandler: (() => void) | null = null;
      const abortPromise = new Promise<never>((_, reject) => {
        if (params.signal) {
          abortHandler = async () => {
            try {
              // Asynchronously tell Rust backend to halt its threads for this file
              await invoke("cancel_upload", { filePath: params.filePath });
            } catch (err) {
              console.error("[Native Bridge] cancel_upload invoke failed:", err);
            }
            reject(new DOMException("Upload aborted", "AbortError"));
          };
          params.signal.addEventListener("abort", abortHandler);
        }
      });

      const uploadPromise = (async () => {
        const result = await invoke<any>("upload_file_native", {
          filePath: params.filePath,
          parts: params.parts,
          chunkSize: params.chunkSize,
        });
        return result; // Returns [{ PartNumber: X, ETag: "..." }, ...]
      })();

      try {
        const result = await Promise.race([uploadPromise, abortPromise]);
        unlisten();
        if (params.signal && abortHandler) {
          params.signal.removeEventListener("abort", abortHandler);
        }
        return result;
      } catch (err) {
        unlisten();
        if (params.signal && abortHandler) {
          params.signal.removeEventListener("abort", abortHandler);
        }
        throw err;
      }
    } catch (err) {
      console.error("[Native Bridge] Rust upload invocation failed:", err);
      throw err;
    }
  }

  // B. CAPACITOR (ANDROID) UPLOAD BRIDGE
  if (isCapacitor()) {
    try {
      const { registerPlugin } = await import("@capacitor/core");
      const NativeUpload = registerPlugin<any>("NativeUpload");

      // Set up progress tracking listener
      const progressListener = await NativeUpload.addListener("progress", (data: any) => {
        params.onProgress(data.bytesSent, data.partNumber);
      });

      try {
        const result = await NativeUpload.uploadFile({
          filePath: params.filePath,
          parts: params.parts,
          chunkSize: params.chunkSize,
        });

        progressListener.remove();
        return result.parts;
      } catch (err) {
        progressListener.remove();
        throw err;
      }
    } catch (err) {
      console.error("[Native Bridge] Android upload invocation failed:", err);
      throw err;
    }
  }

  throw new Error("No active native container wrapper is running.");
}

/**
 * Triggers a native streaming file download directly to the local filesystem via Rust (Tauri).
 * Prompts the user with a native Save Dialog to choose the destination, then streams the download
 * in chunks directly to disk with progress reporting and cancellation.
 */
export async function downloadFileNative(params: {
  url: string;
  filename: string;
  knownSize?: number;
  onProgress: (bytesDownloaded: number, totalBytes: number) => void;
  signal?: AbortSignal;
}): Promise<string | null> {
  if (!isClient) throw new Error("Native code can only be executed on the client-side.");

  // A. TAURI (DESKTOP) DOWNLOAD BRIDGE
  if (isTauri()) {
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { invoke } = await import("@tauri-apps/api/core");
      const { listen } = await import("@tauri-apps/api/event");

      // 1. Open native Save File Dialog suggesting default asset name
      const selectedPath = await save({
        defaultPath: params.filename,
      });

      if (!selectedPath) {
        return null; // User cancelled the save dialog
      }

      if (params.signal?.aborted) {
        throw new DOMException("Download aborted", "AbortError");
      }

      const downloadId = selectedPath;

      // 2. Setup listener for progress updates emitted by the Rust downloader
      const unlisten = await listen<any>("download-progress", (event) => {
        const { bytesDownloaded, totalBytes, filePath } = event.payload;
        if (filePath === downloadId) {
          params.onProgress(bytesDownloaded, totalBytes);
        }
      });

      let abortHandler: (() => void) | null = null;
      const abortPromise = new Promise<never>((_, reject) => {
        if (params.signal) {
          abortHandler = async () => {
            try {
              // Asynchronously tell Rust backend to halt streaming and delete partial file
              await invoke("cancel_download", { filePath: downloadId });
            } catch (err) {
              console.error("[Native Bridge] cancel_download invoke failed:", err);
            }
            reject(new DOMException("Download aborted", "AbortError"));
          };
          params.signal.addEventListener("abort", abortHandler);
        }
      });

      const downloadPromise = (async () => {
        await invoke("download_file_native", {
          url: params.url,
          filePath: selectedPath,
        });
        return selectedPath;
      })();

      try {
        const result = await Promise.race([downloadPromise, abortPromise]);
        unlisten();
        if (params.signal && abortHandler) {
          params.signal.removeEventListener("abort", abortHandler);
        }
        return result;
      } catch (err) {
        unlisten();
        if (params.signal && abortHandler) {
          params.signal.removeEventListener("abort", abortHandler);
        }
        throw err;
      }
    } catch (err) {
      console.error("[Native Bridge] Rust download invocation failed:", err);
      throw err;
    }
  }

  // B. CAPACITOR (ANDROID) DOWNLOAD IMPLEMENTATION
  if (isCapacitor()) {
    try {
      const { Filesystem, Directory } = await import("@capacitor/filesystem");
      const { BackgroundTask } = await import("@capawesome/capacitor-background-task");
      const { updateTransferNotification, dismissTransferNotification } = await import("./mobile-notifications");

      const response = await fetch(params.url, { signal: params.signal });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      let totalBytes = Number(response.headers.get("content-length")) || 0;
      if (totalBytes === 0 && params.knownSize) {
        totalBytes = params.knownSize;
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("ReadableStream is not supported on this response body.");

      // Keep background task alive so OS doesn't freeze the WebView thread when device is locked/closed
      const taskId = await BackgroundTask.beforeExit(async () => {});

      // Clean up notifications on abort
      if (params.signal) {
        params.signal.addEventListener("abort", async () => {
          await dismissTransferNotification(params.filename);
          if (taskId) BackgroundTask.finish({ taskId });
        });
      }

      let bytesDownloaded = 0;
      let firstWrite = true;

      // Helper to convert Uint8Array chunk to base64 string
      const arrayBufferToBase64 = (buffer: Uint8Array): string => {
        let binary = "";
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
      };

      // Buffer chunks to write in larger blocks (e.g. 2MB) to completely bypass native bridge IPC overhead
      let bufferedChunks: Uint8Array[] = [];
      let bufferedBytes = 0;
      const BUFFER_LIMIT = 2 * 1024 * 1024; // 2MB

      const flushBuffer = async () => {
        if (bufferedChunks.length === 0) return;
        
        // Merge chunks
        const merged = new Uint8Array(bufferedBytes);
        let offset = 0;
        for (const chunk of bufferedChunks) {
          merged.set(chunk, offset);
          offset += chunk.length;
        }

        const base64Data = arrayBufferToBase64(merged);

        if (firstWrite) {
          await Filesystem.writeFile({
            path: params.filename,
            data: base64Data,
            directory: Directory.Documents,
            recursive: true
          });
          firstWrite = false;
        } else {
          await Filesystem.appendFile({
            path: params.filename,
            data: base64Data,
            directory: Directory.Documents
          });
        }

        bufferedChunks = [];
        bufferedBytes = 0;
      };

      while (true) {
        if (params.signal?.aborted) {
          throw new DOMException("Download aborted", "AbortError");
        }

        const { done, value } = await reader.read();
        if (done) {
          await flushBuffer();
          break;
        }

        bufferedChunks.push(value);
        bufferedBytes += value.length;
        bytesDownloaded += value.length;

        params.onProgress(bytesDownloaded, totalBytes);

        // Update system tray progress notification (with speed & ETA)
        await updateTransferNotification({
          key: params.filename,
          title: params.filename,
          type: "download",
          bytesTransferred: bytesDownloaded,
          totalBytes,
        });

        if (bufferedBytes >= BUFFER_LIMIT) {
          await flushBuffer();
        }
      }

      // Finalize notification as completed
      await updateTransferNotification({
        key: params.filename,
        title: params.filename,
        type: "download",
        bytesTransferred: totalBytes,
        totalBytes,
      });

      if (taskId) {
        BackgroundTask.finish({ taskId });
      }

      const uriResult = await Filesystem.getUri({
        path: params.filename,
        directory: Directory.Documents
      });
      return uriResult.uri;
    } catch (err) {
      try {
        const { dismissTransferNotification } = await import("./mobile-notifications");
        await dismissTransferNotification(params.filename);
      } catch (e) {}
      console.error("[Native Bridge] Capacitor download failed:", err);
      throw err;
    }
  }

  throw new Error("No active native container wrapper is running.");
}
