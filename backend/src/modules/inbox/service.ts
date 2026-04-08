import { prisma } from "../../prisma";
import { Client } from "@microsoft/microsoft-graph-client";
import { ClientSecretCredential } from "@azure/identity";
import "isomorphic-fetch";
import { ApiError } from "../../middleware/errorHandler";

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

export const inboxService = {
  async getInbox(userEmail: string, params: { top?: number; skip?: number; filter?: string }) {
    const client = await getGraphClientForUser();
    if (!client) {
      throw new ApiError(500, "Microsoft Graph client not configured");
    }

    try {
      // Build the query
      let query = `/users/${encodeURIComponent(userEmail)}/messages`;
      const queryParams: string[] = [];
      
      if (params.top) {
        queryParams.push(`$top=${params.top}`);
      }
      if (params.skip) {
        queryParams.push(`$skip=${params.skip}`);
      }
      if (params.filter) {
        queryParams.push(`$filter=${encodeURIComponent(params.filter)}`);
      }
      
      // Always order by receivedDateTime descending
      queryParams.push("$orderby=receivedDateTime desc");
      
      // Select specific fields
      queryParams.push("$select=id,subject,sender,toRecipients,receivedDateTime,isRead,hasAttachments,bodyPreview,importance,body");

      if (queryParams.length > 0) {
        query += "?" + queryParams.join("&");
      }

      const response = await client.api(query).get();

      return {
        value: response.value || [],
        "@odata.count": response["@odata.count"] || response.value?.length || 0,
      };
    } catch (error: any) {
      console.error("Failed to fetch inbox:", error);
      if (error.statusCode === 404) {
        throw new ApiError(404, `Mailbox not found for ${userEmail}`);
      }
      if (error.statusCode === 403) {
        throw new ApiError(
          403,
          `Graph denied access to ${userEmail}. Grant this app Mail.Read (application) + admin consent, or ensure the mailbox exists in the tenant.`,
        );
      }
      throw new ApiError(500, `Failed to fetch inbox: ${error.message || "Unknown error"}`);
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
    } catch (error: any) {
      console.error("Failed to mark email as read:", error);
      throw new ApiError(500, `Failed to mark email as read: ${error.message || "Unknown error"}`);
    }
  },
};
