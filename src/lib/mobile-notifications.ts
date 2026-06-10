import { isCapacitor } from "./native-bridge";

interface NotificationProgress {
  id: number;
  title: string;
  totalBytes: number;
  bytesTransferred: number;
  startTime: number;
  lastUpdateTime: number;
  lastBytesTransferred: number;
  lastPercent?: number;
}

const activeNotifications: { [key: string]: NotificationProgress } = {};
let localNotificationsPlugin: any = null;

// Throttled notification updates (max 2 updates per second per notification to prevent UI lag)
const THROTTLE_MS = 600;

async function getProgressNotificationPlugin() {
  if (isCapacitor()) {
    try {
      const { registerPlugin } = await import("@capacitor/core");
      return registerPlugin<any>("ProgressNotification");
    } catch (err) {
      console.error("Failed to register ProgressNotification plugin:", err);
    }
  }
  return null;
}

async function getNotificationsPlugin() {
  if (localNotificationsPlugin) return localNotificationsPlugin;
  if (isCapacitor()) {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      localNotificationsPlugin = LocalNotifications;
      
      const progressPlugin = await getProgressNotificationPlugin();
      if (progressPlugin) {
        // Request permission via our custom progress plugin (which handles Manifest permission properly)
        await progressPlugin.requestPermissions();
      } else {
        // Fallback
        await localNotificationsPlugin.requestPermissions();
      }
      
      // Create channel for progress updates
      await localNotificationsPlugin.createChannel({
        id: "transfer-progress",
        name: "Transfer Progress",
        description: "Shows active upload and download progress and speeds",
        importance: 3, // default importance
        sound: "silent", // prevent constant buzzing
        vibration: false,
      });
    } catch (err) {
      console.error("Failed to initialize LocalNotifications:", err);
    }
  }
  return localNotificationsPlugin;
}

/**
 * Format bytes to readable human speeds (e.g. 1.24 MB/s)
 */
export function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return "0 B/s";
  const k = 1024;
  const sizes = ["B/s", "KB/s", "MB/s", "GB/s"];
  const i = Math.floor(Math.log(bytesPerSec) / Math.log(k));
  return `${parseFloat((bytesPerSec / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format remaining seconds to readable ETA (e.g. 1m 24s)
 */
export function formatETA(seconds: number): string {
  if (seconds === Infinity || isNaN(seconds) || seconds <= 0) return "Estimating...";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

/**
 * Initialize or update a transfer notification in the system tray
 */
export async function updateTransferNotification(params: {
  key: string; // unique filename or task key
  title: string;
  type: "upload" | "download";
  bytesTransferred: number;
  totalBytes: number;
}) {
  const plugin = await getNotificationsPlugin();
  if (!plugin) return;

  const now = Date.now();
  let item = activeNotifications[params.key];

  if (!item) {
    const id = Math.floor(Math.random() * 100000) + 1;
    item = {
      id,
      title: params.title,
      totalBytes: params.totalBytes,
      bytesTransferred: params.bytesTransferred,
      startTime: now,
      lastUpdateTime: now,
      lastBytesTransferred: params.bytesTransferred,
      lastPercent: -1,
    };
    activeNotifications[params.key] = item;
  }

  const elapsedMs = now - item.lastUpdateTime;
  const totalElapsedMs = now - item.startTime;

  // Calculate Average Speed
  let avgSpeed = totalElapsedMs > 0 ? (params.bytesTransferred / totalElapsedMs) * 1000 : 0;
  let percent = params.totalBytes > 0 ? Math.round((params.bytesTransferred / params.totalBytes) * 100) : 0;
  const isComplete = params.bytesTransferred >= params.totalBytes;

  // Calculate ETA (seconds)
  let remainingBytes = params.totalBytes - params.bytesTransferred;
  let etaSeconds = avgSpeed > 0 ? remainingBytes / avgSpeed : Infinity;

  // Segment progress into 5% buckets (0, 5, 10, ..., 95, 100) to keep native IPC overhead near zero.
  // We only trigger a native notification update when moving to a new 5% bucket.
  const currentBucket = Math.floor(percent / 5);
  const lastBucket = Math.floor((item.lastPercent ?? -1) / 5);

  if (!isComplete && currentBucket === lastBucket && params.bytesTransferred > 0) {
    return {
      speed: avgSpeed,
      speedText: formatSpeed(avgSpeed),
      etaText: formatETA(etaSeconds),
      percent,
    };
  }

  // Update last tracked percentage
  item.lastPercent = percent;

  // Calculate Speed (bytes per second)
  const bytesSinceLast = params.bytesTransferred - item.lastBytesTransferred;
  const speed = elapsedMs > 0 ? (bytesSinceLast / elapsedMs) * 1000 : 0;
  
  // Calculate Average Speed
  avgSpeed = totalElapsedMs > 0 ? (params.bytesTransferred / totalElapsedMs) * 1000 : 0;
  const currentSpeed = speed > 0 ? speed : avgSpeed;

  // Calculate ETA (seconds)
  remainingBytes = params.totalBytes - params.bytesTransferred;
  etaSeconds = currentSpeed > 0 ? remainingBytes / currentSpeed : Infinity;

  percent = params.totalBytes > 0 ? Math.round((params.bytesTransferred / params.totalBytes) * 100) : 0;

  // Update tracking item
  item.bytesTransferred = params.bytesTransferred;
  item.lastBytesTransferred = params.bytesTransferred;
  item.lastUpdateTime = now;

  const speedText = formatSpeed(currentSpeed);
  const etaText = formatETA(etaSeconds);

  if (params.bytesTransferred >= params.totalBytes) {
    // Complete notification
    const progressPlugin = await getProgressNotificationPlugin();
    if (progressPlugin) {
      await progressPlugin.hideProgress({ id: item.id }).catch(() => {});
    }

    await plugin.schedule({
      notifications: [
        {
          id: item.id,
          title: `Finished ${params.type === "upload" ? "Uploading" : "Downloading"}`,
          body: `${item.title} completed!`,
          channelId: "transfer-progress",
          ongoing: false,
        },
      ],
    });
    delete activeNotifications[params.key];
  } else {
    // Ongoing progress notification
    const progressPlugin = await getProgressNotificationPlugin();
    let shownNatively = false;

    if (progressPlugin) {
      try {
        await progressPlugin.showProgress({
          id: item.id,
          title: `${params.type === "upload" ? "Uploading" : "Downloading"} ${item.title}`,
          text: `${percent}% • ${speedText} • ETA: ${etaText}`,
          progress: percent,
          max: 100,
          indeterminate: false,
        });
        shownNatively = true;
      } catch (err) {
        console.error("Failed to show custom progress notification, falling back to local notifications:", err);
      }
    }

    if (!shownNatively) {
      await plugin.schedule({
        notifications: [
          {
            id: item.id,
            title: `${params.type === "upload" ? "Uploading" : "Downloading"} ${item.title}`,
            body: `${percent}% • ${speedText} • ETA: ${etaText}`,
            channelId: "transfer-progress",
            ongoing: true,
            extra: {
              progress: percent / 100, // custom progress bar for notification tray
            }
          },
        ],
      });
    }
  }

  return {
    speed: currentSpeed,
    speedText,
    etaText,
    percent,
  };
}

/**
 * Dismiss a progress notification cleanly (e.g. upon user cancellation)
 */
export async function dismissTransferNotification(key: string) {
  const plugin = await getNotificationsPlugin();
  const item = activeNotifications[key];
  if (item) {
    const progressPlugin = await getProgressNotificationPlugin();
    if (progressPlugin) {
      await progressPlugin.hideProgress({ id: item.id }).catch(() => {});
    }
    if (plugin) {
      await plugin.cancel({
        notifications: [{ id: item.id }],
      }).catch(() => {});
    }
    delete activeNotifications[key];
  }
}
