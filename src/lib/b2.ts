import { S3Client } from "@aws-sdk/client-s3";

if (!process.env.B2_KEY_ID || !process.env.B2_APPLICATION_KEY || !process.env.B2_ENDPOINT) {
  throw new Error("B2 credentials (B2_KEY_ID, B2_APPLICATION_KEY, B2_ENDPOINT) are not configured in environment variables.");
}

// Extract region from B2_ENDPOINT (e.g., https://s3.us-west-004.backblazeb2.com -> us-west-004)
const extractRegion = (endpoint: string): string => {
  try {
    const url = new URL(endpoint);
    const hostname = url.hostname; // s3.us-west-004.backblazeb2.com
    const parts = hostname.split(".");
    if (parts.length >= 3 && parts[0] === "s3") {
      return parts[1]; // us-west-004
    }
  } catch (e) {
    // Ignore error and fall back
  }
  return "us-west-004"; // Fallback default region
};

const region = process.env.B2_REGION || extractRegion(process.env.B2_ENDPOINT);

export const b2Client = new S3Client({
  region: region,
  endpoint: process.env.B2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APPLICATION_KEY,
  },
});

export const B2_BUCKET_NAME = process.env.B2_BUCKET_NAME || "motiondrive-archive";
