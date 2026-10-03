/**
 * Workspace Invite URL Resolution Utility
 * 
 * Provides clear separation between:
 * 1. Application Navigation Origin (the active browser instance)
 * 2. Shareable Invite Base URL (configurable via VITE_APP_BASE_URL)
 * 
 * Rules:
 * - If VITE_APP_BASE_URL is defined, use it for shareable invite links.
 * - If not defined, dynamically fall back to the active browser origin.
 * - Never hardcodes any domain, port, or IP address.
 */

/**
 * Returns the current application navigation origin (where the browser is currently running).
 * Ensures local development on localhost/127.0.0.1/private LAN stays over HTTP.
 */
export const getNavigationOrigin = () => {
  if (typeof window === 'undefined') return '';
  const { protocol, host, hostname, origin } = window.location;

  // Local/LAN development servers (e.g. Vite) run plain HTTP without SSL certificates.
  // Safari can auto-promote 'localhost' to 'https://' which causes TLS errors.
  // Normalize protocol to http: for local/private IP development.
  const isLocalOrPrivate =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname);

  if (isLocalOrPrivate && protocol === 'https:') {
    return `http://${host}`;
  }

  return origin || `${protocol}//${host}`;
};

/**
 * Returns the base URL for constructing shareable workspace invite links.
 * Prioritizes the environment variable VITE_APP_BASE_URL (if configured),
 * falling back to the dynamic browser navigation origin.
 */
export const getShareableInviteBaseUrl = () => {
  const envBaseUrl = import.meta.env.VITE_APP_BASE_URL;

  if (envBaseUrl && typeof envBaseUrl === 'string' && envBaseUrl.trim()) {
    // Strip trailing slashes
    return envBaseUrl.trim().replace(/\/+$/, '');
  }

  return getNavigationOrigin();
};

/**
 * Constructs a full workspace invite link for a given token.
 * Output format: {baseURL}/join/{token}
 */
export const buildInviteUrl = (token) => {
  if (!token) return '';
  const base = getShareableInviteBaseUrl();
  return `${base}/join/${encodeURIComponent(token.trim())}`;
};

/**
 * Checks whether an invite URL points to a local-only address (localhost / 127.0.0.1).
 */
export const isLocalInviteUrl = (url) => {
  if (!url) return false;
  return url.includes('localhost') || url.includes('127.0.0.1');
};
