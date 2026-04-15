import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import multer from "multer";

const UPLOAD_SEGMENT = "profile-photos";
const MAX_BYTES = 5 * 1024 * 1024;

export function profilePhotoUploadRoot(): string {
  return path.join(process.cwd(), "uploads", UPLOAD_SEGMENT);
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const allowedMime = new Set(["image/png", "image/jpeg", "image/webp"]);

export const profilePhotoUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const userId = (req as { user?: { id: number } }).user?.id;
      const dir = path.join(profilePhotoUploadRoot(), String(userId ?? "unknown"));
      try {
        ensureDir(dir);
        cb(null, dir);
      } catch (e) {
        cb(e as Error, dir);
      }
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").slice(0, 8).toLowerCase();
      const safeExt = ext === ".jpg" ? ".jpeg" : ext === ".jpeg" || ext === ".png" || ext === ".webp" ? ext : ".jpg";
      cb(null, `${randomUUID()}${safeExt}`);
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

/** Relative path from uploads/ root, POSIX slashes. */
export function toStoredProfilePath(userId: number, filename: string): string {
  return path.join(UPLOAD_SEGMENT, String(userId), filename).replace(/\\/g, "/");
}

export function absolutePathFromStored(storedPath: string): string {
  const normalized = storedPath.replace(/\\/g, "/");
  if (normalized.includes("..")) {
    throw new Error("Invalid path");
  }
  return path.join(process.cwd(), "uploads", normalized);
}
