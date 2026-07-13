/**
 * Google OAuth utilities for The Vision Scope
 *
 * Status: STUB — awaiting VITE_GOOGLE_CLIENT_ID environment variable.
 * See GOOGLE_OAUTH_SETUP.md for configuration steps.
 */

export interface GoogleUserProfile {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export interface GoogleAuthToken {
  access_token: string;
  id_token: string;
  expires_in: number;
}

/**
 * Append the Google Sign-In SDK script to the document head.
 * Call once on app startup when VITE_GOOGLE_CLIENT_ID is available.
 */
export const initializeGoogleAuth = (clientId: string): void => {
  if (typeof window === "undefined" || !clientId) return;
  if (document.getElementById("google-gsi-script")) return; // already loaded
  const script = document.createElement("script");
  script.id = "google-gsi-script";
  script.src = "https://accounts.google.com/gsi/client";
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);
};

/**
 * Trigger Google Sign-In.
 * Returns profile + token on success, null on failure or if not configured.
 */
export const handleGoogleSignIn = (): Promise<{
  profile: GoogleUserProfile;
  token: GoogleAuthToken;
} | null> => {
  return new Promise((resolve) => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.warn("[GoogleAuth] VITE_GOOGLE_CLIENT_ID is not set. See GOOGLE_OAUTH_SETUP.md.");
      resolve(null);
      return;
    }
    const google = (window as any).google;
    if (!google?.accounts?.id) {
      console.warn("[GoogleAuth] Google GSI SDK not loaded yet.");
      resolve(null);
      return;
    }
    // TODO: implement full popup flow once VITE_GOOGLE_CLIENT_ID is configured
    console.warn("[GoogleAuth] Sign-in flow pending full activation.");
    resolve(null);
  });
};

/**
 * Decode a Google credential JWT and extract profile + token metadata.
 */
export const getGoogleTokenAndProfile = (
  credentialResponse: any
): { profile: GoogleUserProfile; token: GoogleAuthToken } | null => {
  try {
    if (!credentialResponse?.credential) return null;
    const base64 = credentialResponse.credential
      .split(".")[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const payload = JSON.parse(atob(base64));
    return {
      profile: {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
      },
      token: {
        access_token: credentialResponse.credential,
        id_token: credentialResponse.credential,
        expires_in: payload.exp - Math.floor(Date.now() / 1000),
      },
    };
  } catch {
    return null;
  }
};
