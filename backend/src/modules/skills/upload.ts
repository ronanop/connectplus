import multer from "multer";

const MAX_BYTES = 10 * 1024 * 1024;

const allowedMime = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

export const certificationCertificateUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    const mt = file.mimetype || "";
    if (allowedMime.has(mt)) {
      cb(null, true);
      return;
    }
    cb(new Error(`Certificate must be PDF or image (PNG/JPEG/WebP). Received: ${mt || "unknown"}`));
  },
});
