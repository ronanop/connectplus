import { Response } from "express";
import { AuthenticatedRequest } from "../../types/auth";
import { inboxService, type MailFolderWellKnown } from "./service";
import { prisma } from "../../prisma";
import { ApiError } from "../../middleware/errorHandler";
import { resolveInboxMailbox } from "./delegation";
import {
  createDraftBodySchema,
  forwardBodySchema,
  mailFolderSchema,
  moveBodySchema,
  replyBodySchema,
  sendMailBodySchema,
} from "./validation";

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

  let folder: MailFolderWellKnown = "inbox";
  const folderQ = req.query.folder;
  if (folderQ != null && typeof folderQ === "string" && folderQ.length > 0) {
    const parsed = mailFolderSchema.safeParse(folderQ);
    if (!parsed.success) {
      throw new ApiError(400, "Invalid folder. Use inbox, drafts, sentitems, deleteditems, or junkemail.");
    }
    folder = parsed.data;
  }

  const result = await inboxService.getInbox(mailbox, { top, skip, filter, folder });

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

export const listAttachments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }
  const { id: messageId } = req.params;
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { email: true },
  });
  if (!user?.email) {
    throw new ApiError(404, "User email not found");
  }
  const mailbox = resolveInboxMailbox(user.email, req.query.mailbox);
  const attachments = await inboxService.listAttachments(mailbox, messageId);
  res.json({ success: true, data: { attachments }, message: "" });
};

export const replyEmail = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }
  const { id: messageId } = req.params;
  const body = replyBodySchema.parse(req.body);
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { email: true },
  });
  if (!user?.email) {
    throw new ApiError(404, "User email not found");
  }
  const mailbox = resolveInboxMailbox(user.email, req.query.mailbox);
  await inboxService.reply(mailbox, messageId, body.bodyHtml);
  res.json({ success: true, data: null, message: "Reply sent" });
};

export const replyAllEmail = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }
  const { id: messageId } = req.params;
  const body = replyBodySchema.parse(req.body);
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { email: true },
  });
  if (!user?.email) {
    throw new ApiError(404, "User email not found");
  }
  const mailbox = resolveInboxMailbox(user.email, req.query.mailbox);
  await inboxService.replyAll(mailbox, messageId, body.bodyHtml);
  res.json({ success: true, data: null, message: "Reply all sent" });
};

export const forwardEmail = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }
  const { id: messageId } = req.params;
  const body = forwardBodySchema.parse(req.body);
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { email: true },
  });
  if (!user?.email) {
    throw new ApiError(404, "User email not found");
  }
  const mailbox = resolveInboxMailbox(user.email, req.query.mailbox);
  await inboxService.forward(mailbox, messageId, body.to, body.comment);
  res.json({ success: true, data: null, message: "Message forwarded" });
};

export const sendNewMail = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }
  const body = sendMailBodySchema.parse(req.body);
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { email: true },
  });
  if (!user?.email) {
    throw new ApiError(404, "User email not found");
  }
  const mailbox = resolveInboxMailbox(user.email, req.query.mailbox);
  await inboxService.sendMail(mailbox, {
    subject: body.subject,
    bodyHtml: body.bodyHtml,
    to: body.to,
    cc: body.cc,
    attachments: body.attachments,
  });
  res.status(201).json({ success: true, data: null, message: "Message sent" });
};

export const saveDraft = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }
  const body = createDraftBodySchema.parse(req.body);
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { email: true },
  });
  if (!user?.email) {
    throw new ApiError(404, "User email not found");
  }
  const mailbox = resolveInboxMailbox(user.email, req.query.mailbox);
  const { id } = await inboxService.createDraft(mailbox, {
    subject: body.subject,
    bodyHtml: body.bodyHtml,
    to: body.to,
  });
  res.status(201).json({ success: true, data: { id }, message: "Draft saved" });
};

export const moveEmail = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }
  const { id: messageId } = req.params;
  const body = moveBodySchema.parse(req.body);
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { email: true },
  });
  if (!user?.email) {
    throw new ApiError(404, "User email not found");
  }
  const mailbox = resolveInboxMailbox(user.email, req.query.mailbox);
  await inboxService.moveMessage(mailbox, messageId, body.destination);
  res.json({ success: true, data: null, message: "Message moved" });
};

export const deleteEmail = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }
  const { id: messageId } = req.params;
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { email: true },
  });
  if (!user?.email) {
    throw new ApiError(404, "User email not found");
  }
  const mailbox = resolveInboxMailbox(user.email, req.query.mailbox);
  await inboxService.deleteMessage(mailbox, messageId);
  res.json({ success: true, data: null, message: "Message deleted" });
};
