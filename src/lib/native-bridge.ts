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
}): Promise<{ PartNumber: number; ETag: string }[]> {
  if (!isClient) throw new Error("Native code can only be executed on the client-side.");

  // A. TAURI (DESKTOP) UPLOAD BRIDGE
  if (isTauri()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const { listen } = await import("@tauri-apps/api/event");

      // Setup a listener for progress updates emitted by our Rust thread pool
      const unlisten = await listen<any>("upload-progress", (event) => {
        const { bytesSent, partNumber } = event.payload;
        params.onProgress(bytesSent, partNumber);
      });

      try {
        const result = await invoke<any>("upload_file_native", {
          filePath: params.filePath,
          parts: params.parts,
          chunkSize: params.chunkSize,
        });

        unlisten();
        return result; // Returns [{ PartNumber: X, ETag: "..." }, ...]
      } catch (err) {
        unlisten();
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
