/**
 * Local filesystem storage service — replaces Replit GCS sidecar.
 * Files are stored under UPLOADS_DIR (default: ./uploads).
 * Object paths follow the /objects/uploads/<uuid> convention
 * so the rest of the codebase is compatible without changes.
 */
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { Response } from "express";

export function getUploadsDir(): string {
  const dir = process.env.UPLOADS_DIR || "./uploads";
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.resolve(dir);
}

/**
 * Resolve and validate that `objectPath` is a safe /objects/uploads/<file> path.
 * Returns the absolute filesystem path, or throws on traversal attempts.
 */
function safePath(objectPath: string): string {
  if (!objectPath.startsWith("/objects/uploads/")) {
    throw new Error("Invalid object path prefix");
  }
  const fileName = objectPath.slice("/objects/uploads/".length);
  // Reject empty names, absolute component separators, or traversal segments
  if (!fileName || fileName.includes("..") || path.isAbsolute(fileName)) {
    throw new Error("Invalid object path — traversal not allowed");
  }
  const uploadsDir = getUploadsDir();
  const resolved = path.resolve(uploadsDir, fileName);
  // Guarantee the resolved path stays inside uploadsDir
  if (!resolved.startsWith(uploadsDir + path.sep) && resolved !== uploadsDir) {
    throw new Error("Forbidden path — outside uploads directory");
  }
  return resolved;
}

/**
 * Save a buffer to local disk. Returns the /objects/uploads/<uuid>.<ext> path.
 */
export function saveUpload(buffer: Buffer, originalName: string): string {
  const ext = path.extname(originalName).toLowerCase().replace(/[^a-z0-9.]/g, "");
  const uuid = randomUUID();
  const fileName = `${uuid}${ext}`;
  const filePath = path.join(getUploadsDir(), fileName);
  fs.writeFileSync(filePath, buffer);
  return `/objects/uploads/${fileName}`;
}

/**
 * Read a file by its /objects/uploads/<filename> path.
 * Returns the Buffer, or throws if not found.
 */
export function readUpload(objectPath: string): Buffer {
  const filePath = safePath(objectPath);
  if (!fs.existsSync(filePath)) {
    throw new Error("Object not found");
  }
  return fs.readFileSync(filePath);
}

/**
 * Delete a file by its /objects/uploads/<filename> path.
 */
export function deleteUpload(objectPath: string): void {
  try {
    const filePath = safePath(objectPath);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // Silently ignore invalid paths during delete
  }
}

/**
 * Stream a local upload file to an Express response.
 */
export function serveUpload(objectPath: string, res: Response): void {
  let filePath: string;
  try {
    filePath = safePath(objectPath);
  } catch {
    res.status(400).json({ error: "Invalid object path" });
    return;
  }
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "Object not found" });
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
    ".ico": "image/x-icon",
  };
  const contentType = contentTypes[ext] || "application/octet-stream";
  res.set("Content-Type", contentType);
  res.set("Cache-Control", "public, max-age=86400");
  fs.createReadStream(filePath).pipe(res);
}
