/**
 * Local filesystem storage service — replaces Replit GCS sidecar.
 * Files are stored under UPLOADS_DIR (default: ./uploads).
 * Object paths follow the same /objects/uploads/<uuid> convention
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
  return dir;
}

/**
 * Save a buffer to local disk. Returns the /objects/uploads/<uuid> path.
 */
export function saveUpload(buffer: Buffer, originalName: string): string {
  const ext = path.extname(originalName);
  const uuid = randomUUID();
  const fileName = `${uuid}${ext}`;
  const uploadsDir = getUploadsDir();
  fs.writeFileSync(path.join(uploadsDir, fileName), buffer);
  return `/objects/uploads/${fileName}`;
}

/**
 * Read a file by its /objects/uploads/<filename> path.
 * Returns the Buffer, or throws if not found.
 */
export function readUpload(objectPath: string): Buffer {
  if (!objectPath.startsWith("/objects/uploads/")) {
    throw new Error("Invalid object path");
  }
  const fileName = objectPath.replace("/objects/uploads/", "");
  const filePath = path.join(getUploadsDir(), fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error("Object not found");
  }
  return fs.readFileSync(filePath);
}

/**
 * Delete a file by its /objects/uploads/<filename> path.
 */
export function deleteUpload(objectPath: string): void {
  if (!objectPath.startsWith("/objects/uploads/")) return;
  const fileName = objectPath.replace("/objects/uploads/", "");
  const filePath = path.join(getUploadsDir(), fileName);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

/**
 * Stream a local upload file to an Express response.
 */
export function serveUpload(objectPath: string, res: Response): void {
  if (!objectPath.startsWith("/objects/uploads/")) {
    res.status(400).json({ error: "Invalid object path" });
    return;
  }
  const fileName = objectPath.replace("/objects/uploads/", "");
  const filePath = path.join(getUploadsDir(), fileName);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "Object not found" });
    return;
  }
  // Basic content-type detection
  const ext = path.extname(fileName).toLowerCase();
  const contentTypes: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
  };
  const contentType = contentTypes[ext] || "application/octet-stream";
  res.set("Content-Type", contentType);
  res.set("Cache-Control", "public, max-age=86400");
  fs.createReadStream(filePath).pipe(res);
}
