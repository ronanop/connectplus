import { z } from "zod";

export const mailFolderSchema = z.enum(["inbox", "drafts", "sentitems", "deleteditems", "junkemail"]);

export const sendMailBodySchema = z.object({
  subject: z.string().min(1).max(998),
  bodyHtml: z.string().min(1).max(1024 * 512),
  to: z.array(z.string().email()).min(1).max(100),
  cc: z.array(z.string().email()).max(100).optional(),
  attachments: z
    .array(
      z.object({
        name: z.string().min(1).max(255),
        contentType: z.string().min(1).max(128),
        contentBase64: z.string().min(1).max(25 * 1024 * 1024),
      }),
    )
    .max(20)
    .optional(),
});

export const replyBodySchema = z.object({
  bodyHtml: z.string().min(1).max(1024 * 512),
});

export const forwardBodySchema = z.object({
  to: z.array(z.string().email()).min(1).max(100),
  comment: z.string().max(100000).optional(),
});

export const moveBodySchema = z.object({
  destination: z.enum(["inbox", "junkemail", "deleteditems"]),
});

export const createDraftBodySchema = z.object({
  subject: z.string().max(998).optional(),
  bodyHtml: z.string().max(1024 * 512).optional(),
  to: z.array(z.string().email()).max(100).optional(),
});
