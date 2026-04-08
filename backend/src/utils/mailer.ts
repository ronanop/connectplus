import { Client } from "@microsoft/microsoft-graph-client";
import { ClientSecretCredential } from "@azure/identity";
import "isomorphic-fetch";

// Initialize Microsoft Graph Client for Outlook/Azure
let graphClient: Client | null = null;
let credential: ClientSecretCredential | null = null;

async function getGraphClient(): Promise<Client | null> {
  if (graphClient) {
    return graphClient;
  }

  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    console.warn("Azure credentials not configured. Email sending will be disabled.");
    return null;
  }

  credential = new ClientSecretCredential(tenantId, clientId, clientSecret);

  graphClient = Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => {
        if (!credential) {
          throw new Error("Credential not initialized");
        }
        const tokenResponse = await credential.getToken("https://graph.microsoft.com/.default");
        if (!tokenResponse) {
          throw new Error("Failed to obtain access token");
        }
        return tokenResponse.token;
      },
    },
  });

  return graphClient;
}

interface SendMailOptions {
  to: string;
  from?: string;
  subject: string;
  html: string;
  text?: string;
}

export const mailer = {
  sendMail: async (options: SendMailOptions): Promise<void> => {
    const client = await getGraphClient();
    if (!client) {
      console.warn("Microsoft Graph client not initialized. Email not sent.");
      return;
    }

    const fromEmail = options.from || process.env.AZURE_FROM_EMAIL;
    if (!fromEmail) {
      throw new Error("Sender email address not configured. Set AZURE_FROM_EMAIL environment variable.");
    }

    try {
      await client
        .api(`/users/${encodeURIComponent(fromEmail)}/sendMail`)
        .post({
          message: {
            subject: options.subject,
            body: {
              contentType: "HTML",
              content: options.html,
            },
            toRecipients: [
              {
                emailAddress: {
                  address: options.to,
                },
              },
            ],
          },
          saveToSentItems: true,
        });
    } catch (error) {
      console.error("Failed to send email via Microsoft Graph:", error);
      throw error;
    }
  },
};

