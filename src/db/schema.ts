import { pgTable, text, timestamp, boolean, bigint } from "drizzle-orm/pg-core";

// ==========================================
// BETTER AUTH COMPATIBLE TABLES & EXTENSIONS
// ==========================================

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull(),
  image: text("image"),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
  
  // Custom Extensions for Organization Drive
  role: text("role").$type<"admin" | "manager" | "staff">().default("staff").notNull(),
  status: text("status").$type<"pending" | "approved" | "suspended">().default("pending").notNull(),
  storageLimit: bigint("storageLimit", { mode: "number" }).default(107374182400).notNull(), // 100 GB default
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt"),
  updatedAt: timestamp("updatedAt"),
});

// ==========================================
// ORGANIZATION WEB DRIVE TABLES
// ==========================================

export const projects = pgTable("project", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  clientName: text("clientName"),
  userId: text("userId").references(() => user.id, { onDelete: "cascade" }),
  sharedWith: text("sharedWith").default("all"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const folders = pgTable("folder", {
  id: text("id").primaryKey(),
  projectId: text("projectId").references(() => projects.id, { onDelete: "cascade" }),
  parentId: text("parentId"), // Self-referencing tree representation
  userId: text("userId").references(() => user.id, { onDelete: "cascade" }), // Folder owner for per-user isolation
  name: text("name").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const assets = pgTable("asset", {
  id: text("id").primaryKey(),
  folderId: text("folderId").references(() => folders.id, { onDelete: "cascade" }),
  projectId: text("projectId").references(() => projects.id, { onDelete: "cascade" }),
  r2Key: text("r2Key").notNull().unique(),
  filename: text("filename").notNull(),
  size: bigint("size", { mode: "number" }).notNull(), // Supports files > 2GB
  mimeType: text("mimeType").notNull(),
  uploadedBy: text("uploadedBy").references(() => user.id, { onDelete: "set null" }),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
  deletedAt: timestamp("deletedAt"), // Supports Trash/soft-delete
  status: text("status").$type<"pending" | "uploading" | "completed" | "failed">().default("pending").notNull(),
});

export const invitations = pgTable("invitation", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  role: text("role").$type<"admin" | "manager" | "staff">().default("staff").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const sharedLinks = pgTable("shared_link", {
  id: text("id").primaryKey(), // Cryptographically secure token/id
  assetId: text("assetId").references(() => assets.id, { onDelete: "cascade" }), // Personal drive asset reference
  physicalKey: text("physicalKey"), // Key for shared drive or archive files
  folderId: text("folderId").references(() => folders.id, { onDelete: "cascade" }), // Personal drive folder reference
  physicalPrefix: text("physicalPrefix"), // Prefix for shared/archive folders
  physicalBucket: text("physicalBucket"), // "shared" | "archive"
  filename: text("filename").notNull(), // Cached file/folder name
  userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }), // Creator
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  isRevoked: boolean("isRevoked").default(false).notNull(),
});

