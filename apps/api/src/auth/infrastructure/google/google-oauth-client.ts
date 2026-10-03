import { createPublicKey } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { SocialAuthenticationUnavailableError } from '../../domain/errors/social-authentication-unavailable.error.js';

// Keep Google's certificate cache and JWT verifier; configure only its HTTP boundary.
export function createGoogleOAuthClient(): OAuth2Client {
  const client = new OAuth2Client({
    transporterOptions: { timeout: 5000, retryConfig: { retry: 0 } },
  });
  client.transporter.interceptors.response.add({
    resolved: async (response) => {
      // Reject malformed PEM responses before the SDK puts them into its cache.
      const certificates: unknown = response.data;
      try {
        if (
          !certificates ||
          typeof certificates !== 'object' ||
          Array.isArray(certificates)
        )
          throw new Error();
        const values = Object.values(certificates);
        if (!values.length) throw new Error();
        for (const certificate of values) {
          if (typeof certificate !== 'string' || !certificate.trim())
            throw new Error();
          createPublicKey(certificate);
        }
      } catch {
        throw new SocialAuthenticationUnavailableError();
      }
      return response;
    },
    rejected: () => {
      throw new SocialAuthenticationUnavailableError();
    },
  });
  return client;
}
