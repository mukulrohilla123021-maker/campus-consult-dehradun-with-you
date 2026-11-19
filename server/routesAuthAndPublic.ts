import type { Express, Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  authRateLimit,
  clearSessionCookie,
  extractSessionFromRequest,
  hashPassword,
  setSessionCookie,
  signSessionToken,
  verifyPassword,
  type UserRole,
} from './auth.ts';
import { db, ensureSuperAdminFromEnv, getPlatformSettings, getSeedEnvStatus, logAudit, STORAGE_UPLOAD_DIR } from './db.ts';
import { createNotification } from './realtime.ts';

const ALLOWED_DOC_MIMES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
]);
const MAX_REG_DOC_BYTES = 5 * 1024 * 1024;

function saveRegistrationDocument(
  ownerId: string,
  category: 'portfolio' | 'certificate',
  fileInput: unknown,
  now: string
): string {
  if (!fileInput || typeof fileInput !== 'object') return '';
  const f = fileInput as Record<string, unknown>;
  const rawName = String(f.fileName || '').trim();
  const mimeType = String(f.mimeType || '').trim();
  const contentBase64 = String(f.contentBase64 || '').trim();
  if (!rawName || !contentBase64) return '';
  if (mimeType && !ALLOWED_DOC_MIMES.has(mimeType)) {
    throw new Error('Unsupported document type. Allowed: PDF, DOCX, PNG, JPG.');
  }
  const buffer = Buffer.from(contentBase64, 'base64');
  if (buffer.length === 0 || buffer.length > MAX_REG_DOC_BYTES) {
    throw new Error('Uploaded document must be between 1 byte and 5 MB.');
  }
  const safeName = path.basename(rawName).replace(/[^a-zA-Z0-9._-]/g, '_');
  const docId = `doc-${crypto.randomUUID()}`;
  const diskName = `${docId}_${safeName}`;
  fs.writeFileSync(path.join(STORAGE_UPLOAD_DIR, diskName), buffer);

  db.prepare(`
    INSERT INTO documents (id, owner_id, project_id, booking_id, category, file_name, mime_type, size_bytes, storage_path, visibility, created_at)
    VALUES (?, ?, NULL, NULL, ?, ?, ?, ?, ?, 'admin', ?)
  `).run(docId, ownerId, category, safeName, mimeType || 'application/pdf', buffer.length, diskName, now);

  return docId;
}

export interface AuthenticatedRequest extends Request {
  auth?: {
    userId: string;
    role: UserRole;
    email: string;
    fullName: string;
    status: string;
    emailVerified: boolean;
  };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const session = extractSessionFromRequest(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }

  const user = db
    .prepare('SELECT id, email, role, full_name, status, email_verified FROM users WHERE id = ?')
    .get(session.userId) as
    | { id: string; email: string; role: UserRole; full_name: string; status: string; email_verified: number }
    | undefined;

  if (!user) {
    clearSessionCookie(res, req);
    res.status(401).json({ error: 'Session no longer valid.' });
    return;
  }

  if (user.status === 'suspended') {
    clearSessionCookie(res, req);
    res.status(403).json({ error: 'Your account has been suspended. Please contact Campus Consult administration.' });
    return;
  }

  req.auth = {
    userId: user.id,
    role: user.role,
    email: user.email,
    fullName: user.full_name,
    status: user.status,
    emailVerified: Boolean(user.email_verified),
  };
  next();
}

export function requireRoles(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!roles.includes(req.auth.role)) {
      res.status(403).json({ error: 'Insufficient permissions for this resource.' });
      return;
    }
    next();
  };
}

function sanitizeUserRecord(userId: string): (Record<string, unknown> & { status: string; role: string; profile: Record<string, unknown> | null }) | null {
  const user = db
    .prepare(
      'SELECT id, email, role, full_name, mobile, status, email_verified, is_demo, notification_prefs_json, created_at, updated_at FROM users WHERE id = ?'
    )
    .get(userId) as (Record<string, unknown> & { status: string; role: string }) | undefined;

  if (!user) return null;

  let profile: Record<string, unknown> | null = null;
  if (user.role === 'customer') {
    profile =
      (db.prepare('SELECT * FROM customer_profiles WHERE user_id = ?').get(userId) as
        | Record<string, unknown>
        | undefined) || null;
  } else if (user.role === 'consultant') {
    profile =
      (db.prepare('SELECT * FROM consultant_profiles WHERE user_id = ?').get(userId) as
        | Record<string, unknown>
        | undefined) || null;
  }

  return { ...user, profile };
}

export function registerAuthAndPublicRoutes(app: Express): void {
  const limitAuth = authRateLimit(35, 60_000);

  // Check if initial Super Admin bootstrap is needed
  app.get('/api/auth/bootstrap-status', (_req, res) => {
    const count = (
      db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'super_admin'").get() as { c: number }
    ).c;
    const settings = getPlatformSettings();
    const envStatus = getSeedEnvStatus();
    res.json({
      needsSuperAdminSetup: count === 0,
      integrations: {
        database: 'sqlite_persistent',
        realtime: 'websocket_active',
        firebaseProvisioned: false,
        seedSuperAdminConfigured: envStatus.seedSuperAdminConfigured,
        sessionSecretConfigured: envStatus.sessionSecretConfigured,
        emailDeliveryConfigured: Boolean(settings.emailDeliveryEnabled),
        razorpayConfigured: Boolean(settings.razorpayEnabled),
        whatsappConfigured: Boolean(settings.whatsappDeliveryEnabled),
      },
    });
  });

  // One-time Super Admin initialisation from backend SEED_SUPERADMIN_EMAIL & SEED_SUPERADMIN_PASSWORD
  app.post('/api/auth/bootstrap-superadmin-env', limitAuth, (_req, res) => {
    const existingCount = (
      db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'super_admin'").get() as { c: number }
    ).c;
    if (existingCount > 0) {
      res.status(403).json({ error: 'Super Admin already initialised. Public bootstrap is permanently locked.' });
      return;
    }

    const result = ensureSuperAdminFromEnv();
    if (!result.ok) {
      res.status(result.alreadyInitialized ? 403 : result.missingEnv ? 400 : 409).json({
        error: result.error || 'Unable to initialise Super Admin from environment variables.',
      });
      return;
    }

    res.status(201).json({
      ok: true,
      email: result.email,
      role: 'super_admin',
      message:
        'First Super Admin account created and verified in the database. Public Super Admin registration is now permanently disabled. Sign in with your configured credentials.',
    });
  });

  // One-time Super Admin initialisation via setup form ONLY when zero super_admin exists
  app.post('/api/auth/bootstrap-superadmin', limitAuth, (req, res) => {
    const existingCount = (
      db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'super_admin'").get() as { c: number }
    ).c;
    if (existingCount > 0) {
      res.status(403).json({ error: 'Super Admin already initialised. Public bootstrap is permanently locked.' });
      return;
    }

    const { fullName, email, mobile, password } = req.body as Record<string, string>;
    if (!fullName?.trim() || !email?.trim() || !email.includes('@') || !mobile?.trim() || !password || password.length < 8) {
      res.status(400).json({ error: 'Valid full name, email, mobile, and 8+ character password are required.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const id = `usr-${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    db.exec('BEGIN IMMEDIATE');
    try {
      const recheck = (
        db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'super_admin'").get() as { c: number }
      ).c;
      if (recheck > 0) {
        db.exec('ROLLBACK');
        res.status(403).json({ error: 'Super Admin already initialised. Public bootstrap is permanently locked.' });
        return;
      }
      const existingEmail = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(cleanEmail);
      if (existingEmail) {
        db.exec('ROLLBACK');
        res.status(409).json({ error: 'An account with this email already exists.' });
        return;
      }

      db.prepare(`
        INSERT INTO users (id, email, password_hash, role, full_name, mobile, status, email_verified, created_at, updated_at)
        VALUES (?, ?, ?, 'super_admin', ?, ?, 'active', 1, ?, ?)
      `).run(id, cleanEmail, hashPassword(password), fullName.trim(), mobile.trim(), now, now);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    logAudit(id, 'super_admin', 'SUPERADMIN_BOOTSTRAPPED', 'user', id, { email: cleanEmail }, req.ip);

    const token = signSessionToken(id, 'super_admin');
    setSessionCookie(res, token, req);
    res.status(201).json({
      ok: true,
      user: sanitizeUserRecord(id),
      sessionToken: token,
      message: 'First Super Admin account created and verified in the database. Public setup is now permanently locked.',
    });
  });

  // Public registration (strictly Customer or Student Consultant — never Admin/Super Admin)
  app.post('/api/auth/register', limitAuth, (req, res) => {
    const body = req.body as Record<string, unknown>;
    const role = body.role === 'consultant' ? 'consultant' : body.role === 'customer' ? 'customer' : null;
    if (!role) {
      res.status(403).json({ error: 'Public registration is strictly limited to Customer and Student Consultant accounts.' });
      return;
    }

    const fullName = String(body.fullName || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const mobile = String(body.mobile || '').trim();
    const password = String(body.password || '');

    if (fullName.length < 2 || !email.includes('@') || mobile.length < 8 || password.length < 8) {
      res.status(400).json({ error: 'Please provide valid name, email, mobile number, and an 8+ character password.' });
      return;
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      res.status(409).json({ error: 'An account with this email is already registered.' });
      return;
    }

    const userId = `usr-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const verificationToken = crypto.randomBytes(16).toString('hex');

    if (role === 'customer') {
      const businessName = String(body.businessName || '').trim();
      const businessCategory = String(body.businessCategory || '').trim();
      const address = String(body.address || '').trim();
      if (!businessName || !businessCategory || !address) {
        res.status(400).json({ error: 'Business name, category, and Dehradun address are required for customer registration.' });
        return;
      }

      db.exec('BEGIN');
      try {
        db.prepare(`
          INSERT INTO users (id, email, password_hash, role, full_name, mobile, status, email_verified, verification_token, created_at, updated_at)
          VALUES (?, ?, ?, 'customer', ?, ?, 'active', 0, ?, ?, ?)
        `).run(userId, email, hashPassword(password), fullName, mobile, verificationToken, now, now);

        db.prepare(`
          INSERT INTO customer_profiles (user_id, business_name, business_category, address, gstin, created_at, updated_at)
          VALUES (?, ?, ?, ?, '', ?, ?)
        `).run(userId, businessName, businessCategory, address, now, now);
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    } else {
      const studentId = String(body.studentId || '').trim();
      const university = String(body.university || '').trim();
      const course = String(body.course || '').trim();
      const qualification = String(body.qualification || course || '').trim();
      const specialisation = String(body.specialisation || '').trim();
      const skillsRaw = Array.isArray(body.skills)
        ? body.skills.map((s) => String(s).trim()).filter(Boolean)
        : String(body.skills || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
      const experience = String(body.experience || '').trim();
      const portfolioUrl = String(body.portfolio || '').trim();
      const certificationsText = String(body.certifications || '').trim();

      if (!university || !course || !specialisation) {
        res.status(400).json({ error: 'University/College, course, and specialisation are required for consultant registration.' });
        return;
      }

      db.exec('BEGIN');
      try {
        db.prepare(`
          INSERT INTO users (id, email, password_hash, role, full_name, mobile, status, email_verified, verification_token, created_at, updated_at)
          VALUES (?, ?, ?, 'consultant', ?, ?, 'active', 0, ?, ?, ?)
        `).run(userId, email, hashPassword(password), fullName, mobile, verificationToken, now, now);

        const resumeDocId = saveRegistrationDocument(userId, 'portfolio', body.resumeFile, now);
        const idDocId = saveRegistrationDocument(userId, 'certificate', body.idDocFile, now);

        db.prepare(`
          INSERT INTO consultant_profiles (
            user_id, student_id, university, course, qualification, specialisation, skills_json, experience,
            portfolio_url, certifications_text, resume_doc_id, id_doc_id, approval_status, availability_status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'available', ?, ?)
        `).run(
          userId,
          studentId,
          university,
          course,
          qualification,
          specialisation,
          JSON.stringify(skillsRaw),
          experience,
          portfolioUrl,
          certificationsText,
          resumeDocId,
          idDocId,
          now,
          now
        );
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        if (err instanceof Error && (err.message.includes('Unsupported document') || err.message.includes('Uploaded document'))) {
          res.status(400).json({ error: err.message });
          return;
        }
        throw err;
      }

      // Notify admins of pending consultant application
      const admins = db
        .prepare("SELECT id FROM users WHERE role IN ('admin', 'super_admin') AND status = 'active'")
        .all() as { id: string }[];
      for (const a of admins) {
        createNotification(
          a.id,
          'consultant_application',
          'New Student Consultant Application',
          `${fullName} (${university} · ${course}) registered and awaits credential verification.`,
          'consultant-verification'
        );
      }
    }

    createNotification(
      userId,
      'registration',
      'Welcome to Campus Consult Dehradun',
      role === 'consultant'
        ? 'Your consultant profile is submitted and pending admin credential verification.'
        : 'Your business account is active. You can browse services and submit bookings.',
      'overview'
    );

    logAudit(userId, role, 'USER_REGISTERED', 'user', userId, { email, role }, req.ip);

    const token = signSessionToken(userId, role);
    setSessionCookie(res, token, req);

    const settings = getPlatformSettings();
    res.status(201).json({
      user: sanitizeUserRecord(userId),
      sessionToken: token,
      emailDeliveryEnabled: Boolean(settings.emailDeliveryEnabled),
      verificationCodePreview: settings.emailDeliveryEnabled ? undefined : verificationToken,
    });
  });

  // Login
  app.post('/api/auth/login', limitAuth, (req, res) => {
    const email = String((req.body as Record<string, unknown>).email || '')
      .trim()
      .toLowerCase();
    const password = String((req.body as Record<string, unknown>).password || '');

    if (!email || !password) {
      res.status(400).json({ error: 'Email address and password are required.' });
      return;
    }

    const user = db
      .prepare('SELECT id, password_hash, role, status FROM users WHERE LOWER(email) = ?')
      .get(email) as { id: string; password_hash: string; role: UserRole; status: string } | undefined;

    if (!user) {
      res.status(401).json({
        error: 'No account is registered with this email address. Please register or initialise Super Admin first.',
      });
      return;
    }

    if (!verifyPassword(password, user.password_hash)) {
      res.status(401).json({
        error: 'Incorrect password. Please check your password or use Forgot password.',
      });
      return;
    }

    if (user.status === 'suspended') {
      res.status(403).json({ error: 'Account suspended. Contact Campus Consult administration.' });
      return;
    }

    const token = signSessionToken(user.id, user.role);
    setSessionCookie(res, token, req);
    logAudit(user.id, user.role, 'USER_LOGIN', 'user', user.id, {}, req.ip);
    res.json({ user: sanitizeUserRecord(user.id), sessionToken: token });
  });

  app.post('/api/auth/logout', (req: AuthenticatedRequest, res) => {
    const session = extractSessionFromRequest(req);
    if (session) {
      logAudit(session.userId, session.role, 'USER_LOGOUT', 'user', session.userId, {}, req.ip);
    }
    clearSessionCookie(res, req);
    res.json({ ok: true });
  });

  app.get('/api/auth/me', (req, res) => {
    const session = extractSessionFromRequest(req);
    if (!session) {
      res.json({ user: null });
      return;
    }
    const user = sanitizeUserRecord(session.userId);
    if (!user || user.status === 'suspended') {
      clearSessionCookie(res, req);
      res.json({ user: null });
      return;
    }
    res.json({ user });
  });

  // Email verification
  app.post('/api/auth/verify-email', (req, res) => {
    const token = String((req.body as Record<string, unknown>).token || '').trim();
    if (!token) {
      res.status(400).json({ error: 'Verification token is required.' });
      return;
    }
    const user = db.prepare('SELECT id, role FROM users WHERE verification_token = ?').get(token) as
      | { id: string; role: string }
      | undefined;
    if (!user) {
      res.status(400).json({ error: 'Invalid or already used verification token.' });
      return;
    }
    db.prepare('UPDATE users SET email_verified = 1, verification_token = NULL, updated_at = ? WHERE id = ?').run(
      new Date().toISOString(),
      user.id
    );
    logAudit(user.id, user.role, 'EMAIL_VERIFIED', 'user', user.id, {}, req.ip);
    res.json({ ok: true, user: sanitizeUserRecord(user.id) });
  });

  // Forgot Password & Reset Password
  app.post('/api/auth/forgot-password', limitAuth, (req, res) => {
    const email = String((req.body as Record<string, unknown>).email || '')
      .trim()
      .toLowerCase();
    if (!email) {
      res.status(400).json({ error: 'Please enter your registered email address.' });
      return;
    }
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: string } | undefined;
    const settings = getPlatformSettings();

    if (!user) {
      res.json({
        ok: true,
        emailDeliveryEnabled: Boolean(settings.emailDeliveryEnabled),
        message: 'If this email is registered, reset instructions have been generated.',
      });
      return;
    }

    const resetToken = crypto.randomBytes(16).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    db.prepare('UPDATE users SET reset_token = ?, reset_expires = ?, updated_at = ? WHERE id = ?').run(
      resetToken,
      expires,
      new Date().toISOString(),
      user.id
    );

    res.json({
      ok: true,
      emailDeliveryEnabled: Boolean(settings.emailDeliveryEnabled),
      message: settings.emailDeliveryEnabled
        ? 'Password reset link sent to your email.'
        : 'External SMTP is not configured in this environment. Use the generated reset token below to complete reset.',
      resetTokenPreview: settings.emailDeliveryEnabled ? undefined : resetToken,
    });
  });

  app.post('/api/auth/reset-password', limitAuth, (req, res) => {
    const token = String((req.body as Record<string, unknown>).token || '').trim();
    const newPassword = String((req.body as Record<string, unknown>).newPassword || '');
    if (!token || newPassword.length < 8) {
      res.status(400).json({ error: 'Valid reset token and 8+ character new password are required.' });
      return;
    }
    const user = db
      .prepare('SELECT id, role, reset_expires FROM users WHERE reset_token = ?')
      .get(token) as { id: string; role: string; reset_expires: string } | undefined;

    if (!user || !user.reset_expires || new Date(user.reset_expires).getTime() < Date.now()) {
      res.status(400).json({ error: 'Reset token is invalid or expired.' });
      return;
    }

    db.prepare(
      'UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL, updated_at = ? WHERE id = ?'
    ).run(hashPassword(newPassword), new Date().toISOString(), user.id);

    logAudit(user.id, user.role, 'PASSWORD_RESET', 'user', user.id, {}, req.ip);
    res.json({ ok: true });
  });

  // Update own profile & password
  app.patch('/api/account/profile', requireAuth, (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const body = req.body as Record<string, unknown>;
    const now = new Date().toISOString();
    const fullName = String(body.fullName || '').trim();
    const mobile = String(body.mobile || '').trim();
    if (fullName.length < 2 || mobile.length < 8) {
      res.status(400).json({ error: 'Full name and valid mobile number are required.' });
      return;
    }

    const notifPrefs =
      body.notificationPrefs && typeof body.notificationPrefs === 'object'
        ? JSON.stringify(body.notificationPrefs)
        : undefined;

    if (notifPrefs) {
      db.prepare(
        'UPDATE users SET full_name = ?, mobile = ?, notification_prefs_json = ?, updated_at = ? WHERE id = ?'
      ).run(fullName, mobile, notifPrefs, now, auth.userId);
    } else {
      db.prepare('UPDATE users SET full_name = ?, mobile = ?, updated_at = ? WHERE id = ?').run(
        fullName,
        mobile,
        now,
        auth.userId
      );
    }

    if (auth.role === 'customer') {
      const businessName = String(body.businessName || '').trim();
      const businessCategory = String(body.businessCategory || '').trim();
      const address = String(body.address || '').trim();
      const gstin = String(body.gstin || '').trim();
      if (businessName && businessCategory && address) {
        db.prepare(
          'UPDATE customer_profiles SET business_name = ?, business_category = ?, address = ?, gstin = ?, updated_at = ? WHERE user_id = ?'
        ).run(businessName, businessCategory, address, gstin, now, auth.userId);
      }
    } else if (auth.role === 'consultant') {
      const studentId = String(body.studentId || '').trim();
      const university = String(body.university || '').trim();
      const course = String(body.course || '').trim();
      const qualification = String(body.qualification || '').trim();
      const specialisation = String(body.specialisation || '').trim();
      const experience = String(body.experience || '').trim();
      const portfolioUrl = String(body.portfolioUrl || '').trim();
      const certificationsText = String(body.certificationsText || '').trim();
      const bio = String(body.bio || '').trim();
      const availabilityStatus = ['available', 'busy', 'unavailable'].includes(String(body.availabilityStatus))
        ? String(body.availabilityStatus)
        : 'available';
      const skillsJson = Array.isArray(body.skills)
        ? JSON.stringify(body.skills.map((s) => String(s).trim()).filter(Boolean))
        : undefined;

      db.prepare(`
        UPDATE consultant_profiles
        SET student_id = COALESCE(NULLIF(?, ''), student_id),
            university = COALESCE(NULLIF(?, ''), university),
            course = COALESCE(NULLIF(?, ''), course),
            qualification = COALESCE(NULLIF(?, ''), qualification),
            specialisation = COALESCE(NULLIF(?, ''), specialisation),
            skills_json = COALESCE(?, skills_json),
            experience = ?,
            portfolio_url = ?,
            certifications_text = ?,
            bio = ?,
            availability_status = ?,
            updated_at = ?
        WHERE user_id = ?
      `).run(
        studentId,
        university,
        course,
        qualification,
        specialisation,
        skillsJson ?? null,
        experience,
        portfolioUrl,
        certificationsText,
        bio,
        availabilityStatus,
        now,
        auth.userId
      );
    }

    logAudit(auth.userId, auth.role, 'PROFILE_UPDATED', 'user', auth.userId, {}, req.ip);
    res.json({ user: sanitizeUserRecord(auth.userId) });
  });

  app.post('/api/account/change-password', requireAuth, (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const currentPassword = String((req.body as Record<string, unknown>).currentPassword || '');
    const newPassword = String((req.body as Record<string, unknown>).newPassword || '');
    if (newPassword.length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters.' });
      return;
    }
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(auth.userId) as {
      password_hash: string;
    };
    if (!verifyPassword(currentPassword, row.password_hash)) {
      res.status(401).json({ error: 'Current password is incorrect.' });
      return;
    }
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
      hashPassword(newPassword),
      new Date().toISOString(),
      auth.userId
    );
    logAudit(auth.userId, auth.role, 'PASSWORD_CHANGED', 'user', auth.userId, {}, req.ip);
    res.json({ ok: true });
  });

  // Public Marketplace Catalog, Approved Consultants, Verified Reviews, Settings, Newsletter, Contact
  app.get('/api/public/marketplace', (req, res) => {
    const q = String(req.query.q || '')
      .trim()
      .toLowerCase();
    const categoryId = String(req.query.categoryId || '').trim();
    const minPrice = req.query.minPrice ? Number(req.query.minPrice) : null;
    const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : null;

    const categories = db
      .prepare('SELECT * FROM service_categories WHERE is_active = 1 ORDER BY sort_order ASC')
      .all();

    let services = db
      .prepare(`
        SELECT s.*, c.name as category_name, c.slug as category_slug, c.image_url as category_image_url,
               u.full_name as consultant_name
        FROM services s
        JOIN service_categories c ON s.category_id = c.id
        LEFT JOIN users u ON s.consultant_id = u.id
        WHERE s.is_active = 1 AND c.is_active = 1
        ORDER BY c.sort_order ASC, s.price_inr ASC
      `)
      .all() as Record<string, unknown>[];

    if (q) {
      services = services.filter((s) => {
        const haystack = [
          s.title,
          s.short_description,
          s.description,
          s.deliverables,
          s.required_skills,
          s.package_name,
          s.category_name,
        ]
          .map((v) => String(v || '').toLowerCase())
          .join(' ');
        return haystack.includes(q);
      });
    }
    if (categoryId) {
      services = services.filter((s) => s.category_id === categoryId);
    }
    if (minPrice !== null && !Number.isNaN(minPrice) && minPrice > 0) {
      services = services.filter((s) => Number(s.price_inr) >= minPrice);
    }
    if (maxPrice !== null && !Number.isNaN(maxPrice) && maxPrice > 0) {
      services = services.filter((s) => Number(s.price_inr) <= maxPrice);
    }

    let consultants = db
      .prepare(`
        SELECT u.id, u.full_name, cp.university, cp.course, cp.specialisation,
               cp.skills_json, cp.experience, cp.portfolio_url, cp.bio,
               cp.availability_status, cp.rating_avg, cp.review_count, cp.completed_count
        FROM users u
        JOIN consultant_profiles cp ON u.id = cp.user_id
        WHERE u.role = 'consultant' AND u.status = 'active' AND cp.approval_status = 'approved'
        ORDER BY cp.rating_avg DESC, cp.completed_count DESC
      `)
      .all() as Record<string, unknown>[];

    if (q) {
      consultants = consultants.filter(
        (c) =>
          String(c.full_name).toLowerCase().includes(q) ||
          String(c.specialisation).toLowerCase().includes(q) ||
          String(c.skills_json).toLowerCase().includes(q) ||
          String(c.university).toLowerCase().includes(q)
      );
    }

    const verifiedReviews = db
      .prepare(`
        SELECT r.id, r.rating, r.comment, r.consultant_response, r.created_at,
               s.title as service_title,
               cu.full_name as customer_name,
               cp.business_name,
               co.full_name as consultant_name
        FROM reviews r
        JOIN services s ON r.service_id = s.id
        JOIN users cu ON r.customer_id = cu.id
        LEFT JOIN customer_profiles cp ON cu.id = cp.user_id
        JOIN users co ON r.consultant_id = co.id
        WHERE r.is_verified = 1 AND r.moderation_status = 'published'
        ORDER BY r.created_at DESC
        LIMIT 12
      `)
      .all();

    const settings = getPlatformSettings();

    res.json({
      categories,
      services,
      consultants,
      verifiedReviews,
      settings: {
        brandName: settings.brandName,
        tagline: settings.tagline,
        currencySymbol: settings.currencySymbol || '₹',
        commissionPct: settings.commissionPct ?? 30,
        taxPct: settings.taxPct ?? 0,
        faqItems: settings.faqItems || [],
      },
    });
  });

  app.post('/api/public/newsletter', (req, res) => {
    const email = String((req.body as Record<string, unknown>).email || '')
      .trim()
      .toLowerCase();
    if (!email.includes('@')) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }
    const existing = db.prepare('SELECT id FROM newsletter_subscribers WHERE email = ?').get(email);
    if (!existing) {
      db.prepare('INSERT INTO newsletter_subscribers (id, email, created_at) VALUES (?, ?, ?)').run(
        `sub-${crypto.randomUUID()}`,
        email,
        new Date().toISOString()
      );
    }
    res.json({ ok: true, message: 'Subscribed to Campus Consult Dehradun updates.' });
  });

  app.post('/api/public/contact', (req, res) => {
    const body = req.body as Record<string, unknown>;
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim();
    const mobile = String(body.mobile || '').trim();
    const message = String(body.message || '').trim();
    if (!name || !email.includes('@') || !message) {
      res.status(400).json({ error: 'Name, valid email, and message are required.' });
      return;
    }
    const id = `inq-${crypto.randomUUID()}`;
    db.prepare(
      'INSERT INTO contact_inquiries (id, name, email, mobile, message, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, name, email, mobile, message, new Date().toISOString());

    const admins = db
      .prepare("SELECT id FROM users WHERE role IN ('admin', 'super_admin') AND status = 'active'")
      .all() as { id: string }[];
    for (const a of admins) {
      createNotification(a.id, 'contact_inquiry', 'New Contact Inquiry', `${name} (${email}) sent a contact message.`, 'support');
    }
    res.status(201).json({ ok: true, id });
  });
}
