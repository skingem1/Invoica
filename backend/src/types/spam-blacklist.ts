/**
 * Spam Blacklist Utilities
 * Simple domain validation against hardcoded blacklist
 */

const SPAM_BLACKLIST = [
  'temp-mail.org',
  'guerrillamail.com',
  '10minutemail.com',
] as const;

/**
 * Validates if the given email domain is in the spam blacklist.
 * @param email - The email address to validate
 * @returns true if domain is blacklisted, false otherwise
 */
export function validateEmailDomain(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) {
    return false;
  }
  return SPAM_BLACKLIST.includes(domain as typeof SPAM_BLACKLIST[number]);
}