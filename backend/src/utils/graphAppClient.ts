import { Client } from "@microsoft/microsoft-graph-client";
import { ClientSecretCredential } from "@azure/identity";
import "isomorphic-fetch";

let graphClient: Client | null = null;
let credential: ClientSecretCredential | null = null;

/**
 * App-only Microsoft Graph client (same credentials as mail / inbox).
 * Requires Azure AD app permission: User.Read.All (application).
 */
export async function getAppGraphClient(): Promise<Client | null> {
  if (graphClient) {
    return graphClient;
  }

  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
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
