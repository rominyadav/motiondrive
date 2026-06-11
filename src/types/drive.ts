/**
 * Centralized TypeScript Declarations for Motionsewa Drive
 */

export type DriveMode = "personal" | "shared" | "archive" | "links";

export interface User {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  role: "admin" | "manager" | "staff";
  status: "pending" | "approved" | "suspended";
  storageLimit: number;
}

export interface Project {
  id: string;
  name: string;
  clientName?: string | null;
  userId?: string | null;
  sharedWith?: string | null; // "all" or comma-separated user IDs
  createdAt: string | Date;
}

export interface Folder {
  id: string;
  projectId?: string | null;
  parentId?: string | null;
  userId?: string | null;
  name: string;
  createdAt?: string | Date;
  isR2Physical?: boolean;
}

export interface Asset {
  id: string;
  folderId?: string | null;
  projectId?: string | null;
  r2Key?: string;
  filename: string;
  size: number;
  mimeType: string;
  uploadedBy?: string | null;
  uploadedAt: string | Date;
  deletedAt?: string | Date | null;
  status: string;
  isR2Physical?: boolean;
}

export interface SharedLink {
  id: string;
  assetId?: string | null;
  physicalKey?: string | null;
  folderId?: string | null;
  physicalPrefix?: string | null;
  physicalBucket?: string | null;
  filename: string;
  userId: string;
  createdAt: string | Date;
  expiresAt: string | Date;
  isRevoked: boolean;
}

export interface StorageStats {
  used: number;
  limit: number;
}

export interface DetailedUsageStats {
  totalSize: number;
  filesCount: number;
  byMimeType: {
    mimeType: string;
    totalSize: number;
    count: number;
  }[];
}

export interface UploadProgress {
  [filename: string]: number;
}

export interface UploadErrors {
  [filename: string]: string;
}

export interface DownloadProgressState {
  [filename: string]: {
    progress: number;
    bytesDownloaded: number;
    totalBytes: number;
    isCancelled: boolean;
    isFailed: boolean;
    controller: AbortController;
  };
}

export interface TransferMetric {
  [filename: string]: {
    speedText: string;
    etaText: string;
  };
}

export interface FolderPathNode {
  id: string | null;
  name: string;
}
