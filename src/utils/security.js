/**
 * Cryptographic security utilities for UNSAID
 * Uses Web Crypto API (crypto.getRandomValues / crypto.randomUUID) for unpredictable random generation
 */

/**
 * Generate a cryptographically secure random token (hex string)
 * @param {number} byteLength Number of random bytes (default 20 = 160 bits entropy)
 * @returns {string} Hex encoded random string
 */
export const generateSecureToken = (byteLength = 20) => {
  // 1. Primary: crypto.getRandomValues in browser
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    try {
      const bytes = new Uint8Array(byteLength);
      window.crypto.getRandomValues(bytes);
      return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      console.warn('[UNSAID Security] crypto.getRandomValues failed, attempting fallback:', e);
    }
  }

  // 2. Global crypto environment fallback
  const cryptoModule = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
  if (cryptoModule?.getRandomValues) {
    try {
      const bytes = new Uint8Array(byteLength);
      cryptoModule.getRandomValues(bytes);
      return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    } catch {}
  }

  // 3. Fallback: crypto.randomUUID() (available in all modern browsers)
  const uuidProvider =
    (typeof window !== 'undefined' && window.crypto?.randomUUID) ||
    (typeof cryptoModule !== 'undefined' && cryptoModule?.randomUUID);

  if (typeof uuidProvider === 'function') {
    const raw = (uuidProvider.call(window.crypto || cryptoModule) + uuidProvider.call(window.crypto || cryptoModule))
      .replace(/-/g, '')
      .toLowerCase();
    return raw.substring(0, byteLength * 2);
  }

  throw new Error('Cryptographically secure random number generator is not available in this environment.');
};
