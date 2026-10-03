/**
 * Admin Security Configuration
 * 
 * IMPORTANT SECURITY RULES:
 * 1. Selecting "Admin" on the signup UI DOES NOT grant administrator privileges.
 * 2. Admin authorization MUST be validated against the authorized email allowlist / Firestore verified role.
 * 3. Never trust client-submitted role fields or localStorage values.
 * 4. In Part 5, the Flask backend + Firebase Admin SDK will perform strict server-side claims enforcement.
 */

// Authorized Admin Email Allowlist
// Users with these verified emails will receive the verified 'admin' role in their Firestore profile.
export const AUTHORIZED_ADMIN_EMAILS = [
  'admin@unsaid.org',
  'lead@unsaid.org',
  'admin@unsaid.platform',
  'sriyagowraj201@gmail.com',
];


/**
 * Validates whether an email is permitted to assume administrative privileges.
 * @param {string} email
 * @returns {boolean}
 */
export const isAuthorizedAdminEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  return AUTHORIZED_ADMIN_EMAILS.includes(email.trim().toLowerCase());
};
