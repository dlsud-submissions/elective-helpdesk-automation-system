const secretPatterns: RegExp[] = [
  // "password: hunter2", "my password is hunter2", "pwd=..."
  /\b(pass(word)?|pwd|passcode)\b\s*(is|:|=)\s*\S{4,}/i,
  // One-time codes and PINs: "code is 123456", "OTP: 4821"
  /\b(otp|mfa code|verification code|one[- ]time code|pin)\b\s*(is|:|=)?\s*\d{4,8}\b/i,
  // Common API key and token formats.
  /\bAIza[0-9A-Za-z_-]{20,}\b/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\bsb_(secret|publishable)_[A-Za-z0-9_-]{10,}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];

/** Heuristic check that warns before a password, code, or key is sent. */
export function looksLikeSecret(text: string): boolean {
  return secretPatterns.some((pattern) => pattern.test(text));
}
