const { S3Client, PutBucketCorsCommand } = require("@aws-sdk/client-s3");
const fs = require("fs");
const path = require("path");

// Manual .env parser to avoid requiring external packages
try {
  const envPath = path.join(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    envContent.split("\n").forEach((line) => {
      const match = line.match(/^\s*([\w.\-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || "";
        if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
          value = value.substring(1, value.length - 1);
        }
        if (value.length > 0 && value.charAt(0) === "'" && value.charAt(value.length - 1) === "'") {
          value = value.substring(1, value.length - 1);
        }
        process.env[key] = value;
      }
    });
  }
} catch (e) {
  console.warn("Warning: Could not read .env file:", e.message);
}

if (!process.env.B2_KEY_ID || !process.env.B2_APPLICATION_KEY || !process.env.B2_ENDPOINT) {
  console.error("Error: Missing Backblaze B2 credentials (B2_KEY_ID, B2_APPLICATION_KEY, B2_ENDPOINT) in .env file.");
  process.exit(1);
}

const extractRegion = (endpoint) => {
  try {
    const url = new URL(endpoint);
    const hostname = url.hostname;
    const parts = hostname.split(".");
    if (parts.length >= 3 && parts[0] === "s3") {
      return parts[1];
    }
  } catch (e) {}
  return "us-west-004";
};

const region = process.env.B2_REGION || extractRegion(process.env.B2_ENDPOINT);
const bucketName = process.env.B2_BUCKET_NAME || "motiondrive-archive";

const b2Client = new S3Client({
  region: region,
  endpoint: process.env.B2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APPLICATION_KEY,
  },
});

const corsRules = {
  Bucket: bucketName,
  CORSConfiguration: {
    CORSRules: [
      {
        AllowedHeaders: ["*"],
        AllowedMethods: ["GET", "HEAD"],
        AllowedOrigins: ["*"], // Allows local development and deployment. Restrict to specific domains in production if desired.
        ExposeHeaders: ["Content-Range", "Content-Length", "ETag", "Accept-Ranges"],
        MaxAgeSeconds: 3600,
      },
    ],
  },
};

async function setCors() {
  try {
    console.log(`Configuring CORS for Backblaze B2 bucket: '${bucketName}'...`);
    console.log(`Endpoint: '${process.env.B2_ENDPOINT}'`);
    console.log(`Region: '${region}'`);
    
    const command = new PutBucketCorsCommand(corsRules);
    await b2Client.send(command);
    
    console.log("\n========================================================");
    console.log(" SUCCESS: CORS configuration applied to Backblaze B2!");
    console.log("========================================================\n");
  } catch (err) {
    console.error("\nError setting B2 CORS configuration:", err.message || err);
    console.error("Double check that B2_KEY_ID and B2_APPLICATION_KEY are correct and have appropriate permissions.");
  }
}

setCors();
