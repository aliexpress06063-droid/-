import crypto from 'crypto';
import express from 'express';

// ==========================================
// 1. Cryptographic Security Helpers
// ==========================================

const PBKDF2_ITERATIONS = 150000;
const PBKDF2_KEYLEN = 64;
const PBKDF2_DIGEST = 'sha512';

/**
 * Hashes a password using PBKDF2-SHA512 with a cryptographically secure 32-byte random salt.
 */
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const finalSalt = salt || crypto.randomBytes(32).toString('hex');
  const hashBuffer = crypto.pbkdf2Sync(password, finalSalt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST);
  return {
    hash: hashBuffer.toString('hex'),
    salt: finalSalt,
  };
}

/**
 * Constant-time password verification using timingSafeEqual to prevent timing attacks.
 */
export function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  try {
    const computedHashBuffer = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST);
    const storedHashBuffer = Buffer.from(storedHash, 'hex');

    if (computedHashBuffer.length !== storedHashBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(computedHashBuffer, storedHashBuffer);
  } catch (err) {
    return false;
  }
}

/**
 * Generates a cryptographically secure 6-digit verification code.
 */
export function generateSecureCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Hashes a 6-digit verification code with user's salt so plaintext code is NOT stored in DB.
 */
export function hashVerificationCode(code: string, salt: string): string {
  return crypto.createHash('sha256').update(code.trim() + salt).digest('hex');
}

/**
 * Constant-time comparison of verification code hash.
 */
export function verifyVerificationCode(inputCode: string, storedHash: string, salt: string): boolean {
  try {
    const inputHash = hashVerificationCode(inputCode, salt);
    const inputBuffer = Buffer.from(inputHash, 'hex');
    const storedBuffer = Buffer.from(storedHash, 'hex');
    if (inputBuffer.length !== storedBuffer.length) return false;
    return crypto.timingSafeEqual(inputBuffer, storedBuffer);
  } catch {
    return false;
  }
}

/**
 * Generates a 256-bit cryptographically secure token.
 */
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hashes a reset token for secure storage.
 */
export function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * Constant-time comparison for reset tokens.
 */
export function verifyResetToken(inputToken: string, storedHash: string): boolean {
  try {
    const inputHash = hashResetToken(inputToken);
    const inputBuffer = Buffer.from(inputHash, 'hex');
    const storedBuffer = Buffer.from(storedHash, 'hex');
    if (inputBuffer.length !== storedBuffer.length) return false;
    return crypto.timingSafeEqual(inputBuffer, storedBuffer);
  } catch {
    return false;
  }
}

// ==========================================
// 2. Input Validation & Sanitization (XSS / Injection / Path Traversal)
// ==========================================

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function isValidEmail(email: unknown): boolean {
  if (typeof email !== 'string') return false;
  if (email.length > 254) return false;
  return EMAIL_REGEX.test(email.trim());
}

export function isValidDateString(dateStr: unknown): boolean {
  if (typeof dateStr !== 'string') return false;
  if (!DATE_REGEX.test(dateStr)) return false;
  const parts = dateStr.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (y < 1970 || y > 2100) return false;
  if (m < 1 || m > 12) return false;
  const daysInMonth = new Date(y, m, 0).getDate();
  return d >= 1 && d <= daysInMonth;
}

/**
 * Sanitizes user-provided text (notes, titles) by escaping HTML characters to prevent XSS.
 */
export function sanitizeText(text: unknown, maxLength: number = 5000): string {
  if (typeof text !== 'string') return '';
  const trimmed = text.slice(0, maxLength);
  return trimmed
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// ==========================================
// 3. Multi-tier In-Memory Rate Limiter (Brute-Force & Denial-of-Service Defense)
// ==========================================

interface RateLimitEntry {
  count: number;
  firstAttemptAt: number;
  blockedUntil?: number;
}

export class InMemoryRateLimiter {
  private records: Map<string, RateLimitEntry> = new Map();
  private maxAttempts: number;
  private windowMs: number;
  private blockDurationMs: number;

  constructor(maxAttempts: number, windowMs: number, blockDurationMs: number = windowMs) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
    this.blockDurationMs = blockDurationMs;

    // Periodic garbage collection every 10 minutes (unref'd so it doesn't block process exit)
    const timer = setInterval(() => this.cleanup(), 10 * 60 * 1000);
    if (timer.unref) timer.unref();
  }

  public check(key: string): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
    const now = Date.now();
    const entry = this.records.get(key);

    if (!entry) {
      this.records.set(key, { count: 1, firstAttemptAt: now });
      return { allowed: true, remaining: this.maxAttempts - 1, retryAfterSeconds: 0 };
    }

    // Check if currently blocked
    if (entry.blockedUntil && entry.blockedUntil > now) {
      const retryAfterSeconds = Math.ceil((entry.blockedUntil - now) / 1000);
      return { allowed: false, remaining: 0, retryAfterSeconds };
    }

    // Check if window expired
    if (now - entry.firstAttemptAt > this.windowMs) {
      this.records.set(key, { count: 1, firstAttemptAt: now });
      return { allowed: true, remaining: this.maxAttempts - 1, retryAfterSeconds: 0 };
    }

    // Within window
    entry.count += 1;
    if (entry.count > this.maxAttempts) {
      entry.blockedUntil = now + this.blockDurationMs;
      const retryAfterSeconds = Math.ceil(this.blockDurationMs / 1000);
      return { allowed: false, remaining: 0, retryAfterSeconds };
    }

    return { allowed: true, remaining: this.maxAttempts - entry.count, retryAfterSeconds: 0 };
  }

  public reset(key: string): void {
    this.records.delete(key);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.records.entries()) {
      if (now - entry.firstAttemptAt > this.windowMs && (!entry.blockedUntil || entry.blockedUntil < now)) {
        this.records.delete(key);
      }
    }
  }
}

// Global & Endpoint-Specific Limiters
export const loginRateLimiter = new InMemoryRateLimiter(5, 15 * 60 * 1000, 15 * 60 * 1000); // 5 attempts per 15 mins
export const verifyCodeRateLimiter = new InMemoryRateLimiter(5, 15 * 60 * 1000, 15 * 60 * 1000); // 5 code attempts
export const resendCodeRateLimiter = new InMemoryRateLimiter(1, 60 * 1000, 60 * 1000); // 1 request per 60s
export const forgotPasswordRateLimiter = new InMemoryRateLimiter(3, 15 * 60 * 1000, 15 * 60 * 1000); // 3 requests per 15 mins
export const globalApiRateLimiter = new InMemoryRateLimiter(300, 60 * 1000, 60 * 1000); // 300 general requests / min

// ==========================================
// 4. Security Audit Trail (سجل الأمان الداخلي)
// ==========================================

export interface SecurityLogEntry {
  id: string;
  timestamp: string;
  ip: string;
  eventType:
    | 'LOGIN_SUCCESS'
    | 'LOGIN_FAILURE'
    | 'LOGIN_LOCKED'
    | 'REGISTER_SUCCESS'
    | 'REGISTER_DUPLICATE_ATTEMPT'
    | 'VERIFY_SUCCESS'
    | 'VERIFY_FAILED'
    | 'VERIFY_LOCKED'
    | 'PASSWORD_RESET_REQUEST'
    | 'PASSWORD_RESET_SUCCESS'
    | 'PASSWORD_RESET_FAILED'
    | 'IDOR_ATTEMPT_BLOCKED'
    | 'RATE_LIMIT_EXCEEDED'
    | 'UNAUTHORIZED_ACCESS'
    | 'SESSION_LOGOUT';
  userId?: string;
  email?: string;
  details?: string;
  status: 'SUCCESS' | 'FAILURE' | 'BLOCKED';
}

export function getClientIp(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

// ==========================================
// 5. Security Headers Middleware
// ==========================================

export function securityHeadersMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Clickjacking defense
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  // Enable XSS filter
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Enforce HTTPS
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self' 'unsafe-inline' 'unsafe-eval' https: data: blob:; font-src 'self' https: data:;"
  );

  next();
}
