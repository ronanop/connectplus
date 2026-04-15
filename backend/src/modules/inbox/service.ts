import { Client } from "@microsoft/microsoft-graph-client";
import { ClientSecretCredential } from "@azure/identity";
import "isomorphic-fetch";
import { ApiError } from "../../middleware/errorHandler";

export type MailFolderWellKnown = "inbox" | "drafts" | "sentitems" | "deleteditems" | "junkemail";

const MAIL_SELECT =
  "id,subject,sender,toRecipients,ccRecipients,receivedDateTime,sentDateTime,lastModifiedDateTime,isRead,hasAttachments,bodyPreview,importance,body";

// Get Microsoft Graph client for the logged-in user's mailbox
async function getGraphClientForUser(): Promise<Client | null> {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    return null;
  }

  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);

  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => {
        const tokenResponse = await credential.getToken("https://graph.microsoft.com/.default");
        if (!tokenResponse) {
          throw new Error("Failed to obtain access token");
        }
        return tokenResponse.token;
      },
    },
  });
}

function orderByForFolder(folder: MailFolderWellKnown): string {
  if (folder === "sentitems") {
    return "sentDateTime desc";
  }
  if (folder === "drafts") {
    return "lastModifiedDateTime desc";
  }
  return "receivedDateTime desc";
}

async function getWellKnownFolderId(client: Client, userEmail: string, wellKnown: MailFolderWellKnown): Promise<string> {
  const folder = await client.api(`/users/${encodeURIComponent(userEmail)}/mailFolders/${wellKnown}`).get();
  if (!folder?.id) {
    throw new ApiError(500, `Could not resolve folder: ${wellKnown}`);
  }
  return folder.id as string;
}

export const inboxService = {
  async getInbox(
    userEmail: string,
    params: { top?: number; skip?: number; filter?: string; folder?: MailFolderWellKnown },
  ) {
    const client = await getGraphClientForUser();
    if (!client) {
      throw new ApiError(500, "Microsoft Graph client not configured");
    }

    const folder: MailFolderWellKnown = params.folder ?? "inbox";

    try {
      let base = `/users/${encodeURIComponent(userEmail)}/mailFolders/${folder}/messages`;
      const queryParams: string[] = [];

      if (params.top) {
        queryParams.push(`$top=${params.top}`);
      }
      if (params.skip) {
        queryParams.push(`$skip=${params.skip}`);
      }
      if (params.filter && folder === "inbox") {
        queryParams.push(`$filter=${encodeURIComponent(params.filter)}`);
      }

      queryParams.push(`$orderby=${encodeURIComponent(orderByForFolder(folder))}`);
      queryParams.push(`$select=${MAIL_SELECT}`);

      const query = queryParams.length ? `${base}?${queryParams.join("&")}` : base;
      const response = await client.api(query).get();

      return {
        value: response.value || [],
        "@odata.count": response["@odata.count"] ?? response.value?.length ?? 0,
        folder,
      };
    } catch (error: unknown) {
      const err = error as { statusCode?: number; message?: string };
      console.error("Failed to fetch mailbox folder:", error);
      if (err.statusCode === 404) {
        throw new ApiError(404, `Mailbox or folder not found for ${userEmail}`);
      }
      if (err.statusCode === 403) {
        throw new ApiError(
          403,
          `Graph denied access. Ensure Mail.Read (and Mail.ReadWrite / Mail.Send for send & move) are granted with admin consent.`,
        );
      }
      throw new ApiError(500, `Failed to fetch messages: ${err.message || "Unknown error"}`);
    }
  },

  async getEmail(userEmail: string, messageId: string) {
    const client = await getGraphClientForUser();
    if (!client) {
      throw new ApiError(500, "Microsoft Graph client not configured");
    }

    try {
      const message = await client
        .api(`/users/${encodeURIComponent(userEmail)}/messages/${messageId}`)
        .get();

      return message;
    } catch (error: any) {
      console.error("Failed to fetch email:", error);
      if (error.statusCode === 404) {
        throw new ApiError(404, "Email not found");
      }
      throw new ApiError(500, `Failed to fetch email: ${error.message || "Unknown error"}`);
    }
  },

  async markAsRead(userEmail: string, messageId: string) {
    const client = await getGraphClientForUser();
    if (!client) {
      throw new ApiError(500, "Microsoft Graph client not configured");
    }

    try {
      await client
        .api(`/users/${encodeURIComponent(userEmail)}/messages/${messageId}`)
        .patch({
          isRead: true,
        });

      return { success: true };
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error("Failed to mark email as read:", error);
      throw new ApiError(500, `Failed to mark email as read: ${err.message || "Unknown error"}`);
    }
  },

  async listAttachments(userEmail: string, messageId: string) {
    const client = await getGraphClientForUser();
    if (!client) {
      throw new ApiError(500, "Microsoft Graph client not configured");
    }
    try {
      const response = await client
        .api(`/users/${encodeURIComponent(userEmail)}/messages/${encodeURIComponent(messageId)}/attachments`)
        .get();
      return response.value || [];
    } catch (error: unknown) {
      const err = error as { statusCode?: number; message?: string };
      if (err.statusCode === 404) {
        throw new ApiError(404, "Message or attachments not found");
      }
      throw new ApiError(500, `Failed to list attachments: ${err.message || "Unknown error"}`);
    }
  },

  async reply(userEmail: string, messageId: string, bodyHtml: string) {
    const client = await getGraphClientForUser();
    if (!client) {
      throw new ApiError(500, "Microsoft Graph client not configured");
    }
    try {
      const draft = await client
        .api(`/users/${encodeURIComponent(userEmail)}/messages/${encodeURIComponent(messageId)}/createReply`)
        .post({});
      const draftId = draft?.id as string | undefined;
      if (!draftId) {
        throw new ApiError(500, "Graph did not return a reply draft");
      }
      await client.api(`/users/${encodeURIComponent(userEmail)}/messages/${encodeURIComponent(draftId)}`).patch({
        body: { contentType: "HTML", content: bodyHtml },
      });
      await client.api(`/users/${encodeURIComponent(userEmail)}/messages/${encodeURIComponent(draftId)}/send`).post({});
      return { success: true };
    } catch (error: unknown) {
      const err = error as { message?: string; body?: { error?: { message?: string } } };
      const msg = err.body?.error?.message || err.message || "Unknown error";
      throw new ApiError(500, `Failed to send reply: ${msg}. Ensure Mail.Send and Mail.ReadWrite are granted.`);
    }
  },

  async replyAll(userEmail: string, messageId: string, bodyHtml: string) {
    const client = await getGraphClientForUser();
    if (!client) {
      throw new ApiError(500, "Microsoft Graph client not configured");
    }
    try {
      const draft = await client
        .api(`/users/${encodeURIComponent(userEmail)}/messages/${encodeURIComponent(messageId)}/createReplyAll`)
        .post({});
      const draftId = draft?.id as string | undefined;
      if (!draftId) {
        throw new ApiError(500, "Graph did not return a reply-all draft");
      }
      await client.api(`/users/${encodeURIComponent(userEmail)}/messages/${encodeURIComponent(draftId)}`).patch({
        body: { contentType: "HTML", content: bodyHtml },
      });
      await client.api(`/users/${encodeURIComponent(userEmail)}/messages/${encodeURIComponent(draftId)}/send`).post({});
      return { success: true };
    } catch (error: unknown) {
      const err = error as { message?: string; body?: { error?: { message?: string } } };
      const msg = err.body?.error?.message || err.message || "Unknown error";
      throw new ApiError(500, `Failed to send reply all: ${msg}. Ensure Mail.Send and Mail.ReadWrite are granted.`);
    }
  },

  async forward(userEmail: string, messageId: string, to: string[], comment?: string) {
    const client = await getGraphClientForUser();
    if (!client) {
      throw new ApiError(500, "Microsoft Graph client not configured");
    }
    try {
      await client
        .api(`/users/${encodeURIComponent(userEmail)}/messages/${encodeURIComponent(messageId)}/forward`)
        .post({
          comment: comment ?? "",
          toRecipients: to.map(address => ({ emailAddress: { address } })),
        });
      return { success: true };
    } catch (error: unknown) {
      const err = error as { message?: string; body?: { error?: { message?: string } } };
      const msg = err.body?.error?.message || err.message || "Unknown error";
      throw new ApiError(500, `Failed to forward: ${msg}. Ensure Mail.Send is granted.`);
    }
  },

  async sendMail(
    userEmail: string,
    payload: {
      subject: string;
      bodyHtml: string;
      to: string[];
      cc?: string[];
      attachments?: Array<{ name: string; contentType: string; contentBase64: string }>;
    },
  ) {
    const client = await getGraphClientForUser();
    if (!client) {
      throw new ApiError(500, "Microsoft Graph client not configured");
    }
    const message: Record<string, unknown> = {
      subject: payload.subject,
      body: { contentType: "HTML", content: payload.bodyHtml },
      toRecipients: payload.to.map(address => ({ emailAddress: { address } })),
    };
    if (payload.cc?.length) {
      message.ccRecipients = payload.cc.map(address => ({ emailAddress: { address } }));
    }
    if (payload.attachments?.length) {
      message.attachments = payload.attachments.map(a => ({
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: a.name,
        contentType: a.contentType,
        contentBytes: a.contentBase64,
      }));
    }
    try {
      await client.api(`/users/${encodeURIComponent(userEmail)}/sendMail`).post({
        message,
        saveToSentItems: true,
      });
      return { success: true };
    } catch (error: unknown) {
      const err = error as { message?: string; body?: { error?: { message?: string } } };
      const msg = err.body?.error?.message || err.message || "Unknown error";
      throw new ApiError(500, `Failed to send mail: ${msg}. Ensure Mail.Send is granted.`);
    }
  },

  async createDraft(
    userEmail: string,
    payload: { subject?: string; bodyHtml?: string; to?: string[] },
  ) {
    const client = await getGraphClientForUser();
    if (!client) {
      throw new ApiError(500, "Microsoft Graph client not configured");
    }
    const message: Record<string, unknown> = {
      isDraft: true,
      subject: payload.subject ?? "",
      body: {
        contentType: "HTML",
        content: payload.bodyHtml ?? "<br/>",
      },
    };
    if (payload.to?.length) {
      message.toRecipients = payload.to.map(address => ({ emailAddress: { address } }));
    }
    try {
      const created = await client.api(`/users/${encodeURIComponent(userEmail)}/messages`).post(message);
      return { id: created.id as string };
    } catch (error: unknown) {
      const err = error as { message?: string; body?: { error?: { message?: string } } };
      const msg = err.body?.error?.message || err.message || "Unknown error";
      throw new ApiError(500, `Failed to create draft: ${msg}. Ensure Mail.ReadWrite is granted.`);
    }
  },

  async moveMessage(userEmail: string, messageId: string, destination: "inbox" | "junkemail" | "deleteditems") {
    const client = await getGraphClientForUser();
    if (!client) {
      throw new ApiError(500, "Microsoft Graph client not configured");
    }
    try {
      const destinationId = await getWellKnownFolderId(client, userEmail, destination);
      await client
        .api(`/users/${encodeURIComponent(userEmail)}/messages/${encodeURIComponent(messageId)}/move`)
        .post({ destinationId });
      return { success: true };
    } catch (error: unknown) {
      const err = error as { message?: string; body?: { error?: { message?: string } } };
      const msg = err.body?.error?.message || err.message || "Unknown error";
      throw new ApiError(500, `Failed to move message: ${msg}. Ensure Mail.ReadWrite is granted.`);
    }
  },

  async deleteMessage(userEmail: string, messageId: string) {
    const client = await getGraphClientForUser();
    if (!client) {
      throw new ApiError(500, "Microsoft Graph client not configured");
    }
    try {
      await client.api(`/users/${encodeURIComponent(userEmail)}/messages/${encodeURIComponent(messageId)}`).delete();
      return { success: true };
    } catch (error: unknown) {
      const err = error as { message?: string; body?: { error?: { message?: string } } };
      const msg = err.body?.error?.message || err.message || "Unknown error";
      throw new ApiError(500, `Failed to delete message: ${msg}. Ensure Mail.ReadWrite is granted.`);
    }
  },
};
