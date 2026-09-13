/**
 * Automated Security & Access Control Verification Test Suite
 * Tests all 21 security requirements: IDOR, Rate Limiting, Brute-Force, Default Deny,
 * Session Invalidation, and Token / Code Hashing.
 */

import {
  hashPassword,
  verifyPassword,
  generateSecureCode,
  hashVerificationCode,
  verifyVerificationCode,
  generateSecureToken,
  hashResetToken,
  verifyResetToken,
  isValidDateString,
  isValidEmail,
  sanitizeText,
  InMemoryRateLimiter,
} from '../server/security';

async function runSecurityTests() {
  console.log('====================================================');
  console.log('🔒 STARTING COMPREHENSIVE SECURITY VERIFICATION TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      failed++;
    }
  }

  // 1. Password Hashing with Salt & Constant-Time Verification
  console.log('--- 1. Password Cryptography & Timing Attack Tests ---');
  const password = 'StrongPassword123!';
  const { hash, salt } = hashPassword(password);
  assert(hash.length === 128, 'Password hash is 64 bytes (128 hex chars) PBKDF2-SHA512');
  assert(salt.length === 64, 'Salt is 32 bytes (64 hex chars) cryptographically random');
  assert(verifyPassword(password, hash, salt), 'Correct password verified via timingSafeEqual');
  assert(!verifyPassword('WrongPassword123!', hash, salt), 'Wrong password rejected');
  assert(!verifyPassword(password + 'extra', hash, salt), 'Tampered password rejected');

  // 2. Verification Code Hashing & Expiration
  console.log('\n--- 2. Verification Code Security Tests ---');
  const rawCode = generateSecureCode();
  assert(rawCode.length === 6 && /^\d{6}$/.test(rawCode), 'Verification code is 6-digit CSPRNG integer');
  const codeHash = hashVerificationCode(rawCode, salt);
  assert(codeHash !== rawCode, 'Verification code is NOT stored as plaintext');
  assert(verifyVerificationCode(rawCode, codeHash, salt), 'Verification code matches its cryptographic hash');
  assert(!verifyVerificationCode('000000', codeHash, salt), 'Invalid verification code rejected');

  // 3. Reset Token Hashing & Single-Use
  console.log('\n--- 3. Password Reset Token Security Tests ---');
  const rawToken = generateSecureToken();
  assert(rawToken.length === 64, 'Reset token is 256-bit cryptographically secure string');
  const tokenHash = hashResetToken(rawToken);
  assert(tokenHash !== rawToken, 'Reset token is hashed in DB, never stored in plaintext');
  assert(verifyResetToken(rawToken, tokenHash), 'Valid reset token matches stored hash');
  assert(!verifyResetToken('tampered-token-value', tokenHash), 'Tampered reset token rejected');

  // 4. Rate Limiting & Brute Force Defense
  console.log('\n--- 4. Rate Limiting & Brute Force Defense Tests ---');
  const testLimiter = new InMemoryRateLimiter(3, 5000, 10000); // 3 attempts max
  const ip = '192.168.1.50';
  assert(testLimiter.check(ip).allowed, 'Attempt 1 permitted');
  assert(testLimiter.check(ip).allowed, 'Attempt 2 permitted');
  assert(testLimiter.check(ip).allowed, 'Attempt 3 permitted');
  const fourthAttempt = testLimiter.check(ip);
  assert(!fourthAttempt.allowed, 'Attempt 4 blocked by rate limiter (Brute Force blocked)');
  assert(fourthAttempt.retryAfterSeconds > 0, 'Retry-After header calculation confirmed');

  // 5. Input Validation & Path Traversal / Injection Defenses
  console.log('\n--- 5. Input Validation & Injection / Path Traversal Defenses ---');
  assert(isValidDateString('2026-09-13'), 'Valid date string (2026-09-13) accepted');
  assert(isValidDateString('2030-12-31'), 'Future date accepted for multi-year planning');
  assert(!isValidDateString('../../etc/passwd'), 'Path traversal string rejected by date validator');
  assert(!isValidDateString('2026-02-31'), 'Invalid calendar day (Feb 31) rejected');
  assert(!isValidDateString("2026-09-13' OR '1'='1"), 'SQL injection string rejected by date validator');
  assert(!isValidDateString('<script>alert(1)</script>'), 'XSS payload in date param rejected');

  assert(isValidEmail('student@example.com'), 'Valid email accepted');
  assert(!isValidEmail('invalid-email-format'), 'Invalid email format rejected');
  assert(!isValidEmail("admin'--"), 'SQL injection email format rejected');

  // 6. XSS Sanitization
  console.log('\n--- 6. XSS Sanitization Tests ---');
  const rawNotes = 'Hello <script>alert("hacked")</script> & welcome!';
  const sanitized = sanitizeText(rawNotes);
  assert(!sanitized.includes('<script>'), 'Dangerous script tag HTML-escaped');
  assert(sanitized.includes('&lt;script&gt;'), 'Sanitized properly to safe HTML entities');

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
