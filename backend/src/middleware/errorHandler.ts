import { Request, Response, NextFunction } from "express";
import multer from "multer";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

export class ApiError extends Error {
  statusCode: number;
  /** Machine-readable code for clients (e.g. hierarchy task rules). */
  code?: string;

  constructor(statusCode: number, message: string, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      data: null,
      message: err.message,
      ...(err.code ? { error: err.code } : {}),
    });
    return;
  }

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({
        success: false,
        data: null,
        message: "File too large (maximum 10MB for certificates).",
      });
      return;
    }
  }

  if (err instanceof Error && err.message.includes("Certificate must be PDF or image")) {
    res.status(400).json({ success: false, data: null, message: err.message });
    return;
  }

  console.error(err);

  if (err instanceof PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const targets = (err.meta as { target?: string[] } | undefined)?.target ?? [];
      const t = targets.join(" ").toLowerCase();
      const msg = (err.message ?? "").toLowerCase();
      const isAttendanceUserDate =
        (t.includes("userid") && t.includes("date")) ||
        (t.includes("user_id") && t.includes("date")) ||
        (msg.includes("user_id") && msg.includes("date"));
      res.status(409).json({
        success: false,
        data: null,
        message: isAttendanceUserDate
          ? "Your attendance for today has already been recorded."
          : "This record already exists.",
        error: isAttendanceUserDate ? "ALREADY_CHECKED_IN" : "DUPLICATE",
      });
      return;
    }
  }

  const isProd = process.env.NODE_ENV === "production";
  res.status(500).json({
    success: false,
    data: null,
    message: isProd ? "Internal server error" : err instanceof Error ? err.message : "Internal server error",
  });
};
