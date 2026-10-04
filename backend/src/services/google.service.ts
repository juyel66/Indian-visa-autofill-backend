import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env';

const googleClient = new OAuth2Client();

export interface GoogleUserProfile {
  googleId: string;
  name: string;
  email: string;
  picture: string | null;
}

export interface ResolvedClientCredentials {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  isExtension: boolean;
}

/**
 * Resolves the appropriate Google OAuth client credentials based on caller context.
 * Separates Chrome Extension and Web Dashboard credentials to prevent client-ID mismatch.
 */
export function resolveClientCredentials(
  requestedClientId?: string,
  providedRedirectUri?: string
): ResolvedClientCredentials {
  // 1. Explicit Client ID requested
  if (requestedClientId) {
    if (requestedClientId === env.GOOGLE_EXTENSION_CLIENT_ID) {
      return {
        clientId: env.GOOGLE_EXTENSION_CLIENT_ID,
        clientSecret: env.GOOGLE_EXTENSION_CLIENT_SECRET || env.GOOGLE_CLIENT_SECRET,
        redirectUri: providedRedirectUri || env.GOOGLE_EXTENSION_REDIRECT_URI,
        isExtension: true,
      };
    }
    if (requestedClientId === env.GOOGLE_WEB_CLIENT_ID) {
      return {
        clientId: env.GOOGLE_WEB_CLIENT_ID,
        clientSecret: env.GOOGLE_WEB_CLIENT_SECRET || env.GOOGLE_CLIENT_SECRET,
        redirectUri: providedRedirectUri || env.GOOGLE_WEB_REDIRECT_URI,
        isExtension: false,
      };
    }
  }

  // 2. Auto-detect based on redirectUri (Chrome Extension URIs: chromiumapp.org or chrome-extension://)
  const isExtensionUri =
    (providedRedirectUri &&
      (providedRedirectUri.includes('chromiumapp.org') ||
        providedRedirectUri.includes('chrome-extension://'))) ||
    providedRedirectUri === env.GOOGLE_EXTENSION_REDIRECT_URI;

  if (isExtensionUri) {
    return {
      clientId: env.GOOGLE_EXTENSION_CLIENT_ID,
      clientSecret: env.GOOGLE_EXTENSION_CLIENT_SECRET || env.GOOGLE_CLIENT_SECRET,
      redirectUri: providedRedirectUri || env.GOOGLE_EXTENSION_REDIRECT_URI,
      isExtension: true,
    };
  }

  // 3. Default to Web Dashboard Client credentials
  return {
    clientId: env.GOOGLE_WEB_CLIENT_ID,
    clientSecret: env.GOOGLE_WEB_CLIENT_SECRET || env.GOOGLE_CLIENT_SECRET,
    redirectUri: providedRedirectUri || env.GOOGLE_WEB_REDIRECT_URI,
    isExtension: false,
  };
}

export async function exchangeGoogleCode(
  code: string,
  redirectUri?: string,
  codeVerifier?: string,
  clientId?: string
): Promise<GoogleUserProfile> {
  if (!code || typeof code !== 'string') {
    throw new Error('Authorization code is required');
  }

  const primaryCreds = resolveClientCredentials(clientId, redirectUri);

  const attemptExchange = async (creds: {
    clientId: string;
    clientSecret?: string;
    redirectUri: string;
  }) => {
    const client = new OAuth2Client({
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
      redirectUri: creds.redirectUri,
    });

    const tokenResponse = await client.getToken({
      code,
      codeVerifier,
      redirect_uri: creds.redirectUri,
    });

    return { tokens: tokenResponse.tokens, client };
  };

  let tokens;
  let client;

  try {
    const res = await attemptExchange(primaryCreds);
    tokens = res.tokens;
    client = res.client;
  } catch (err: any) {
    // If exchange failed due to client mismatch and no explicit clientId was requested,
    // attempt exchange with alternate credentials
    const isClientMismatch =
      err?.message?.includes('invalid_client') ||
      err?.message?.includes('unauthorized_client') ||
      err?.response?.data?.error === 'invalid_client' ||
      err?.response?.data?.error === 'unauthorized_client';

    if (!clientId && isClientMismatch) {
      const alternateCreds: ResolvedClientCredentials = primaryCreds.isExtension
        ? {
            clientId: env.GOOGLE_WEB_CLIENT_ID,
            clientSecret: env.GOOGLE_WEB_CLIENT_SECRET || env.GOOGLE_CLIENT_SECRET,
            redirectUri: redirectUri || env.GOOGLE_WEB_REDIRECT_URI,
            isExtension: false,
          }
        : {
            clientId: env.GOOGLE_EXTENSION_CLIENT_ID,
            clientSecret: env.GOOGLE_EXTENSION_CLIENT_SECRET || env.GOOGLE_CLIENT_SECRET,
            redirectUri: redirectUri || env.GOOGLE_EXTENSION_REDIRECT_URI,
            isExtension: true,
          };

      try {
        const altRes = await attemptExchange(alternateCreds);
        tokens = altRes.tokens;
        client = altRes.client;
      } catch {
        const errorDetails =
          err?.response?.data?.error_description ||
          err?.response?.data?.error ||
          err.message;
        throw new Error(`Google token exchange failed: ${errorDetails}`);
      }
    } else {
      const errorDetails =
        err?.response?.data?.error_description ||
        err?.response?.data?.error ||
        err.message;
      throw new Error(`Google token exchange failed: ${errorDetails}`);
    }
  }

  if (!tokens || (!tokens.id_token && !tokens.access_token)) {
    throw new Error('No tokens received from Google token exchange');
  }

  // 1. If id_token exists, verify it
  if (tokens.id_token) {
    try {
      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: env.TRUSTED_GOOGLE_CLIENT_IDS,
      });

      const payload = ticket.getPayload();
      if (payload && payload.sub && payload.email) {
        return {
          googleId: payload.sub,
          email: payload.email,
          name: payload.name || payload.email.split('@')[0],
          picture: payload.picture || null,
        };
      }
    } catch {
      // Fall through to access_token userinfo if id_token verification fails
    }
  }

  // 2. Fallback to Google userinfo endpoint using access_token
  if (tokens.access_token) {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Google userinfo returned status ${response.status}`);
    }

    const data = (await response.json()) as {
      sub?: string;
      email?: string;
      name?: string;
      picture?: string;
    };

    if (!data.sub || !data.email) {
      throw new Error('Incomplete profile data received from Google');
    }

    return {
      googleId: data.sub,
      email: data.email,
      name: data.name || data.email.split('@')[0],
      picture: data.picture || null,
    };
  }

  throw new Error('Failed to verify Google identity information from code exchange');
}

export async function verifyGoogleToken(token: string): Promise<GoogleUserProfile> {
  if (!token || typeof token !== 'string') {
    throw new Error('Google authentication token is required');
  }

  const trimmedToken = token.trim();

  // 1. Check if token is a JWT (ID Token format: header.payload.signature)
  const isJwt = trimmedToken.split('.').length === 3;

  if (isJwt) {
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: trimmedToken,
        audience: env.TRUSTED_GOOGLE_CLIENT_IDS,
      });

      const payload = ticket.getPayload();
      if (payload && payload.sub && payload.email) {
        return {
          googleId: payload.sub,
          email: payload.email,
          name: payload.name || payload.email.split('@')[0],
          picture: payload.picture || null,
        };
      }

      throw new Error('Google ID token is missing subject or email claims');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid Google ID token';
      throw new Error(`Google ID token verification failed: ${message}`);
    }
  }

  // 2. Non-JWT Token: Verify as OAuth2 Access Token (e.g. from Chrome Extension chrome.identity.getAuthToken)
  try {
    const tokenInfo = await googleClient.getTokenInfo(trimmedToken);

    // Verify audience matches any of our trusted Client IDs
    const tokenAud = tokenInfo.aud;
    const tokenAzp = (tokenInfo as unknown as { azp?: string }).azp;
    const tokenIssuedTo = (tokenInfo as unknown as { issued_to?: string }).issued_to;
    const isAuthorized = env.TRUSTED_GOOGLE_CLIENT_IDS.some(
      (trustedId) =>
        trustedId === tokenAud ||
        trustedId === tokenAzp ||
        trustedId === tokenIssuedTo
    );

    if (!isAuthorized) {
      throw new Error('Token audience does not match any trusted Google Client ID');
    }

    // Fetch user profile from Google's official userinfo endpoint
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${trimmedToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Google userinfo returned status ${response.status}`);
    }

    const data = (await response.json()) as {
      sub?: string;
      email?: string;
      name?: string;
      picture?: string;
    };

    if (!data.sub || !data.email) {
      throw new Error('Incomplete profile data received from Google');
    }

    return {
      googleId: data.sub,
      email: data.email,
      name: data.name || data.email.split('@')[0],
      picture: data.picture || null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid or expired Google token';
    throw new Error(`Google verification failed: ${message}`);
  }
}
