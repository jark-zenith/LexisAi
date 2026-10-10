export interface VerifiedGoogleIdentity {
  googleId: string;
  email: string;
  fullName: string;
  profilePhotoUrl: string | null;
}

/**
 * Validates Google tokeninfo claims against the configured OAuth client.
 * This pure function is exported to make the security requirements testable.
 */
export function validateGoogleTokenInfo(
  tokenInfo: any,
  expectedClientId: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): VerifiedGoogleIdentity | null {
  if (!tokenInfo || typeof tokenInfo !== "object" || !expectedClientId?.trim()) return null;

  const issuer = tokenInfo.iss;
  const audience = typeof tokenInfo.aud === "string" ? tokenInfo.aud : "";
  const email = typeof tokenInfo.email === "string" ? tokenInfo.email.trim() : "";
  const googleId = typeof tokenInfo.sub === "string" ? tokenInfo.sub.trim() : "";
  const expirySeconds = Number(tokenInfo.exp);
  const emailVerified = tokenInfo.email_verified === true || tokenInfo.email_verified === "true";

  if (
    !googleId ||
    !email ||
    !email.includes("@") ||
    !emailVerified ||
    audience !== expectedClientId ||
    (tokenInfo.azp && tokenInfo.azp !== expectedClientId) ||
    (issuer !== "accounts.google.com" && issuer !== "https://accounts.google.com") ||
    !Number.isFinite(expirySeconds) ||
    expirySeconds <= nowSeconds
  ) {
    return null;
  }

  return {
    googleId,
    email,
    fullName: typeof tokenInfo.name === "string" && tokenInfo.name.trim()
      ? tokenInfo.name.trim()
      : (typeof tokenInfo.given_name === "string" && tokenInfo.given_name.trim()
        ? tokenInfo.given_name.trim()
        : "Google User"),
    profilePhotoUrl: typeof tokenInfo.picture === "string" && tokenInfo.picture.trim()
      ? tokenInfo.picture.trim()
      : null,
  };
}

/**
 * Verifies a Google Identity Services ID token over HTTPS and validates its
 * issuer, audience, expiry, subject, and verified-email claims. Fails closed.
 */
export async function verifyGoogleIdToken(
  credential: string,
  expectedClientId: string
): Promise<VerifiedGoogleIdentity | null> {
  if (typeof credential !== "string" || !credential.trim() || credential.length > 10000) return null;
  if (!expectedClientId?.trim()) return null;

  try {
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
      { method: "GET", headers: { Accept: "application/json" } }
    );
    if (!response.ok) return null;
    const tokenInfo = await response.json();
    return validateGoogleTokenInfo(tokenInfo, expectedClientId);
  } catch {
    return null;
  }
}
