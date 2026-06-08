import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sharedLinks, assets } from "@/db/schema";
import { eq } from "drizzle-orm";
import { r2Client, R2_BUCKET_NAME, R2_SHARED_BUCKET_NAME } from "@/lib/r2";
import { b2Client, B2_BUCKET_NAME } from "@/lib/b2";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Sleek glassmorphism error template matching Motion Drive styling
function makeErrorHtml(title: string, message: string) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title} | Motion Drive</title>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
      <style>
        :root {
          --bg-gradient: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
          --card-bg: rgba(30, 41, 59, 0.7);
          --card-border: rgba(255, 255, 255, 0.08);
          --text-primary: #f8fafc;
          --text-secondary: #94a3b8;
          --accent: #ef4444;
          --accent-glow: rgba(239, 68, 68, 0.15);
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'Outfit', sans-serif;
          background: var(--bg-gradient);
          color: var(--text-primary);
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .container {
          background: var(--card-bg);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid var(--card-border);
          border-radius: 24px;
          padding: 40px;
          max-width: 480px;
          width: 90%;
          text-align: center;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
          transform: translateY(0);
          animation: float 6s ease-in-out infinite;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .icon-wrapper {
          width: 80px;
          height: 80px;
          background: var(--accent-glow);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 24px;
        }
        .icon {
          color: var(--accent);
          font-size: 32px;
          font-weight: bold;
        }
        h1 {
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 12px;
          background: linear-gradient(to right, #f8fafc, #cbd5e1);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        p {
          color: var(--text-secondary);
          font-size: 15px;
          line-height: 1.6;
          margin-bottom: 32px;
        }
        .btn {
          display: inline-block;
          background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%);
          color: #ffffff;
          text-decoration: none;
          padding: 12px 28px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 14px;
          box-shadow: 0 10px 20px rgba(79, 70, 229, 0.2);
          transition: all 0.2s ease;
        }
        .btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 24px rgba(79, 70, 229, 0.3);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon-wrapper">
          <span class="icon">✕</span>
        </div>
        <h1>${title}</h1>
        <p>${message}</p>
        <a href="/" class="btn">Return to Motion Drive</a>
      </div>
    </body>
    </html>
  `;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // 1. Fetch shared link record from DB
    const [link] = await db
      .select()
      .from(sharedLinks)
      .where(eq(sharedLinks.id, id));

    if (!link) {
      return new NextResponse(
        makeErrorHtml("Link Not Found", "The shared link you are trying to access does not exist, or has been deleted."),
        { status: 404, headers: { "Content-Type": "text/html" } }
      );
    }

    // 2. Validation Checks
    if (link.isRevoked) {
      return new NextResponse(
        makeErrorHtml("Link Revoked", "This shared link has been revoked or expired manually by the owner."),
        { status: 410, headers: { "Content-Type": "text/html" } }
      );
    }

    if (new Date() > link.expiresAt) {
      return new NextResponse(
        makeErrorHtml("Link Expired", "This shared link has expired automatically. Shared links are only valid for their specified lifespans."),
        { status: 410, headers: { "Content-Type": "text/html" } }
      );
    }

    // 3. Folder vs File check
    if (link.folderId || link.physicalPrefix) {
      return NextResponse.redirect(new URL(`/share/${id}/view`, request.url), 302);
    }

    // 4. Retrieve target file location
    let bucket: string;
    let key: string;
    let filename: string;
    let s3Client: any;

    if (link.assetId) {
      // Personal drive database file
      const [asset] = await db
        .select()
        .from(assets)
        .where(eq(assets.id, link.assetId));

      if (!asset || asset.status !== "completed") {
        return new NextResponse(
          makeErrorHtml("File Unavailable", "The original file referenced by this link is no longer available."),
          { status: 404, headers: { "Content-Type": "text/html" } }
        );
      }
      bucket = R2_BUCKET_NAME;
      key = asset.r2Key;
      filename = asset.filename;
      s3Client = r2Client;
    } else if (link.physicalKey && link.physicalBucket) {
      // Physical file
      key = link.physicalKey;
      filename = link.filename;
      if (link.physicalBucket === "shared") {
        bucket = R2_SHARED_BUCKET_NAME;
        s3Client = r2Client;
      } else if (link.physicalBucket === "archive") {
        bucket = B2_BUCKET_NAME;
        s3Client = b2Client;
      } else {
        throw new Error("Unknown bucket configuration");
      }
    } else {
      throw new Error("Invalid link configuration");
    }

    // 4. Generate very short-lived (60 seconds) pre-signed URL to perform redirect
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(filename)}"`,
    });

    const directUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 });

    // 5. Redirect the visitor to the temporary download URL
    return NextResponse.redirect(directUrl, 302);

  } catch (error) {
    console.error("Error retrieving shared link:", error);
    return new NextResponse(
      makeErrorHtml("Internal Server Error", "An error occurred while processing your download request. Please try again later."),
      { status: 500, headers: { "Content-Type": "text/html" } }
    );
  }
}
