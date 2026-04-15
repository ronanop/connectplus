import multer from "multer";

const MAX_BYTES = 12 * 1024 * 1024;

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

export const reimbursementBillUpload = multer({
  storage: multer.memoryStorage(),
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
