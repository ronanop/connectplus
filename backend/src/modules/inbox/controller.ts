import { Response } from "express";
import { AuthenticatedRequest } from "../../types/auth";
import { inboxService } from "./service";
import { prisma } from "../../prisma";
import { ApiError } from "../../middleware/errorHandler";
import { resolveInboxMailbox } from "./delegation";

export const getInbox = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }

  // Get user's email from database
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { email: true },
  });

  if (!user || !user.email) {
    throw new ApiError(404, "User email not found");
  }

  const top = req.query.top ? parseInt(req.query.top as string, 10) : 50;
  const skip = req.query.skip ? parseInt(req.query.skip as string, 10) : 0;
  const filter = req.query.filter as string | undefined;
  const mailbox = resolveInboxMailbox(user.email, req.query.mailbox);

  const result = await inboxService.getInbox(mailbox, { top, skip, filter });

  res.json({
    success: true,
    data: result,
    message: "",
  });
};

export const getEmail = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }

  const { id: messageId } = req.params;

  // Get user's email from database
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { email: true },
  });

  if (!user || !user.email) {
    throw new ApiError(404, "User email not found");
  }

  const mailbox = resolveInboxMailbox(user.email, req.query.mailbox);
  const email = await inboxService.getEmail(mailbox, messageId);

  res.json({
    success: true,
    data: { email },
    message: "",
  });
};

export const markEmailAsRead = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }

  const { id: messageId } = req.params;

  // Get user's email from database
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { email: true },
  });

  if (!user || !user.email) {
    throw new ApiError(404, "User email not found");
  }

  const mailbox = resolveInboxMailbox(user.email, req.query.mailbox);
  await inboxService.markAsRead(mailbox, messageId);

  res.json({
    success: true,
    data: null,
    message: "Email marked as read",
  });
};
