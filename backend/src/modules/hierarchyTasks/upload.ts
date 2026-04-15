import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import multer from "multer";

const UPLOAD_SEGMENT = "hierarchy-tasks";
const MAX_BYTES = 12 * 1024 * 1024;

export function hierarchyTaskUploadRoot(): string {
  return path.join(process.cwd(), "uploads", UPLOAD_SEGMENT);
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const allowedMime = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/zip",
  "application/x-zip-compressed",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export const hierarchyTaskArtifactUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const taskId = req.params.id;
      const dir = path.join(hierarchyTaskUploadRoot(), String(taskId));
      try {
        ensureDir(dir);
        cb(null, dir);
      } catch (e) {
        cb(e as Error, dir);
      }
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").slice(0, 16) || ".bin";
      const base = path.basename(file.originalname || "file", ext).replace(/[^\w.-]+/g, "_").slice(0, 80);
      cb(null, `${randomUUID()}-${base}${ext}`);
    },
  }),
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    const mt = file.mimetype || "";
    if (allowedMime.has(mt)) {
      cb(null, true);
      return;
    }
    cb(new Error(`Unsupported file type: ${mt}`));
  },
});

/** Relative path stored in DB (from uploads/ root). */
export function toStoredPath(taskId: number, filename: string): string {
  return path.join(UPLOAD_SEGMENT, String(taskId), filename).replace(/\\/g, "/");
}

export function absolutePathFromStored(storedPath: string): string {
  const normalized = storedPath.replace(/\\/g, "/");
  if (normalized.includes("..")) {
    throw new Error("Invalid path");
  }
  return path.join(process.cwd(), "uploads", normalized);
}
