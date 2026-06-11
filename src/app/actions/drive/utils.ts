export function getMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "mp4": return "video/mp4";
    case "mkv": return "video/x-matroska";
    case "mov": return "video/quicktime";
    case "avi": return "video/x-msvideo";
    case "webm": return "video/webm";
    case "png": return "image/png";
    case "jpg": case "jpeg": return "image/jpeg";
    case "gif": return "image/gif";
    default: return "application/octet-stream";
  }
}
