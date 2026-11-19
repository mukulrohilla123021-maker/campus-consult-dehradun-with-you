import type { Express } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { db, getPlatformSettings, logAudit, STORAGE_UPLOAD_DIR } from './db.ts';
import { createNotification, pushRealtimeEvent } from './realtime.ts';
import { requireAuth, requireRoles, type AuthenticatedRequest } from './routesAuthAndPublic.ts';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

export function registerWorkflowRoutes(app: Express): void {
  // ---------------- BOOKINGS & QUOTATIONS ----------------
  app.get('/api/bookings', requireAuth, (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    let rows: unknown[] = [];

    const baseSql = `
      SELECT b.*, s.title as service_title, s.price_inr as list_price_inr, s.package_name,
             cu.full_name as customer_name, cp.business_name,
             co.full_name as assigned_consultant_name,
             pco.full_name as preferred_consultant_name
      FROM bookings b
      JOIN services s ON b.service_id = s.id
      JOIN users cu ON b.customer_id = cu.id
      LEFT JOIN customer_profiles cp ON cu.id = cp.user_id
      LEFT JOIN users co ON b.assigned_consultant_id = co.id
      LEFT JOIN users pco ON b.preferred_consultant_id = pco.id
    `;

    if (auth.role === 'customer') {
      rows = db.prepare(`${baseSql} WHERE b.customer_id = ? ORDER BY b.created_at DESC`).all(auth.userId);
    } else if (auth.role === 'consultant') {
      rows = db
        .prepare(
          `${baseSql} WHERE b.assigned_consultant_id = ? OR b.preferred_consultant_id = ? ORDER BY b.created_at DESC`
        )
        .all(auth.userId, auth.userId);
    } else {
      rows = db.prepare(`${baseSql} ORDER BY b.created_at DESC`).all();
    }

    const quotations = db.prepare('SELECT * FROM quotations ORDER BY created_at DESC').all() as Record<
      string,
      unknown
    >[];

    res.json({ bookings: rows, quotations });
  });

  app.post('/api/bookings', requireAuth, requireRoles('customer', 'admin', 'super_admin'), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const body = req.body as Record<string, unknown>;
    const serviceId = String(body.serviceId || '').trim();
    const projectTitle = String(body.projectTitle || '').trim();
    const preferredConsultantId = body.preferredConsultantId ? String(body.preferredConsultantId).trim() : null;
    const autoAssign = body.autoAssign !== undefined ? Boolean(body.autoAssign) : !preferredConsultantId;
    const requirements = String(body.requirements || '').trim();
    const expectedDeliveryDate = String(body.expectedDeliveryDate || '').trim();
    const isDraft = Boolean(body.isDraft);
    const requestQuotation = Boolean(body.requestQuotation);

    if (!serviceId || !requirements || !expectedDeliveryDate) {
      res.status(400).json({ error: 'Service, project requirements, and expected delivery date are required.' });
      return;
    }

    const service = db.prepare('SELECT id, title, price_inr, is_demo FROM services WHERE id = ? AND is_active = 1').get(serviceId) as
      | { id: string; title: string; price_inr: number; is_demo?: number }
      | undefined;

    if (!service) {
      res.status(404).json({ error: 'Selected service was not found or is inactive.' });
      return;
    }

    const customerId = auth.role === 'customer' ? auth.userId : String(body.customerId || auth.userId);
    const customerRow = db.prepare('SELECT is_demo FROM users WHERE id = ?').get(customerId) as { is_demo?: number } | undefined;
    const bookingIsDemo = Number(service.is_demo || 0) === 1 || Number(customerRow?.is_demo || 0) === 1 ? 1 : 0;

    // Duplicate booking guard unless explicitly allowed in settings
    const settings = getPlatformSettings();
    if (!settings.allowDuplicateBookings && !isDraft) {
      const dup = db
        .prepare(
          `SELECT id FROM bookings WHERE customer_id = ? AND service_id = ? AND status IN ('Pending', 'Under Review', 'Quotation Sent', 'Awaiting Confirmation', 'Confirmed', 'In Progress')`
        )
        .get(customerId, serviceId);
      if (dup) {
        res.status(409).json({
          error: 'You already have an active booking for this service. Please manage your existing booking instead of creating a duplicate.',
        });
        return;
      }
    }

    const resolvedPreferredId = autoAssign ? null : preferredConsultantId;
    if (resolvedPreferredId) {
      const c = db
        .prepare("SELECT u.id FROM users u JOIN consultant_profiles cp ON u.id = cp.user_id WHERE u.id = ? AND cp.approval_status = 'approved' AND u.status = 'active'")
        .get(resolvedPreferredId);
      if (!c) {
        res.status(400).json({ error: 'Preferred consultant is not active or approved.' });
        return;
      }
    }

    const budgetInrRaw = body.budgetInr !== undefined ? Number(body.budgetInr) : service.price_inr;
    const budgetInr = Number.isFinite(budgetInrRaw) && budgetInrRaw > 0 ? Math.round(budgetInrRaw) : service.price_inr;
    const resolvedTitle = projectTitle || service.title;

    const id = `bkg-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const initialStatus = isDraft ? 'Draft' : requestQuotation ? 'Under Review' : 'Pending';
    const history = [{ status: initialStatus, at: now, by: auth.userId, note: isDraft ? 'Saved as draft' : 'Submitted by customer' }];

    db.prepare(`
      INSERT INTO bookings (
        id, customer_id, service_id, preferred_consultant_id, assigned_consultant_id,
        project_title, requirements, expected_delivery_date, budget_inr, auto_assign,
        quoted_price_inr, status, status_history_json, is_demo, created_at, updated_at
      ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      customerId,
      serviceId,
      resolvedPreferredId,
      resolvedTitle,
      requirements,
      expectedDeliveryDate,
      budgetInr,
      autoAssign ? 1 : 0,
      budgetInr,
      initialStatus,
      JSON.stringify(history),
      bookingIsDemo,
      now,
      now
    );

    if (!isDraft) {
      const admins = db.prepare("SELECT id FROM users WHERE role IN ('admin', 'super_admin') AND status = 'active'").all() as { id: string }[];
      for (const a of admins) {
        createNotification(
          a.id,
          'booking_new',
          'New Service Booking',
          `${auth.fullName} booked "${resolvedTitle}" (₹${budgetInr}).`,
          'bookings'
        );
      }
      createNotification(
        customerId,
        'booking_created',
        'Booking Received',
        `Your booking for "${resolvedTitle}" is now ${initialStatus}.`,
        'bookings'
      );
    }

    logAudit(auth.userId, auth.role, 'BOOKING_CREATED', 'booking', id, { serviceId, projectTitle: resolvedTitle, budgetInr, status: initialStatus }, req.ip);
    res.status(201).json({ id, status: initialStatus });
  });

  // Customer confirms draft, accepts quotation, or cancels pending booking
  app.patch('/api/bookings/:id/customer-action', requireAuth, requireRoles('customer'), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const bookingId = req.params.id;
    const action = String((req.body as Record<string, unknown>).action || '');

    const booking = db.prepare('SELECT * FROM bookings WHERE id = ? AND customer_id = ?').get(bookingId, auth.userId) as
      | Record<string, unknown>
      | undefined;
    if (!booking) {
      res.status(404).json({ error: 'Booking not found or unauthorized.' });
      return;
    }

    const now = new Date().toISOString();
    const history = JSON.parse(String(booking.status_history_json || '[]')) as unknown[];

    let nextStatus = String(booking.status);
    if (action === 'submit_draft' && booking.status === 'Draft') {
      nextStatus = 'Pending';
    } else if (action === 'accept_quotation' && ['Quotation Sent', 'Awaiting Confirmation'].includes(String(booking.status))) {
      nextStatus = 'Confirmed';
      db.prepare("UPDATE quotations SET status = 'accepted' WHERE booking_id = ? AND status = 'sent'").run(bookingId);
    } else if (action === 'cancel' && ['Draft', 'Pending', 'Under Review', 'Quotation Sent', 'Awaiting Confirmation'].includes(String(booking.status))) {
      nextStatus = 'Cancelled';
    } else {
      res.status(400).json({ error: 'Invalid state transition for your booking.' });
      return;
    }

    history.push({ status: nextStatus, at: now, by: auth.userId, note: `Customer action: ${action}` });
    db.prepare('UPDATE bookings SET status = ?, status_history_json = ?, updated_at = ? WHERE id = ?').run(
      nextStatus,
      JSON.stringify(history),
      now,
      bookingId
    );

    const admins = db.prepare("SELECT id FROM users WHERE role IN ('admin', 'super_admin') AND status = 'active'").all() as { id: string }[];
    for (const a of admins) {
      createNotification(a.id, 'booking_update', 'Booking Updated by Customer', `Booking ${bookingId.slice(0, 10)} moved to ${nextStatus}.`, 'bookings');
    }

    logAudit(auth.userId, auth.role, 'BOOKING_CUSTOMER_ACTION', 'booking', bookingId, { action, nextStatus }, req.ip);
    res.json({ ok: true, status: nextStatus });
  });

  // Admin sends quotation, updates booking status, or assigns consultant (creating Project atomically)
  app.post('/api/bookings/:id/quotation', requireAuth, requireRoles('admin', 'super_admin'), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const bookingId = req.params.id;
    const body = req.body as Record<string, unknown>;
    const amountInr = Number(body.amountInr);
    const scopeNotes = String(body.scopeNotes || '').trim();
    const validUntil = String(body.validUntil || '').trim();

    if (!amountInr || amountInr <= 0 || !scopeNotes || !validUntil) {
      res.status(400).json({ error: 'Positive INR amount, scope notes, and validity date are required.' });
      return;
    }

    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId) as Record<string, unknown> | undefined;
    if (!booking) {
      res.status(404).json({ error: 'Booking not found.' });
      return;
    }

    const now = new Date().toISOString();
    const qId = `qtn-${crypto.randomUUID()}`;
    const history = JSON.parse(String(booking.status_history_json || '[]')) as unknown[];
    history.push({ status: 'Awaiting Confirmation', at: now, by: auth.userId, note: `Quotation ₹${amountInr} sent` });

    db.exec('BEGIN');
    try {
      db.prepare(`
        INSERT INTO quotations (id, booking_id, customer_id, amount_inr, scope_notes, valid_until, status, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'sent', ?, ?)
      `).run(qId, bookingId, String(booking.customer_id), amountInr, scopeNotes, validUntil, auth.userId, now);

      db.prepare(
        'UPDATE bookings SET quoted_price_inr = ?, status = ?, status_history_json = ?, updated_at = ? WHERE id = ?'
      ).run(amountInr, 'Awaiting Confirmation', JSON.stringify(history), now, bookingId);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    createNotification(
      String(booking.customer_id),
      'quotation_sent',
      'Quotation Received',
      `A quotation of ₹${amountInr} has been issued for your booking. Please review and confirm.`,
      'bookings'
    );
    logAudit(auth.userId, auth.role, 'QUOTATION_SENT', 'booking', bookingId, { amountInr, qId }, req.ip);
    res.status(201).json({ ok: true, quotationId: qId });
  });

  app.post('/api/bookings/:id/assign', requireAuth, requireRoles('admin', 'super_admin'), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const bookingId = req.params.id;
    const consultantId = String((req.body as Record<string, unknown>).consultantId || '').trim();

    if (!consultantId) {
      res.status(400).json({ error: 'Consultant ID is required.' });
      return;
    }

    const booking = db
      .prepare('SELECT b.*, s.title as service_title FROM bookings b JOIN services s ON b.service_id = s.id WHERE b.id = ?')
      .get(bookingId) as Record<string, unknown> | undefined;
    if (!booking) {
      res.status(404).json({ error: 'Booking not found.' });
      return;
    }

    const consultant = db
      .prepare("SELECT u.id, u.full_name FROM users u JOIN consultant_profiles cp ON u.id = cp.user_id WHERE u.id = ? AND u.status = 'active' AND cp.approval_status = 'approved'")
      .get(consultantId) as { id: string; full_name: string } | undefined;
    if (!consultant) {
      res.status(400).json({ error: 'Selected consultant is not active or approved.' });
      return;
    }

    const now = new Date().toISOString();
    const history = JSON.parse(String(booking.status_history_json || '[]')) as unknown[];
    history.push({ status: 'Confirmed', at: now, by: auth.userId, note: `Assigned to ${consultant.full_name}` });

    let projectId: string;
    const existingProject = db.prepare('SELECT id FROM projects WHERE booking_id = ?').get(bookingId) as { id: string } | undefined;

    const bookingIsDemo = Number(booking.is_demo || 0) === 1 ? 1 : 0;

    db.exec('BEGIN');
    try {
      db.prepare(
        'UPDATE bookings SET assigned_consultant_id = ?, status = ?, status_history_json = ?, updated_at = ? WHERE id = ?'
      ).run(consultantId, 'Confirmed', JSON.stringify(history), now, bookingId);

      if (existingProject) {
        projectId = existingProject.id;
        db.prepare('UPDATE projects SET consultant_id = ?, updated_at = ? WHERE id = ?').run(consultantId, now, projectId);
      } else {
        projectId = `prj-${crypto.randomUUID()}`;
        db.prepare(`
          INSERT INTO projects (
            id, booking_id, customer_id, consultant_id, service_id, title, description,
            status, progress_pct, deadline, is_demo, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Assigned', 10, ?, ?, ?, ?)
        `).run(
          projectId,
          bookingId,
          String(booking.customer_id),
          consultantId,
          String(booking.service_id),
          String(booking.project_title || booking.service_title),
          String(booking.requirements),
          String(booking.expected_delivery_date),
          bookingIsDemo,
          now,
          now
        );

        // Seed standard starter milestones for workflow tracking
        const insertMilestone = db.prepare(
          'INSERT INTO project_milestones (id, project_id, title, status, due_date) VALUES (?, ?, ?, ?, ?)'
        );
        insertMilestone.run(`mil-${crypto.randomUUID()}`, projectId, 'Requirements Kickoff & Ledger/Data Handover', 'pending', String(booking.expected_delivery_date));
        insertMilestone.run(`mil-${crypto.randomUUID()}`, projectId, 'Draft Deliverable & Internal Review', 'pending', String(booking.expected_delivery_date));
        insertMilestone.run(`mil-${crypto.randomUUID()}`, projectId, 'Customer Approval & Final Handover', 'pending', String(booking.expected_delivery_date));

        // Create pending invoice & transaction placeholder if not already generated
        const existingTx = db.prepare('SELECT id FROM transactions WHERE booking_id = ?').get(bookingId);
        if (!existingTx) {
          const settings = getPlatformSettings();
          const commissionPct = Number(settings.commissionPct ?? 15);
          const taxPct = Number(settings.taxPct ?? 0);
          const gross = Number(booking.quoted_price_inr);
          const taxAmount = Math.round((gross * taxPct) / 100);
          const totalPayable = gross + taxAmount;
          const commissionAmount = Math.round((gross * commissionPct) / 100);
          const consultantEarning = gross - commissionAmount;
          const txId = `txn-${crypto.randomUUID()}`;
          const invNum = `CCD-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`;

          db.prepare(`
            INSERT INTO transactions (
              id, booking_id, project_id, customer_id, consultant_id,
              gross_amount_inr, tax_amount_inr, total_payable_inr,
              commission_pct, commission_amount_inr, consultant_earning_inr,
              payment_method, payment_reference, status, refund_amount_inr,
              recorded_by, is_demo, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual_upi', '', 'Pending', 0, ?, ?, ?, ?)
          `).run(
            txId,
            bookingId,
            projectId,
            String(booking.customer_id),
            consultantId,
            gross,
            taxAmount,
            totalPayable,
            commissionPct,
            commissionAmount,
            consultantEarning,
            auth.userId,
            bookingIsDemo,
            now,
            now
          );

          db.prepare(`
            INSERT INTO invoices (
              id, invoice_number, transaction_id, booking_id, customer_id, consultant_id,
              service_title, subtotal_inr, tax_pct, tax_amount_inr, total_inr, status, is_demo, issued_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?)
          `).run(
            `inv-${crypto.randomUUID()}`,
            invNum,
            txId,
            bookingId,
            String(booking.customer_id),
            consultantId,
            String(booking.service_title),
            gross,
            taxPct,
            taxAmount,
            totalPayable,
            bookingIsDemo,
            now
          );
        }
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    createNotification(
      consultantId,
      'project_assigned',
      'New Project Assigned',
      `You have been assigned "${String(booking.service_title)}". Review requirements and accept to start.`,
      'requests'
    );
    createNotification(
      String(booking.customer_id),
      'consultant_assigned',
      'Consultant Assigned',
      `${consultant.full_name} has been assigned to your booking. Invoice generated under Payments & Invoices.`,
      'projects'
    );
    logAudit(auth.userId, auth.role, 'CONSULTANT_ASSIGNED', 'booking', bookingId, { consultantId, projectId }, req.ip);
    res.json({ ok: true, projectId });
  });

  app.patch('/api/bookings/:id/status', requireAuth, requireRoles('admin', 'super_admin'), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const bookingId = req.params.id;
    const status = String((req.body as Record<string, unknown>).status || '');
    const note = String((req.body as Record<string, unknown>).note || '');

    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId) as Record<string, unknown> | undefined;
    if (!booking) {
      res.status(404).json({ error: 'Booking not found.' });
      return;
    }
    const now = new Date().toISOString();
    const history = JSON.parse(String(booking.status_history_json || '[]')) as unknown[];
    history.push({ status, at: now, by: auth.userId, note });

    db.prepare('UPDATE bookings SET status = ?, status_history_json = ?, updated_at = ? WHERE id = ?').run(
      status,
      JSON.stringify(history),
      now,
      bookingId
    );
    createNotification(String(booking.customer_id), 'booking_status', 'Booking Status Updated', `Your booking status changed to ${status}.`, 'bookings');
    logAudit(auth.userId, auth.role, 'BOOKING_STATUS_UPDATED', 'booking', bookingId, { status, note }, req.ip);
    res.json({ ok: true });
  });

  // ---------------- PROJECTS, TASKS & MILESTONES ----------------
  app.get('/api/projects', requireAuth, (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const baseSql = `
      SELECT p.*, s.title as service_title, s.revision_policy,
             cu.full_name as customer_name, cp.business_name,
             co.full_name as consultant_name
      FROM projects p
      JOIN services s ON p.service_id = s.id
      JOIN users cu ON p.customer_id = cu.id
      LEFT JOIN customer_profiles cp ON cu.id = cp.user_id
      JOIN users co ON p.consultant_id = co.id
    `;
    let projects: Record<string, unknown>[] = [];
    if (auth.role === 'customer') {
      projects = db.prepare(`${baseSql} WHERE p.customer_id = ? ORDER BY p.updated_at DESC`).all(auth.userId) as Record<string, unknown>[];
    } else if (auth.role === 'consultant') {
      projects = db.prepare(`${baseSql} WHERE p.consultant_id = ? ORDER BY p.updated_at DESC`).all(auth.userId) as Record<string, unknown>[];
    } else {
      projects = db.prepare(`${baseSql} ORDER BY p.updated_at DESC`).all() as Record<string, unknown>[];
    }

    const projectIds = projects.map((p) => String(p.id));
    let tasks: unknown[] = [];
    let milestones: unknown[] = [];
    if (projectIds.length > 0) {
      const placeholders = projectIds.map(() => '?').join(',');
      tasks = db.prepare(`SELECT * FROM project_tasks WHERE project_id IN (${placeholders}) ORDER BY created_at DESC`).all(...projectIds);
      milestones = db.prepare(`SELECT * FROM project_milestones WHERE project_id IN (${placeholders})`).all(...projectIds);
    }

    res.json({ projects, tasks, milestones });
  });

  app.patch('/api/projects/:id/workflow', requireAuth, (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const projectId = req.params.id;
    const body = req.body as Record<string, unknown>;
    const nextStatus = String(body.status || '');
    const progressPct = body.progressPct !== undefined ? Math.min(100, Math.max(0, Number(body.progressPct))) : undefined;
    const deliverablesNotes = body.deliverablesNotes !== undefined ? String(body.deliverablesNotes) : undefined;
    const revisionNotes = body.revisionNotes !== undefined ? String(body.revisionNotes) : undefined;

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as Record<string, unknown> | undefined;
    if (!project) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }

    const isCustomer = auth.role === 'customer' && project.customer_id === auth.userId;
    const isConsultant = auth.role === 'consultant' && project.consultant_id === auth.userId;
    const isAdmin = auth.role === 'admin' || auth.role === 'super_admin';

    if (!isCustomer && !isConsultant && !isAdmin) {
      res.status(403).json({ error: 'Unauthorized to update this project.' });
      return;
    }

    // Enforce role-appropriate transitions
    if (isCustomer && !['Revision Requested', 'Approved', 'Completed'].includes(nextStatus)) {
      res.status(403).json({ error: 'Customers can only request revisions or approve/complete submitted deliverables.' });
      return;
    }
    if (isConsultant) {
      const cpRow = db.prepare('SELECT approval_status FROM consultant_profiles WHERE user_id = ?').get(auth.userId) as
        | { approval_status: string }
        | undefined;
      if (!cpRow || cpRow.approval_status !== 'approved') {
        res.status(403).json({ error: 'Your consultant profile must be approved by Admin before accepting or updating projects.' });
        return;
      }
      if (!['Accepted', 'Started', 'In Progress', 'Deliverable Submitted'].includes(nextStatus)) {
        res.status(403).json({ error: 'Consultants can accept, start, update progress, or submit deliverables.' });
        return;
      }
    }

    const now = new Date().toISOString();
    const resolvedProgress =
      progressPct ??
      (nextStatus === 'Accepted'
        ? 20
        : nextStatus === 'Started'
        ? 30
        : nextStatus === 'Deliverable Submitted'
        ? 90
        : nextStatus === 'Approved' || nextStatus === 'Completed'
        ? 100
        : Number(project.progress_pct));

    db.exec('BEGIN');
    try {
      db.prepare(`
        UPDATE projects
        SET status = ?,
            progress_pct = ?,
            deliverables_notes = COALESCE(?, deliverables_notes),
            revision_notes = COALESCE(?, revision_notes),
            updated_at = ?
        WHERE id = ?
      `).run(
        nextStatus || String(project.status),
        resolvedProgress,
        deliverablesNotes ?? null,
        revisionNotes ?? null,
        now,
        projectId
      );

      if (nextStatus === 'Started' || nextStatus === 'In Progress') {
        db.prepare("UPDATE bookings SET status = 'In Progress', updated_at = ? WHERE id = ?").run(now, String(project.booking_id));
      } else if (nextStatus === 'Completed' || nextStatus === 'Approved') {
        db.prepare("UPDATE projects SET status = 'Completed', progress_pct = 100, updated_at = ? WHERE id = ?").run(now, projectId);
        db.prepare("UPDATE bookings SET status = 'Completed', updated_at = ? WHERE id = ?").run(now, String(project.booking_id));
        db.prepare('UPDATE consultant_profiles SET completed_count = completed_count + 1 WHERE user_id = ?').run(String(project.consultant_id));
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    const notifyTarget = isCustomer ? String(project.consultant_id) : String(project.customer_id);
    createNotification(
      notifyTarget,
      'project_update',
      'Project Progress Updated',
      `Project "${String(project.title)}" updated to ${nextStatus || String(project.status)} (${resolvedProgress}%).`,
      'projects'
    );
    logAudit(auth.userId, auth.role, 'PROJECT_WORKFLOW_UPDATED', 'project', projectId, { nextStatus, resolvedProgress }, req.ip);
    res.json({ ok: true });
  });

  // Tasks & Milestones inside a project
  app.post('/api/projects/:id/tasks', requireAuth, (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const projectId = req.params.id;
    const project = db.prepare('SELECT customer_id, consultant_id FROM projects WHERE id = ?').get(projectId) as
      | { customer_id: string; consultant_id: string }
      | undefined;
    if (!project) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }
    if (
      auth.role !== 'admin' &&
      auth.role !== 'super_admin' &&
      project.consultant_id !== auth.userId
    ) {
      res.status(403).json({ error: 'Only the assigned consultant or admin can add project tasks.' });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const title = String(body.title || '').trim();
    const priority = ['low', 'medium', 'high'].includes(String(body.priority)) ? String(body.priority) : 'medium';
    const dueDate = String(body.dueDate || '');
    if (!title) {
      res.status(400).json({ error: 'Task title is required.' });
      return;
    }
    const id = `tsk-${crypto.randomUUID()}`;
    db.prepare(
      'INSERT INTO project_tasks (id, project_id, title, priority, status, due_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, projectId, title, priority, 'todo', dueDate, new Date().toISOString());
    res.status(201).json({ id });
  });

  app.patch('/api/tasks/:taskId', requireAuth, (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const taskId = req.params.taskId;
    const status = String((req.body as Record<string, unknown>).status || '');
    if (!['todo', 'in_progress', 'done'].includes(status)) {
      res.status(400).json({ error: 'Invalid task status.' });
      return;
    }
    const task = db
      .prepare('SELECT t.id, p.consultant_id FROM project_tasks t JOIN projects p ON t.project_id = p.id WHERE t.id = ?')
      .get(taskId) as { id: string; consultant_id: string } | undefined;
    if (!task) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }
    if (auth.role !== 'admin' && auth.role !== 'super_admin' && task.consultant_id !== auth.userId) {
      res.status(403).json({ error: 'Unauthorized.' });
      return;
    }
    db.prepare('UPDATE project_tasks SET status = ? WHERE id = ?').run(status, taskId);
    res.json({ ok: true });
  });

  app.patch('/api/milestones/:milestoneId', requireAuth, (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const milestoneId = req.params.milestoneId;
    const status = String((req.body as Record<string, unknown>).status || '');
    if (!['pending', 'completed'].includes(status)) {
      res.status(400).json({ error: 'Invalid milestone status.' });
      return;
    }
    const mil = db
      .prepare('SELECT m.id, p.consultant_id, p.customer_id FROM project_milestones m JOIN projects p ON m.project_id = p.id WHERE m.id = ?')
      .get(milestoneId) as { id: string; consultant_id: string; customer_id: string } | undefined;
    if (!mil) {
      res.status(404).json({ error: 'Milestone not found.' });
      return;
    }
    if (
      auth.role !== 'admin' &&
      auth.role !== 'super_admin' &&
      mil.consultant_id !== auth.userId &&
      mil.customer_id !== auth.userId
    ) {
      res.status(403).json({ error: 'Unauthorized.' });
      return;
    }
    db.prepare('UPDATE project_milestones SET status = ?, completed_at = ? WHERE id = ?').run(
      status,
      status === 'completed' ? new Date().toISOString() : '',
      milestoneId
    );
    res.json({ ok: true });
  });

  // ---------------- DOCUMENTS (SECURE UPLOAD & DOWNLOAD) ----------------
  app.get('/api/documents', requireAuth, (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    let docs: unknown[] = [];
    if (auth.role === 'admin' || auth.role === 'super_admin') {
      docs = db
        .prepare(`
          SELECT d.id, d.owner_id, d.project_id, d.booking_id, d.category, d.file_name, d.mime_type, d.size_bytes, d.visibility, d.created_at,
                 u.full_name as owner_name
          FROM documents d
          JOIN users u ON d.owner_id = u.id
          ORDER BY d.created_at DESC
        `)
        .all();
    } else {
      docs = db
        .prepare(`
          SELECT DISTINCT d.id, d.owner_id, d.project_id, d.booking_id, d.category, d.file_name, d.mime_type, d.size_bytes, d.visibility, d.created_at,
                 u.full_name as owner_name
          FROM documents d
          JOIN users u ON d.owner_id = u.id
          LEFT JOIN projects p ON d.project_id = p.id
          LEFT JOIN bookings b ON d.booking_id = b.id
          WHERE d.owner_id = ?
             OR (d.visibility = 'participants' AND (p.customer_id = ? OR p.consultant_id = ? OR b.customer_id = ? OR b.assigned_consultant_id = ?))
          ORDER BY d.created_at DESC
        `)
        .all(auth.userId, auth.userId, auth.userId, auth.userId, auth.userId);
    }
    res.json({ documents: docs });
  });

  app.post('/api/documents', requireAuth, (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const body = req.body as Record<string, unknown>;
    const fileName = path.basename(String(body.fileName || 'document.pdf')).replace(/[^a-zA-Z0-9._-]/g, '_');
    const mimeType = String(body.mimeType || '');
    const contentBase64 = String(body.contentBase64 || '');
    const category = ['requirement', 'deliverable', 'certificate', 'portfolio', 'invoice', 'other'].includes(String(body.category))
      ? String(body.category)
      : 'other';
    const projectId = body.projectId ? String(body.projectId) : null;
    const bookingId = body.bookingId ? String(body.bookingId) : null;
    const visibility = projectId || bookingId ? 'participants' : 'private';

    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      res.status(400).json({ error: 'Unsupported file type. Allowed: PDF, PNG, JPG, CSV, XLSX, DOCX, TXT.' });
      return;
    }

    const buffer = Buffer.from(contentBase64, 'base64');
    if (buffer.length === 0 || buffer.length > MAX_FILE_BYTES) {
      res.status(400).json({ error: 'File must be between 1 byte and 5 MB.' });
      return;
    }

    const docId = `doc-${crypto.randomUUID()}`;
    const safeDiskName = `${docId}_${fileName}`;
    const fullDiskPath = path.join(STORAGE_UPLOAD_DIR, safeDiskName);
    fs.writeFileSync(fullDiskPath, buffer);

    db.prepare(`
      INSERT INTO documents (id, owner_id, project_id, booking_id, category, file_name, mime_type, size_bytes, storage_path, visibility, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(docId, auth.userId, projectId, bookingId, category, fileName, mimeType, buffer.length, safeDiskName, visibility, new Date().toISOString());

    logAudit(auth.userId, auth.role, 'DOCUMENT_UPLOADED', 'document', docId, { fileName, category, size: buffer.length }, req.ip);
    res.status(201).json({ id: docId, fileName, sizeBytes: buffer.length });
  });

  app.get('/api/documents/:id/download', requireAuth, (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const docRow = db
      .prepare(`
        SELECT d.*, p.customer_id as p_cust, p.consultant_id as p_cons, b.customer_id as b_cust, b.assigned_consultant_id as b_cons
        FROM documents d
        LEFT JOIN projects p ON d.project_id = p.id
        LEFT JOIN bookings b ON d.booking_id = b.id
        WHERE d.id = ?
      `)
      .get(req.params.id) as Record<string, unknown> | undefined;

    if (!docRow) {
      res.status(404).json({ error: 'Document not found.' });
      return;
    }

    const isAdmin = auth.role === 'admin' || auth.role === 'super_admin';
    const isOwner = docRow.owner_id === auth.userId;
    const isParticipant =
      docRow.visibility === 'participants' &&
      [docRow.p_cust, docRow.p_cons, docRow.b_cust, docRow.b_cons].includes(auth.userId);

    if (!isAdmin && !isOwner && !isParticipant) {
      res.status(403).json({ error: 'Access denied to this private document.' });
      return;
    }

    const diskPath = path.join(STORAGE_UPLOAD_DIR, String(docRow.storage_path));
    if (!fs.existsSync(diskPath)) {
      res.status(404).json({ error: 'Stored file missing on server.' });
      return;
    }

    res.setHeader('Content-Type', String(docRow.mime_type));
    res.setHeader('Content-Disposition', `attachment; filename="${String(docRow.file_name)}"`);
    fs.createReadStream(diskPath).pipe(res);
  });

  // ---------------- REAL-TIME MESSAGING ----------------
  app.get('/api/conversations', requireAuth, (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    let conversations: unknown[] = [];

    const sql = `
      SELECT c.*, ua.full_name as participant_a_name, ua.role as participant_a_role,
             ub.full_name as participant_b_name, ub.role as participant_b_role
      FROM conversations c
      JOIN users ua ON c.participant_a = ua.id
      JOIN users ub ON c.participant_b = ub.id
    `;

    if (auth.role === 'admin' || auth.role === 'super_admin') {
      // Authorised moderation view
      conversations = db.prepare(`${sql} ORDER BY c.last_message_at DESC`).all();
    } else {
      conversations = db
        .prepare(`${sql} WHERE c.participant_a = ? OR c.participant_b = ? ORDER BY c.last_message_at DESC`)
        .all(auth.userId, auth.userId);
    }

    res.json({ conversations });
  });

  app.post('/api/conversations', requireAuth, (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const body = req.body as Record<string, unknown>;
    let targetUserId = String(body.recipientId || '').trim();
    const projectId = body.projectId ? String(body.projectId) : null;
    const subject = String(body.subject || 'Project Discussion').trim();

    if (targetUserId === 'admin') {
      const adminRow = db
        .prepare("SELECT id FROM users WHERE role IN ('admin', 'super_admin') AND status = 'active' ORDER BY role ASC LIMIT 1")
        .get() as { id: string } | undefined;
      if (!adminRow) {
        res.status(404).json({ error: 'No active administrator found.' });
        return;
      }
      targetUserId = adminRow.id;
    }

    if (!targetUserId || targetUserId === auth.userId) {
      res.status(400).json({ error: 'Valid recipient is required.' });
      return;
    }

    const existing = db
      .prepare(
        `SELECT id FROM conversations WHERE ((participant_a = ? AND participant_b = ?) OR (participant_a = ? AND participant_b = ?)) AND COALESCE(project_id, '') = COALESCE(?, '')`
      )
      .get(auth.userId, targetUserId, targetUserId, auth.userId, projectId) as { id: string } | undefined;

    if (existing) {
      res.json({ id: existing.id });
      return;
    }

    const id = `cnv-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO conversations (id, subject, project_id, participant_a, participant_b, last_message_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, subject, projectId, auth.userId, targetUserId, now, now);

    res.status(201).json({ id });
  });

  app.get('/api/conversations/:id/messages', requireAuth, (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id) as
      | { id: string; participant_a: string; participant_b: string }
      | undefined;
    if (!conv) {
      res.status(404).json({ error: 'Conversation not found.' });
      return;
    }
    const isAdmin = auth.role === 'admin' || auth.role === 'super_admin';
    if (!isAdmin && conv.participant_a !== auth.userId && conv.participant_b !== auth.userId) {
      res.status(403).json({ error: 'You are not an authorised participant of this conversation.' });
      return;
    }

    // Mark unread messages from the other party as read
    if (conv.participant_a === auth.userId || conv.participant_b === auth.userId) {
      db.prepare('UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND sender_id != ?').run(
        conv.id,
        auth.userId
      );
    }

    const messages = db
      .prepare(`
        SELECT m.*, u.full_name as sender_name, u.role as sender_role, d.file_name as attachment_name
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        LEFT JOIN documents d ON m.attachment_doc_id = d.id
        WHERE m.conversation_id = ?
        ORDER BY m.created_at ASC
      `)
      .all(conv.id);

    res.json({ messages });
  });

  app.post('/api/conversations/:id/messages', requireAuth, (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id) as
      | { id: string; participant_a: string; participant_b: string }
      | undefined;
    if (!conv) {
      res.status(404).json({ error: 'Conversation not found.' });
      return;
    }
    if (
      auth.role !== 'admin' &&
      auth.role !== 'super_admin' &&
      conv.participant_a !== auth.userId &&
      conv.participant_b !== auth.userId
    ) {
      res.status(403).json({ error: 'Not authorised to post in this conversation.' });
      return;
    }

    const bodyText = String((req.body as Record<string, unknown>).body || '').trim();
    const attachmentDocId = (req.body as Record<string, unknown>).attachmentDocId
      ? String((req.body as Record<string, unknown>).attachmentDocId)
      : null;

    if (!bodyText && !attachmentDocId) {
      res.status(400).json({ error: 'Message text or attachment is required.' });
      return;
    }

    const msgId = `msg-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO messages (id, conversation_id, sender_id, body, attachment_doc_id, is_read, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)'
    ).run(msgId, conv.id, auth.userId, bodyText, attachmentDocId, now);

    db.prepare('UPDATE conversations SET last_message_at = ? WHERE id = ?').run(now, conv.id);

    const payload = {
      id: msgId,
      conversation_id: conv.id,
      sender_id: auth.userId,
      sender_name: auth.fullName,
      sender_role: auth.role,
      body: bodyText,
      attachment_doc_id: attachmentDocId,
      is_read: 0,
      created_at: now,
    };

    const recipient = conv.participant_a === auth.userId ? conv.participant_b : conv.participant_a;
    pushRealtimeEvent(recipient, 'message:new', payload);
    pushRealtimeEvent(auth.userId, 'message:new', payload);
    createNotification(recipient, 'message', 'New Message', `${auth.fullName}: ${bodyText.slice(0, 70)}`, 'messages');

    res.status(201).json({ message: payload });
  });

  // ---------------- VERIFIED REVIEWS & RATINGS ----------------
  app.get('/api/reviews', requireAuth, (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    let reviews: unknown[] = [];
    const baseSql = `
      SELECT r.*, s.title as service_title, cu.full_name as customer_name, co.full_name as consultant_name
      FROM reviews r
      JOIN services s ON r.service_id = s.id
      JOIN users cu ON r.customer_id = cu.id
      JOIN users co ON r.consultant_id = co.id
    `;
    if (auth.role === 'customer') {
      reviews = db.prepare(`${baseSql} WHERE r.customer_id = ? ORDER BY r.created_at DESC`).all(auth.userId);
    } else if (auth.role === 'consultant') {
      reviews = db.prepare(`${baseSql} WHERE r.consultant_id = ? ORDER BY r.created_at DESC`).all(auth.userId);
    } else {
      reviews = db.prepare(`${baseSql} ORDER BY r.created_at DESC`).all();
    }
    res.json({ reviews });
  });

  app.post('/api/reviews', requireAuth, requireRoles('customer'), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const body = req.body as Record<string, unknown>;
    const projectId = String(body.projectId || '').trim();
    const rating = Math.round(Number(body.rating));
    const comment = String(body.comment || '').trim();

    if (!projectId || rating < 1 || rating > 5 || comment.length < 5) {
      res.status(400).json({ error: 'Completed project, 1–5 rating, and written feedback are required.' });
      return;
    }

    const project = db
      .prepare("SELECT * FROM projects WHERE id = ? AND customer_id = ? AND status = 'Completed'")
      .get(projectId, auth.userId) as Record<string, unknown> | undefined;

    if (!project) {
      res.status(403).json({ error: 'Verified reviews can only be submitted for your completed projects.' });
      return;
    }

    const existing = db.prepare('SELECT id FROM reviews WHERE project_id = ?').get(projectId);
    if (existing) {
      res.status(409).json({ error: 'You have already submitted a verified review for this project.' });
      return;
    }

    const revId = `rev-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const consultantId = String(project.consultant_id);

    db.exec('BEGIN');
    try {
      db.prepare(`
        INSERT INTO reviews (id, project_id, service_id, customer_id, consultant_id, rating, comment, is_verified, moderation_status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'published', ?)
      `).run(revId, projectId, String(project.service_id), auth.userId, consultantId, rating, comment, now);

      const agg = db
        .prepare("SELECT AVG(rating) as avg_r, COUNT(*) as cnt FROM reviews WHERE consultant_id = ? AND moderation_status = 'published'")
        .get(consultantId) as { avg_r: number; cnt: number };

      db.prepare('UPDATE consultant_profiles SET rating_avg = ?, review_count = ? WHERE user_id = ?').run(
        Number((agg.avg_r || 0).toFixed(2)),
        agg.cnt || 0,
        consultantId
      );
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    createNotification(consultantId, 'review_new', 'New Verified Rating', `${auth.fullName} rated your project ${rating}/5 stars.`, 'reviews');
    logAudit(auth.userId, auth.role, 'REVIEW_CREATED', 'review', revId, { projectId, rating }, req.ip);
    res.status(201).json({ id: revId });
  });

  app.patch('/api/reviews/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const rev = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!rev) {
      res.status(404).json({ error: 'Review not found.' });
      return;
    }
    const body = req.body as Record<string, unknown>;
    if (auth.role === 'consultant' && rev.consultant_id === auth.userId && body.consultantResponse !== undefined) {
      db.prepare('UPDATE reviews SET consultant_response = ? WHERE id = ?').run(String(body.consultantResponse), req.params.id);
      res.json({ ok: true });
      return;
    }
    if (body.flag === true) {
      db.prepare('UPDATE reviews SET is_flagged = 1 WHERE id = ?').run(req.params.id);
      res.json({ ok: true });
      return;
    }
    if ((auth.role === 'admin' || auth.role === 'super_admin') && body.moderationStatus) {
      db.prepare('UPDATE reviews SET moderation_status = ? WHERE id = ?').run(String(body.moderationStatus), req.params.id);
      res.json({ ok: true });
      return;
    }
    res.status(403).json({ error: 'Unauthorized review action.' });
  });

  // ---------------- SUPPORT TICKETS & COMPLAINTS ----------------
  app.get('/api/tickets', requireAuth, (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    let tickets: Record<string, unknown>[] = [];
    if (auth.role === 'admin' || auth.role === 'super_admin') {
      tickets = db
        .prepare('SELECT t.*, u.full_name as user_name, u.role as user_role FROM support_tickets t JOIN users u ON t.user_id = u.id ORDER BY t.updated_at DESC')
        .all() as Record<string, unknown>[];
    } else {
      tickets = db
        .prepare('SELECT t.*, u.full_name as user_name, u.role as user_role FROM support_tickets t JOIN users u ON t.user_id = u.id WHERE t.user_id = ? ORDER BY t.updated_at DESC')
        .all(auth.userId) as Record<string, unknown>[];
    }

    const ticketIds = tickets.map((t) => String(t.id));
    let messages: unknown[] = [];
    if (ticketIds.length > 0) {
      const ph = ticketIds.map(() => '?').join(',');
      const hideInternal = auth.role !== 'admin' && auth.role !== 'super_admin' ? 'AND m.is_internal_note = 0' : '';
      messages = db
        .prepare(`SELECT m.*, u.full_name as sender_name, u.role as sender_role FROM support_messages m JOIN users u ON m.sender_id = u.id WHERE m.ticket_id IN (${ph}) ${hideInternal} ORDER BY m.created_at ASC`)
        .all(...ticketIds);
    }
    res.json({ tickets, messages });
  });

  app.post('/api/tickets', requireAuth, (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const body = req.body as Record<string, unknown>;
    const category = String(body.category || 'General Support').trim();
    const priority = ['low', 'medium', 'high', 'urgent'].includes(String(body.priority)) ? String(body.priority) : 'medium';
    const subject = String(body.subject || '').trim();
    const message = String(body.message || '').trim();
    const refundRequested = Boolean(body.refundRequested);

    if (!subject || !message) {
      res.status(400).json({ error: 'Subject and initial message are required.' });
      return;
    }

    const tId = `tkt-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    db.exec('BEGIN');
    try {
      db.prepare(`
        INSERT INTO support_tickets (id, user_id, category, priority, subject, status, refund_requested, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'Open', ?, ?, ?)
      `).run(tId, auth.userId, category, priority, subject, refundRequested ? 1 : 0, now, now);

      db.prepare(
        'INSERT INTO support_messages (id, ticket_id, sender_id, body, is_internal_note, created_at) VALUES (?, ?, ?, ?, 0, ?)'
      ).run(`tm-${crypto.randomUUID()}`, tId, auth.userId, message, now);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    const admins = db.prepare("SELECT id FROM users WHERE role IN ('admin', 'super_admin') AND status = 'active'").all() as { id: string }[];
    for (const a of admins) {
      createNotification(a.id, 'support_ticket', 'New Support Ticket', `${auth.fullName}: ${subject}`, 'support');
    }
    res.status(201).json({ id: tId });
  });

  app.post('/api/tickets/:id/reply', requireAuth, (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const ticket = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(req.params.id) as
      | Record<string, unknown>
      | undefined;
    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found.' });
      return;
    }
    const isAdmin = auth.role === 'admin' || auth.role === 'super_admin';
    if (!isAdmin && ticket.user_id !== auth.userId) {
      res.status(403).json({ error: 'Unauthorized.' });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const text = String(body.body || '').trim();
    const isInternalNote = isAdmin && Boolean(body.isInternalNote);
    const nextStatus = isAdmin && body.status ? String(body.status) : isAdmin ? 'Awaiting Response' : 'In Progress';

    if (!text) {
      res.status(400).json({ error: 'Reply body is required.' });
      return;
    }

    const now = new Date().toISOString();
    db.prepare('INSERT INTO support_messages (id, ticket_id, sender_id, body, is_internal_note, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      `tm-${crypto.randomUUID()}`,
      req.params.id,
      auth.userId,
      text,
      isInternalNote ? 1 : 0,
      now
    );
    db.prepare('UPDATE support_tickets SET status = ?, updated_at = ? WHERE id = ?').run(nextStatus, now, req.params.id);

    if (isAdmin && !isInternalNote) {
      createNotification(String(ticket.user_id), 'ticket_reply', 'Support Ticket Update', `Admin replied on "${String(ticket.subject)}".`, 'support');
    }
    res.json({ ok: true });
  });

  // ---------------- NOTIFICATIONS & CALENDAR AVAILABILITY ----------------
  app.get('/api/notifications', requireAuth, (req: AuthenticatedRequest, res) => {
    const rows = db
      .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 60')
      .all(req.auth!.userId);
    res.json({ notifications: rows });
  });

  app.patch('/api/notifications/read-all', requireAuth, (req: AuthenticatedRequest, res) => {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.auth!.userId);
    res.json({ ok: true });
  });

  app.get('/api/consultant/availability', requireAuth, (req: AuthenticatedRequest, res) => {
    const consultantId = req.query.consultantId ? String(req.query.consultantId) : req.auth!.userId;
    const slots = db
      .prepare('SELECT * FROM consultant_availability WHERE consultant_id = ? ORDER BY day_of_week ASC')
      .all(consultantId);
    res.json({ slots });
  });

  app.post('/api/consultant/availability', requireAuth, requireRoles('consultant'), (req: AuthenticatedRequest, res) => {
    const body = req.body as Record<string, unknown>;
    const dayOfWeek = String(body.dayOfWeek || '').trim();
    const startTime = String(body.startTime || '').trim();
    const endTime = String(body.endTime || '').trim();
    const slotNote = String(body.slotNote || '').trim();
    if (!dayOfWeek || !startTime || !endTime) {
      res.status(400).json({ error: 'Day, start time, and end time are required.' });
      return;
    }
    const id = `avl-${crypto.randomUUID()}`;
    db.prepare(
      'INSERT INTO consultant_availability (id, consultant_id, day_of_week, start_time, end_time, slot_note) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, req.auth!.userId, dayOfWeek, startTime, endTime, slotNote);
    res.status(201).json({ id });
  });

  app.delete('/api/consultant/availability/:id', requireAuth, requireRoles('consultant'), (req: AuthenticatedRequest, res) => {
    db.prepare('DELETE FROM consultant_availability WHERE id = ? AND consultant_id = ?').run(req.params.id, req.auth!.userId);
    res.json({ ok: true });
  });
}
