import { S3Client } from "@aws-sdk/client-s3";

if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || !process.env.R2_ENDPOINT) {
  throw new Error("R2 credentials (ACCESS_KEY_ID, SECRET_ACCESS_KEY, ENDPOINT) are not configured in environment variables.");
}

export const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "motionsewa-drive";
export const R2_SHARED_BUCKET_NAME = process.env.R2_SHARED_BUCKET_NAME || "video-assets";
