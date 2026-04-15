/**
 * SPA registrations must redeem auth codes in the browser (cross-origin to login.microsoftonline.com).
 * Server-side redemption returns AADSTS9002327.
 */
export async function exchangeMicrosoftAuthCodeForAccessToken(params: {
  tenantId: string;
  clientId: string;
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<string> {
  const body = new URLSearchParams({
    client_id: params.clientId,
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
    code_verifier: params.codeVerifier,
  });

  const res = await fetch(`https://login.microsoftonline.com/${params.tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = (await res.json()) as { access_token?: string; error?: string; error_description?: string };

  if (!res.ok) {
    throw new Error(data.error_description || data.error || `Token exchange failed (${res.status})`);
  }
  if (!data.access_token) {
    throw new Error("No access token from Microsoft");
  }
  return data.access_token;
}
