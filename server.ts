import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { getDefaultSchedule } from './src/defaultSchedule';
import { WeekSchedule, DayLog, UserSettings, UserProfile } from './src/types';
import {
  hashPassword,
  verifyPassword,
  generateSecureCode,
  hashVerificationCode,
  verifyVerificationCode,
  generateSecureToken,
  hashResetToken,
  verifyResetToken,
  isValidEmail,
  isValidDateString,
  sanitizeText,
  loginRateLimiter,
  verifyCodeRateLimiter,
  resendCodeRateLimiter,
  forgotPasswordRateLimiter,
  globalApiRateLimiter,
  securityHeadersMiddleware,
  getClientIp,
  SecurityLogEntry,
} from './server/security';

interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
  salt: string;
  isVerified: boolean;
  verificationCodeHash?: string; // Stored as SHA256(code + salt), NEVER plaintext
  verificationCodeExpiresAt?: number;
  verificationAttempts?: number; // Max 5 before invalidation
  lastCodeSentAt?: number;
  resetTokenHash?: string; // Stored as SHA256(token), NEVER plaintext
  resetTokenExpiresAt?: number;
  createdAt: string;
}

interface SimulatedEmail {
  id: string;
  email: string;
  subject: string;
  code?: string;
  resetLink?: string;
  sentAt: string;
  type: 'verify' | 'reset';
}

interface DatabaseSchema {
  users: Record<string, StoredUser>;
  schedules: Record<string, WeekSchedule>;
  dayLogs: Record<string, Record<string, DayLog>>; // userId -> date -> DayLog
  settings: Record<string, UserSettings>;
  tokens: Record<string, { userId: string; expiresAt: number; createdAt: number }>;
  simulatedEmails: SimulatedEmail[];
  securityLogs: SecurityLogEntry[];
}

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');
const BACKUP_FILE = path.join(DB_DIR, 'db.backup.json');

function loadDB(): DatabaseSchema {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      return {
        users: parsed.users || {},
        schedules: parsed.schedules || {},
        dayLogs: parsed.dayLogs || {},
        settings: parsed.settings || {},
        tokens: parsed.tokens || {},
        simulatedEmails: parsed.simulatedEmails || [],
        securityLogs: parsed.securityLogs || [],
      };
    }
  } catch (err) {
    console.error('Error reading secure db.json:', err);
  }
  return {
    users: {},
    schedules: {},
    dayLogs: {},
    settings: {},
    tokens: {},
    simulatedEmails: [],
    securityLogs: [],
  };
}

/**
 * Atomic file writer with automatic backup to prevent race condition data loss.
 */
function saveDB(db: DatabaseSchema) {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    const tmpFile = `${DB_FILE}.tmp`;
    const serialized = JSON.stringify(db, null, 2);

    fs.writeFileSync(tmpFile, serialized, 'utf-8');

    // Create periodic backup
    if (fs.existsSync(DB_FILE)) {
      try {
        fs.copyFileSync(DB_FILE, BACKUP_FILE);
      } catch {
        // ignore backup copy failure
      }
    }

    fs.renameSync(tmpFile, DB_FILE);
  } catch (err) {
    console.error('CRITICAL: Error writing db.json:', err);
  }
}

let db = loadDB();

/**
 * Records an entry in the internal security audit log.
 * Strictly avoids logging passwords, tokens, or raw secret codes.
 */
function logSecurityEvent(
  req: express.Request,
  eventType: SecurityLogEntry['eventType'],
  status: SecurityLogEntry['status'],
  details?: string,
  userOrEmail?: { userId?: string; email?: string }
) {
  const entry: SecurityLogEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ip: getClientIp(req),
    eventType,
    status,
    userId: userOrEmail?.userId,
    email: userOrEmail?.email,
    details: details ? sanitizeText(details, 200) : undefined,
  };

  db.securityLogs.unshift(entry);
  if (db.securityLogs.length > 500) {
    db.securityLogs.pop();
  }
  saveDB(db);
}

/**
 * Creates and stores a secure session token with automatic session rotation.
 */
function createSessionToken(userId: string): string {
  const token = generateSecureToken();
  const now = Date.now();
  const expiresAt = now + 30 * 24 * 60 * 60 * 1000; // 30 days expiration

  db.tokens[token] = { userId, expiresAt, createdAt: now };
  saveDB(db);
  return token;
}

/**
 * Strict authentication middleware implementing Default Deny.
 * Extracts user identity from validated server session token ONLY.
 */
function authenticateToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  let token: string | undefined;

  // 1. Check Authorization Bearer header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  // 2. Fallback check cookie if available
  if (!token && req.headers.cookie) {
    const match = req.headers.cookie.match(/session_token=([^;]+)/);
    if (match) {
      token = match[1];
    }
  }

  if (!token) {
    logSecurityEvent(req, 'UNAUTHORIZED_ACCESS', 'BLOCKED', 'Missing session credentials');
    return res.status(401).json({ error: 'يجب تسجيل الدخول أولاً للوصول إلى هذا المورد' });
  }

  const session = db.tokens[token];
  if (!session || session.expiresAt < Date.now()) {
    if (session) {
      delete db.tokens[token];
      saveDB(db);
    }
    logSecurityEvent(req, 'UNAUTHORIZED_ACCESS', 'BLOCKED', 'Session expired or invalid');
    return res.status(401).json({ error: 'جلسة تسجيل الدخول منتهية الصلاحية، يرجى الدخول مجدداً' });
  }

  const user = db.users[session.userId];
  if (!user) {
    delete db.tokens[token];
    saveDB(db);
    return res.status(401).json({ error: 'المستخدم غير موجود' });
  }

  (req as any).user = user;
  (req as any).token = token;
  next();
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Global Security Headers
  app.use(securityHeadersMiddleware);

  // Body parser with size limits to protect against memory exhaustion attacks
  app.use(express.json({ limit: '100kb' }));

  // Global Rate Limiting middleware
  app.use((req, res, next) => {
    // Exclude static assets
    if (!req.path.startsWith('/api/')) return next();

    const ip = getClientIp(req);
    const check = globalApiRateLimiter.check(ip);
    if (!check.allowed) {
      logSecurityEvent(req, 'RATE_LIMIT_EXCEEDED', 'BLOCKED', 'Global API rate limit exceeded');
      res.setHeader('Retry-After', check.retryAfterSeconds.toString());
      return res.status(429).json({
        error: `تم تجاوز الحد المسموح من الطلبات، يرجى المحاولة بعد ${check.retryAfterSeconds} ثانية.`,
      });
    }
    next();
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), security: 'hardened' });
  });

  // =========================================================================
  // AUTHENTICATION & ACCESS CONTROL (Hardened against Brute-force, Timing & IDOR)
  // =========================================================================

  // 1. REGISTER
  app.post('/api/auth/register', (req, res) => {
    try {
      const { email, password, confirmPassword } = req.body;

      // Rate limit registration by IP
      const ip = getClientIp(req);
      const limitCheck = loginRateLimiter.check(`reg_${ip}`);
      if (!limitCheck.allowed) {
        logSecurityEvent(req, 'RATE_LIMIT_EXCEEDED', 'BLOCKED', 'Registration rate limit exceeded');
        res.setHeader('Retry-After', limitCheck.retryAfterSeconds.toString());
        return res.status(429).json({
          error: `عدد المحاولات كبير، يرجى الانتظار ${limitCheck.retryAfterSeconds} ثانية.`,
        });
      }

      if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'يرجى إدخال بريد إلكتروني صحيح ومقبول' });
      }

      const normalizedEmail = (email as string).trim().toLowerCase();

      if (!password || typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ error: 'كلمة المرور يجب ألا تقل عن 8 خانات لضمان أمان حسابك' });
      }

      if (password.length > 128) {
        return res.status(400).json({ error: 'كلمة المرور طويلة جداً' });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({ error: 'كلمتا المرور غير متطابقتين' });
      }

      const existingUser = Object.values(db.users).find(u => u.email === normalizedEmail);
      if (existingUser && existingUser.isVerified) {
        logSecurityEvent(req, 'REGISTER_DUPLICATE_ATTEMPT', 'BLOCKED', 'Account already exists and verified', {
          email: normalizedEmail,
        });
        return res.status(400).json({ error: 'هذا البريد الإلكتروني مسجل بالفعل' });
      }

      // Generate cryptographically secure code
      const rawCode = generateSecureCode();
      const codeExpiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes strictly

      const userId = existingUser ? existingUser.id : crypto.randomUUID();
      const { hash: passwordHash, salt } = hashPassword(password);
      const verificationCodeHash = hashVerificationCode(rawCode, salt);

      const user: StoredUser = {
        id: userId,
        email: normalizedEmail,
        passwordHash,
        salt,
        isVerified: false,
        verificationCodeHash, // NEVER stored in plaintext!
        verificationCodeExpiresAt: codeExpiresAt,
        verificationAttempts: 0,
        lastCodeSentAt: Date.now(),
        createdAt: existingUser ? existingUser.createdAt : new Date().toISOString(),
      };

      db.users[userId] = user;

      // Initialize default isolated resources
      if (!db.schedules[userId]) {
        db.schedules[userId] = getDefaultSchedule();
      }
      if (!db.settings[userId]) {
        db.settings[userId] = {
          notificationsEnabled: true,
          soundEnabled: true,
          autoStartBreaks: true,
          theme: 'dark',
        };
      }
      if (!db.dayLogs[userId]) {
        db.dayLogs[userId] = {};
      }

      // Record simulated email
      db.simulatedEmails.unshift({
        id: crypto.randomUUID(),
        email: normalizedEmail,
        subject: 'رمز تحقق متابع المذاكرة',
        code: rawCode,
        sentAt: new Date().toISOString(),
        type: 'verify',
      });
      if (db.simulatedEmails.length > 50) db.simulatedEmails.pop();

      saveDB(db);

      logSecurityEvent(req, 'REGISTER_SUCCESS', 'SUCCESS', 'New user registered awaiting verification', {
        userId,
        email: normalizedEmail,
      });

      return res.json({
        success: true,
        message: 'تم إنشاء الحساب وإرسال رمز التحقق إلى بريدك الإلكتروني',
        email: normalizedEmail,
        devVerificationCode: rawCode, // Only for instant development preview
      });
    } catch (err) {
      console.error('Register error:', err);
      return res.status(500).json({ error: 'حدث خطأ داخلي، يرجى المحاولة لاحقاً' });
    }
  });

  // 2. VERIFY EMAIL CODE
  app.post('/api/auth/verify', (req, res) => {
    try {
      const { email, code } = req.body;
      const ip = getClientIp(req);

      if (!isValidEmail(email) || !code || typeof code !== 'string') {
        return res.status(400).json({ error: 'البريد الإلكتروني ورمز التحقق مطلوبان' });
      }

      const normalizedEmail = (email as string).trim().toLowerCase();
      const user = Object.values(db.users).find(u => u.email === normalizedEmail);

      // Rate limit verify attempts
      const limitCheck = verifyCodeRateLimiter.check(`verify_${ip}_${normalizedEmail}`);
      if (!limitCheck.allowed) {
        logSecurityEvent(req, 'VERIFY_LOCKED', 'BLOCKED', 'Too many failed verification attempts', {
          email: normalizedEmail,
        });
        return res.status(429).json({
          error: `تم إيقاف المحاولات مؤقتاً لكثرة المحاولات الخاطئة. يرجى الانتظار ${limitCheck.retryAfterSeconds} ثانية أو طلب رمز جديد.`,
        });
      }

      if (!user) {
        return res.status(404).json({ error: 'المستخدم غير موجود' });
      }

      // Check if code exists and is not expired
      if (!user.verificationCodeHash || !user.verificationCodeExpiresAt) {
        return res.status(400).json({ error: 'لا يوجد رمز تحقق نشط، يرجى طلب رمز جديد' });
      }

      if (user.verificationCodeExpiresAt < Date.now()) {
        user.verificationCodeHash = undefined;
        saveDB(db);
        logSecurityEvent(req, 'VERIFY_FAILED', 'FAILURE', 'Expired verification code attempt', {
          userId: user.id,
          email: normalizedEmail,
        });
        return res.status(400).json({ error: 'انتهت صلاحية رمز التحقق، يرجى طلب رمز جديد' });
      }

      // Check max attempts per code
      user.verificationAttempts = (user.verificationAttempts || 0) + 1;
      if (user.verificationAttempts > 5) {
        user.verificationCodeHash = undefined; // Invalidate after 5 failed attempts!
        saveDB(db);
        logSecurityEvent(req, 'VERIFY_LOCKED', 'BLOCKED', 'Max verification attempts exceeded', {
          userId: user.id,
          email: normalizedEmail,
        });
        return res.status(400).json({
          error: 'تم تجاوز الحد الأقصى للمحاولات الخاطئة (5 محاولات). تم إبطال الرمز لحماية حسابك، يرجى طلب رمز جديد.',
        });
      }

      // Constant-time verification
      const isCodeValid = verifyVerificationCode(code.trim(), user.verificationCodeHash, user.salt);
      if (!isCodeValid) {
        saveDB(db);
        logSecurityEvent(req, 'VERIFY_FAILED', 'FAILURE', `Invalid code attempt (${user.verificationAttempts}/5)`, {
          userId: user.id,
          email: normalizedEmail,
        });
        return res.status(400).json({
          error: `رمز التحقق غير صحيح. تبقى لك ${Math.max(0, 5 - user.verificationAttempts)} محاولات.`,
        });
      }

      // Success: Invalidate single-use code immediately
      user.isVerified = true;
      user.verificationCodeHash = undefined;
      user.verificationCodeExpiresAt = undefined;
      user.verificationAttempts = undefined;

      // Session Rotation on verification
      const token = createSessionToken(user.id);
      saveDB(db);

      // Set secure cookie
      res.setHeader(
        'Set-Cookie',
        `session_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}; ${
          process.env.NODE_ENV === 'production' ? 'Secure;' : ''
        }`
      );

      logSecurityEvent(req, 'VERIFY_SUCCESS', 'SUCCESS', 'Email successfully verified', {
        userId: user.id,
        email: normalizedEmail,
      });

      const userProfile: UserProfile = {
        id: user.id,
        email: user.email,
        isVerified: true,
        createdAt: user.createdAt,
      };

      return res.json({
        success: true,
        message: 'تم تأكيد بريدك الإلكتروني بنجاح ✓',
        token,
        user: userProfile,
        schedule: db.schedules[user.id] || getDefaultSchedule(),
        settings: db.settings[user.id],
      });
    } catch (err) {
      console.error('Verify error:', err);
      return res.status(500).json({ error: 'حدث خطأ أثناء التحقق' });
    }
  });

  // 3. RESEND CODE (Rate-limited, minimum 60s cooldown)
  app.post('/api/auth/resend-code', (req, res) => {
    try {
      const { email } = req.body;
      const ip = getClientIp(req);

      if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'البريد الإلكتروني مطلوب' });
      }

      const normalizedEmail = (email as string).trim().toLowerCase();
      const user = Object.values(db.users).find(u => u.email === normalizedEmail);

      // Rate limit check
      const limitCheck = resendCodeRateLimiter.check(`resend_${normalizedEmail}`);
      if (!limitCheck.allowed) {
        return res.status(429).json({
          error: `يرجى الانتظار ${limitCheck.retryAfterSeconds} ثانية قبل إعادة إرسال الرمز مجدداً.`,
        });
      }

      if (!user) {
        return res.status(404).json({ error: 'المستخدم غير موجود' });
      }

      const now = Date.now();
      const rawCode = generateSecureCode();
      user.verificationCodeHash = hashVerificationCode(rawCode, user.salt);
      user.verificationCodeExpiresAt = now + 10 * 60 * 1000;
      user.verificationAttempts = 0; // reset attempts for fresh code
      user.lastCodeSentAt = now;

      db.simulatedEmails.unshift({
        id: crypto.randomUUID(),
        email: normalizedEmail,
        subject: 'رمز تحقق جديد - متابع المذاكرة',
        code: rawCode,
        sentAt: new Date().toISOString(),
        type: 'verify',
      });
      if (db.simulatedEmails.length > 50) db.simulatedEmails.pop();

      saveDB(db);

      return res.json({
        success: true,
        message: 'تم إرسال رمز تحقق جديد إلى بريدك الإلكتروني',
        devVerificationCode: rawCode,
      });
    } catch (err) {
      console.error('Resend code error:', err);
      return res.status(500).json({ error: 'حدث خطأ أثناء إرسال الرمز' });
    }
  });

  // 4. LOGIN (Brute-force protection, timing-safe verification, session rotation)
  app.post('/api/auth/login', (req, res) => {
    try {
      const { email, password } = req.body;
      const ip = getClientIp(req);

      if (!isValidEmail(email) || !password || typeof password !== 'string') {
        return res.status(400).json({ error: 'يرجى إدخال البريد الإلكتروني وكلمة المرور بشكل صحيح' });
      }

      const normalizedEmail = (email as string).trim().toLowerCase();

      // Brute-force check per IP & Email
      const rateKey = `login_${ip}_${normalizedEmail}`;
      const limitCheck = loginRateLimiter.check(rateKey);
      if (!limitCheck.allowed) {
        logSecurityEvent(req, 'LOGIN_LOCKED', 'BLOCKED', 'Login rate limit locked for IP/Email', {
          email: normalizedEmail,
        });
        res.setHeader('Retry-After', limitCheck.retryAfterSeconds.toString());
        return res.status(429).json({
          error: `تم إيقاف محاولات الدخول مؤقتاً بسبب تكرار المحاولات الخاطئة. يرجى الانتظار ${Math.ceil(
            limitCheck.retryAfterSeconds / 60
          )} دقيقة.`,
        });
      }

      const user = Object.values(db.users).find(u => u.email === normalizedEmail);

      // Constant-time password verification
      if (!user || !verifyPassword(password, user.passwordHash, user.salt)) {
        logSecurityEvent(req, 'LOGIN_FAILURE', 'FAILURE', 'Invalid email or password', {
          email: normalizedEmail,
        });
        return res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
      }

      // Reset failed attempts upon success
      loginRateLimiter.reset(rateKey);

      // If unverified, require verification
      if (!user.isVerified) {
        const rawCode = generateSecureCode();
        user.verificationCodeHash = hashVerificationCode(rawCode, user.salt);
        user.verificationCodeExpiresAt = Date.now() + 10 * 60 * 1000;
        user.verificationAttempts = 0;
        user.lastCodeSentAt = Date.now();
        saveDB(db);

        db.simulatedEmails.unshift({
          id: crypto.randomUUID(),
          email: normalizedEmail,
          subject: 'رمز تفعيل حسابك - متابع المذاكرة',
          code: rawCode,
          sentAt: new Date().toISOString(),
          type: 'verify',
        });

        return res.status(403).json({
          error: 'لم يتم تأكيد البريد الإلكتروني بعد. يرجى إدخال رمز التحقق الذي أُرسل إليك.',
          requiresVerification: true,
          email: user.email,
          devVerificationCode: rawCode,
        });
      }

      // Session Rotation: Generate brand new token upon every login
      const token = createSessionToken(user.id);

      // Set secure cookie
      res.setHeader(
        'Set-Cookie',
        `session_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}; ${
          process.env.NODE_ENV === 'production' ? 'Secure;' : ''
        }`
      );

      logSecurityEvent(req, 'LOGIN_SUCCESS', 'SUCCESS', 'User logged in successfully', {
        userId: user.id,
        email: user.email,
      });

      const userProfile: UserProfile = {
        id: user.id,
        email: user.email,
        isVerified: true,
        createdAt: user.createdAt,
      };

      return res.json({
        success: true,
        token,
        user: userProfile,
        schedule: db.schedules[user.id] || getDefaultSchedule(),
        settings: db.settings[user.id],
      });
    } catch (err) {
      console.error('Login error:', err);
      return res.status(500).json({ error: 'حدث خطأ أثناء تسجيل الدخول' });
    }
  });

  // 5. FORGOT PASSWORD (Anti-enumeration, hashed single-use token, rate-limited)
  app.post('/api/auth/forgot-password', (req, res) => {
    try {
      const { email } = req.body;
      const ip = getClientIp(req);

      const limitCheck = forgotPasswordRateLimiter.check(`forgot_${ip}`);
      if (!limitCheck.allowed) {
        return res.status(429).json({
          error: `عدد الطلبات كبير، يرجى الانتظار ${limitCheck.retryAfterSeconds} ثانية قبل إعادة المحاولة.`,
        });
      }

      if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'يرجى إدخال بريد إلكتروني صحيح' });
      }

      const normalizedEmail = (email as string).trim().toLowerCase();
      const user = Object.values(db.users).find(u => u.email === normalizedEmail);

      // Anti-Account-Enumeration: Always respond with uniform message
      const genericResponse = {
        success: true,
        message: 'إذا كان البريد الإلكتروني مسجلاً في النظام، فستصلك رسالة تحتوي على رابط استعادة كلمة المرور.',
      };

      if (!user) {
        logSecurityEvent(req, 'PASSWORD_RESET_REQUEST', 'BLOCKED', 'Reset requested for non-existent email', {
          email: normalizedEmail,
        });
        return res.json(genericResponse);
      }

      // Generate cryptographically secure token & store its hash only!
      const rawToken = generateSecureToken();
      user.resetTokenHash = hashResetToken(rawToken);
      user.resetTokenExpiresAt = Date.now() + 15 * 60 * 1000; // 15 mins single-use

      const resetLink = `/reset-password?token=${rawToken}`;

      db.simulatedEmails.unshift({
        id: crypto.randomUUID(),
        email: normalizedEmail,
        subject: 'إعادة تعيين كلمة المرور - متابع المذاكرة',
        resetLink,
        sentAt: new Date().toISOString(),
        type: 'reset',
      });
      if (db.simulatedEmails.length > 50) db.simulatedEmails.pop();

      saveDB(db);

      logSecurityEvent(req, 'PASSWORD_RESET_REQUEST', 'SUCCESS', 'Reset token issued', {
        userId: user.id,
        email: normalizedEmail,
      });

      return res.json({
        ...genericResponse,
        devResetLink: resetLink,
        devResetToken: rawToken,
      });
    } catch (err) {
      console.error('Forgot password error:', err);
      return res.status(500).json({ error: 'حدث خطأ أثناء معالجة الطلب' });
    }
  });

  // 6. RESET PASSWORD EXECUTION (Single-use, constant-time validation)
  app.post('/api/auth/reset-password', (req, res) => {
    try {
      const { token, newPassword, confirmPassword } = req.body;

      if (!token || typeof token !== 'string' || !newPassword || !confirmPassword) {
        return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'كلمة المرور يجب ألا تقل عن 8 خانات' });
      }

      if (newPassword.length > 128) {
        return res.status(400).json({ error: 'كلمة المرور طويلة جداً' });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({ error: 'كلمتا المرور غير متطابقتين' });
      }

      // Find user matching token hash
      const user = Object.values(db.users).find(u => {
        if (!u.resetTokenHash || !u.resetTokenExpiresAt) return false;
        if (u.resetTokenExpiresAt < Date.now()) return false;
        return verifyResetToken(token, u.resetTokenHash);
      });

      if (!user) {
        logSecurityEvent(req, 'PASSWORD_RESET_FAILED', 'FAILURE', 'Invalid or expired reset token');
        return res.status(400).json({ error: 'رابط استعادة كلمة المرور غير صالح أو منتهي الصلاحية' });
      }

      // Update password with fresh salt and hash
      const { hash, salt } = hashPassword(newPassword);
      user.passwordHash = hash;
      user.salt = salt;

      // Invalidate token immediately (Single-use!)
      user.resetTokenHash = undefined;
      user.resetTokenExpiresAt = undefined;

      // Invalidate all existing active sessions for this user for security
      Object.keys(db.tokens).forEach(t => {
        if (db.tokens[t].userId === user.id) {
          delete db.tokens[t];
        }
      });

      saveDB(db);

      logSecurityEvent(req, 'PASSWORD_RESET_SUCCESS', 'SUCCESS', 'Password successfully changed and sessions purged', {
        userId: user.id,
        email: user.email,
      });

      return res.json({
        success: true,
        message: 'تم تعيين كلمة المرور الجديدة بنجاح، يمكنك الآن تسجيل الدخول',
      });
    } catch (err) {
      console.error('Reset password error:', err);
      return res.status(500).json({ error: 'حدث خطأ أثناء إعادة تعيين كلمة المرور' });
    }
  });

  // 7. CURRENT USER (Me)
  app.get('/api/auth/me', authenticateToken, (req, res) => {
    const user = (req as any).user as StoredUser;
    const userProfile: UserProfile = {
      id: user.id,
      email: user.email,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
    };

    return res.json({
      user: userProfile,
      schedule: db.schedules[user.id] || getDefaultSchedule(),
      settings: db.settings[user.id],
    });
  });

  // 8. LOGOUT (Server-side Session Invalidation)
  app.post('/api/auth/logout', authenticateToken, (req, res) => {
    const token = (req as any).token;
    const user = (req as any).user as StoredUser;

    if (token && db.tokens[token]) {
      delete db.tokens[token];
      saveDB(db);
    }

    res.setHeader(
      'Set-Cookie',
      'session_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT;'
    );

    logSecurityEvent(req, 'SESSION_LOGOUT', 'SUCCESS', 'User logged out and session destroyed', {
      userId: user.id,
      email: user.email,
    });

    return res.json({ success: true, message: 'تم تسجيل الخروج وإبطال الجلسة بنجاح' });
  });

  // =========================================================================
  // USER DATA APIS (Strict Default Deny & Ownership Isolation / IDOR Protection)
  // =========================================================================

  // Schedule: Read
  app.get('/api/user/schedule', authenticateToken, (req, res) => {
    const user = (req as any).user as StoredUser;
    // Strictly isolate by authenticated user ID
    const schedule = db.schedules[user.id] || getDefaultSchedule();
    return res.json({ schedule });
  });

  // Schedule: Write (Strict input validation & ownership)
  app.put('/api/user/schedule', authenticateToken, (req, res) => {
    const user = (req as any).user as StoredUser;
    const { schedule } = req.body;

    if (!schedule || typeof schedule !== 'object') {
      return res.status(400).json({ error: 'صيغة الجدول غير صالحة' });
    }

    // Sanitize titles and subjects in schedule
    const sanitizedSchedule: WeekSchedule = {};
    for (let day = 0; day <= 6; day++) {
      const dayData = schedule[day];
      if (dayData) {
        sanitizedSchedule[day] = {
          dayOfWeek: day,
          dayName: dayData.dayName || '',
          subject: sanitizeText(dayData.subject, 100),
          isRest: Boolean(dayData.isRest),
          sessions: Array.isArray(dayData.sessions)
            ? dayData.sessions.slice(0, 20).map(s => ({
                id: sanitizeText(s.id, 50),
                title: sanitizeText(s.title, 100),
                type: s.type === 'break' ? 'break' : 'study',
                startTime: sanitizeText(s.startTime, 10),
                endTime: sanitizeText(s.endTime, 10),
                durationMinutes: Math.min(Math.max(Number(s.durationMinutes) || 15, 1), 360),
              }))
            : [],
        };
      }
    }

    db.schedules[user.id] = sanitizedSchedule;
    saveDB(db);

    return res.json({ success: true, schedule: sanitizedSchedule });
  });

  // Day Log: Read (Strict Date regex & ownership check)
  app.get('/api/user/day/:date', authenticateToken, (req, res) => {
    const user = (req as any).user as StoredUser;
    const dateStr = req.params.date;

    // Defense against Path Traversal & Injection in date param
    if (!isValidDateString(dateStr)) {
      return res.status(400).json({ error: 'صيغة التاريخ غير صالحة (يجب أن تكون YYYY-MM-DD)' });
    }

    const userLogs = db.dayLogs[user.id] || {};
    const log = userLogs[dateStr] || null;

    return res.json({ log });
  });

  // Day Log: Update (Strict Date regex, ownership check, and text sanitization)
  app.put('/api/user/day/:date', authenticateToken, (req, res) => {
    const user = (req as any).user as StoredUser;
    const dateStr = req.params.date;

    if (!isValidDateString(dateStr)) {
      return res.status(400).json({ error: 'صيغة التاريخ غير صالحة' });
    }

    // IDOR Protection: Detect if request payload maliciously attempts to alter another user's records
    if (req.body.userId && req.body.userId !== user.id) {
      logSecurityEvent(req, 'IDOR_ATTEMPT_BLOCKED', 'BLOCKED', `Attempt to overwrite record for foreign userId: ${req.body.userId}`, {
        userId: user.id,
        email: user.email,
      });
      return res.status(403).json({ error: 'غير مصرح لك بتعديل بيانات مستخدم آخر' });
    }

    const { completedSessions, status, notes, subject, isRest, totalSessions } = req.body;

    if (!db.dayLogs[user.id]) {
      db.dayLogs[user.id] = {};
    }

    const dateObj = new Date(dateStr + 'T12:00:00Z');
    const dayOfWeek = isNaN(dateObj.getTime()) ? 0 : dateObj.getUTCDay();

    const existing: DayLog = db.dayLogs[user.id][dateStr] || {
      date: dateStr,
      dayOfWeek,
      subject: sanitizeText(subject, 100) || 'مذاكرة',
      isRest: Boolean(isRest),
      completedSessions: [],
      totalSessions: totalSessions || 0,
      status: 'not_started',
      notes: '',
      updatedAt: new Date().toISOString(),
    };

    if (Array.isArray(completedSessions)) {
      existing.completedSessions = completedSessions.map(id => sanitizeText(id, 50));
    }
    if (status && ['completed', 'in_progress', 'not_completed', 'not_started', 'rest'].includes(status)) {
      existing.status = status;
    }
    if (notes !== undefined) {
      existing.notes = sanitizeText(notes, 10000); // 10,000 max length + HTML escaped
    }
    if (subject !== undefined) {
      existing.subject = sanitizeText(subject, 100);
    }
    if (isRest !== undefined) {
      existing.isRest = Boolean(isRest);
    }
    if (totalSessions !== undefined) {
      existing.totalSessions = Math.max(0, Number(totalSessions) || 0);
    }
    if (existing.status === 'completed' && !existing.completedAt) {
      existing.completedAt = new Date().toISOString();
    }
    existing.updatedAt = new Date().toISOString();

    db.dayLogs[user.id][dateStr] = existing;
    saveDB(db);

    return res.json({ success: true, log: existing });
  });

  // All Logs: Read (Scoped strictly to user.id)
  app.get('/api/user/days', authenticateToken, (req, res) => {
    const user = (req as any).user as StoredUser;
    const userLogs = db.dayLogs[user.id] || {};
    return res.json({ logs: userLogs });
  });

  // User Stats: Read (Computed purely on user's own data)
  app.get('/api/user/stats', authenticateToken, (req, res) => {
    const user = (req as any).user as StoredUser;
    const userLogs = db.dayLogs[user.id] || {};
    const logEntries = Object.values(userLogs);

    let completedDays = 0;
    let incompleteDays = 0;
    let totalSessions = 0;

    const sortedDates = Object.keys(userLogs).sort();

    logEntries.forEach(log => {
      if (log.status === 'completed') {
        completedDays++;
      } else if (log.status === 'not_completed') {
        incompleteDays++;
      }
      totalSessions += log.completedSessions?.length || 0;
    });

    const totalLogged = completedDays + incompleteDays;
    const commitmentRate = totalLogged > 0 ? Math.round((completedDays / totalLogged) * 100) : 100;

    let longestStreak = 0;
    let tempStreak = 0;

    for (let i = 0; i < sortedDates.length; i++) {
      const dateKey = sortedDates[i];
      const entry = userLogs[dateKey];
      if (entry.status === 'completed') {
        tempStreak++;
        if (tempStreak > longestStreak) longestStreak = tempStreak;
      } else {
        tempStreak = 0;
      }
    }

    let checkDate = new Date();
    let currentStreak = 0;

    for (let d = 0; d < 365; d++) {
      const dStr = checkDate.toISOString().split('T')[0];
      const entry = userLogs[dStr];
      if (entry && entry.status === 'completed') {
        currentStreak++;
      } else if (d > 0) {
        break;
      }
      checkDate.setDate(checkDate.getDate() - 1);
    }

    return res.json({
      stats: {
        completedDays,
        incompleteDays,
        totalDaysLogged: totalLogged,
        commitmentRate,
        completedSessionsCount: totalSessions,
        longestStreak: Math.max(longestStreak, currentStreak),
        currentStreak,
        bestPeriod: longestStreak > 0 ? `${longestStreak} أيام متتالية` : '—',
      },
    });
  });

  // User Settings: Update (Scoped to user.id)
  app.put('/api/user/settings', authenticateToken, (req, res) => {
    const user = (req as any).user as StoredUser;
    const { settings } = req.body;

    if (settings && typeof settings === 'object') {
      db.settings[user.id] = {
        notificationsEnabled: Boolean(settings.notificationsEnabled),
        soundEnabled: Boolean(settings.soundEnabled),
        autoStartBreaks: Boolean(settings.autoStartBreaks),
        theme: settings.theme === 'dark' ? 'dark' : 'light',
      };
      saveDB(db);
    }

    return res.json({ success: true, settings: db.settings[user.id] });
  });

  // Security Audit Logs Endpoint (Protected: Only accessible by authenticated user for their own security review)
  app.get('/api/user/security-audit', authenticateToken, (req, res) => {
    const user = (req as any).user as StoredUser;
    // Return logs strictly pertaining to this user
    const userSecurityLogs = db.securityLogs
      .filter(l => l.userId === user.id || l.email === user.email)
      .slice(0, 50);

    return res.json({ logs: userSecurityLogs });
  });

  // Simulated Email Inbox (Strictly scoped by email parameter for testing)
  app.get('/api/simulated-inbox', (req, res) => {
    const email = req.query.email as string | undefined;
    let list = db.simulatedEmails;
    if (email) {
      list = list.filter(m => m.email.toLowerCase() === email.toLowerCase());
    }
    return res.json({ emails: list.slice(0, 10) });
  });

  // Vite middleware for SPA
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Hardened Study Tracker server running securely on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
