import type { Express } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { hashPassword, type UserRole } from './auth.ts';
import { db, getPlatformSettings, logAudit, STORAGE_UPLOAD_DIR } from './db.ts';
import { createNotification } from './realtime.ts';
import { requireAuth, requireRoles, type AuthenticatedRequest } from './routesAuthAndPublic.ts';

export function registerAdminAndFinanceRoutes(app: Express): void {
  // ---------------- PAYMENTS, INVOICES & CONSULTANT EARNINGS ----------------
  app.get('/api/finance/ledger', requireAuth, (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const txBase = `
      SELECT t.*, b.status as booking_status, s.title as service_title,
             cu.full_name as customer_name, cp.business_name,
             co.full_name as consultant_name
      FROM transactions t
      JOIN bookings b ON t.booking_id = b.id
      JOIN services s ON b.service_id = s.id
      JOIN users cu ON t.customer_id = cu.id
      LEFT JOIN customer_profiles cp ON cu.id = cp.user_id
      LEFT JOIN users co ON t.consultant_id = co.id
    `;
    const invBase = `
      SELECT i.*, cu.full_name as customer_name, cp.business_name, cp.address as customer_address,
             cu.email as customer_email, cu.mobile as customer_mobile,
             co.full_name as consultant_name
      FROM invoices i
      JOIN users cu ON i.customer_id = cu.id
      LEFT JOIN customer_profiles cp ON cu.id = cp.user_id
      LEFT JOIN users co ON i.consultant_id = co.id
    `;

    let transactions: unknown[] = [];
    let invoices: unknown[] = [];
    let payouts: unknown[] = [];
    let expenses: unknown[] = [];

    if (auth.role === 'customer') {
      transactions = db.prepare(`${txBase} WHERE t.customer_id = ? ORDER BY t.created_at DESC`).all(auth.userId);
      invoices = db.prepare(`${invBase} WHERE i.customer_id = ? ORDER BY i.issued_at DESC`).all(auth.userId);
    } else if (auth.role === 'consultant') {
      transactions = db.prepare(`${txBase} WHERE t.consultant_id = ? ORDER BY t.created_at DESC`).all(auth.userId);
      invoices = db.prepare(`${invBase} WHERE i.consultant_id = ? ORDER BY i.issued_at DESC`).all(auth.userId);
      payouts = db.prepare('SELECT * FROM payouts WHERE consultant_id = ? ORDER BY created_at DESC').all(auth.userId);
    } else {
      transactions = db.prepare(`${txBase} ORDER BY t.created_at DESC`).all();
      invoices = db.prepare(`${invBase} ORDER BY i.issued_at DESC`).all();
      payouts = db
        .prepare('SELECT p.*, u.full_name as consultant_name FROM payouts p JOIN users u ON p.consultant_id = u.id ORDER BY p.created_at DESC')
        .all();
      expenses = db.prepare('SELECT * FROM operating_expenses ORDER BY expense_date DESC, created_at DESC').all();
    }

    res.json({ transactions, invoices, payouts, expenses });
  });

  // Record manual payment or Razorpay status (Admin / Super Admin)
  app.patch('/api/finance/transactions/:id', requireAuth, requireRoles('admin', 'super_admin'), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!tx) {
      res.status(404).json({ error: 'Transaction not found.' });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const status = String(body.status || tx.status);
    const paymentMethod = String(body.paymentMethod || tx.payment_method);
    const paymentReference = String(body.paymentReference || tx.payment_reference || '');
    const refundAmount = body.refundAmountInr !== undefined ? Number(body.refundAmountInr) : Number(tx.refund_amount_inr || 0);

    const validStatuses = ['Pending', 'Initiated', 'Successful', 'Failed', 'Refunded', 'Partially Refunded'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: 'Invalid transaction status.' });
      return;
    }

    const now = new Date().toISOString();
    db.exec('BEGIN');
    try {
      db.prepare(`
        UPDATE transactions
        SET status = ?, payment_method = ?, payment_reference = ?, refund_amount_inr = ?, recorded_by = ?, updated_at = ?
        WHERE id = ?
      `).run(status, paymentMethod, paymentReference, refundAmount, auth.userId, now, req.params.id);

      db.prepare('UPDATE invoices SET status = ? WHERE transaction_id = ?').run(status, req.params.id);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    createNotification(
      String(tx.customer_id),
      'payment_update',
      'Payment Record Updated',
      `Your payment status is now ${status}${paymentReference ? ` (Ref: ${paymentReference})` : ''}.`,
      'payments'
    );
    if (tx.consultant_id && status === 'Successful') {
      createNotification(
        String(tx.consultant_id),
        'earning_confirmed',
        'Customer Payment Confirmed',
        `Customer payment settled; consultant earning of ₹${String(tx.consultant_earning_inr)} credited to pending ledger.`,
        'earnings'
      );
    }

    logAudit(auth.userId, auth.role, 'TRANSACTION_UPDATED', 'transaction', req.params.id, { status, paymentMethod, paymentReference, refundAmount }, req.ip);
    res.json({ ok: true });
  });

  // Record consultant payout
  app.post('/api/finance/payouts', requireAuth, requireRoles('admin', 'super_admin'), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const body = req.body as Record<string, unknown>;
    const consultantId = String(body.consultantId || '').trim();
    const amountInr = Number(body.amountInr);
    const reference = String(body.reference || '').trim();
    const periodLabel = String(body.periodLabel || '').trim();

    if (!consultantId || !amountInr || amountInr <= 0 || !reference || !periodLabel) {
      res.status(400).json({ error: 'Consultant, positive INR amount, reference, and period label are required.' });
      return;
    }

    const id = `pay-${crypto.randomUUID()}`;
    db.prepare(
      'INSERT INTO payouts (id, consultant_id, amount_inr, reference, status, period_label, recorded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, consultantId, amountInr, reference, 'paid', periodLabel, auth.userId, new Date().toISOString());

    createNotification(
      consultantId,
      'payout_sent',
      'Consultant Payout Recorded',
      `A payout of ₹${amountInr} (${periodLabel}, Ref: ${reference}) has been recorded.`,
      'earnings'
    );
    logAudit(auth.userId, auth.role, 'PAYOUT_RECORDED', 'payout', id, { consultantId, amountInr, reference }, req.ip);
    res.status(201).json({ id });
  });

  // Record actual operating expenses
  app.post('/api/finance/expenses', requireAuth, requireRoles('admin', 'super_admin'), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const body = req.body as Record<string, unknown>;
    const category = String(body.category || '').trim();
    const description = String(body.description || '').trim();
    const amountInr = Number(body.amountInr);
    const expenseDate = String(body.expenseDate || new Date().toISOString().slice(0, 10));

    if (!category || !description || !amountInr || amountInr <= 0) {
      res.status(400).json({ error: 'Category, description, and positive INR amount are required.' });
      return;
    }

    const id = `exp-${crypto.randomUUID()}`;
    db.prepare(
      'INSERT INTO operating_expenses (id, category, description, amount_inr, expense_date, recorded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, category, description, amountInr, expenseDate, auth.userId, new Date().toISOString());

    logAudit(auth.userId, auth.role, 'EXPENSE_RECORDED', 'operating_expense', id, { category, amountInr }, req.ip);
    res.status(201).json({ id });
  });

function resolveDateRange(rangeRaw: string, fromRaw: string, toRaw: string): { range: string; fromIso: string | null; toIso: string | null } {
  const now = new Date();
  const range = (rangeRaw || 'all').toLowerCase();
  const startOfDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0)).toISOString();
  const endOfDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999)).toISOString();

  if (range === 'today') {
    return { range, fromIso: startOfDay(now), toIso: endOfDay(now) };
  }
  if (range === '7d') {
    const start = new Date(now.getTime() - 6 * 86400000);
    return { range, fromIso: startOfDay(start), toIso: endOfDay(now) };
  }
  if (range === '30d') {
    const start = new Date(now.getTime() - 29 * 86400000);
    return { range, fromIso: startOfDay(start), toIso: endOfDay(now) };
  }
  if (range === 'monthly') {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return { range, fromIso: start.toISOString(), toIso: endOfDay(now) };
  }
  if (range === 'quarterly') {
    const qMonth = Math.floor(now.getUTCMonth() / 3) * 3;
    const start = new Date(Date.UTC(now.getUTCFullYear(), qMonth, 1));
    return { range, fromIso: start.toISOString(), toIso: endOfDay(now) };
  }
  if (range === 'yearly') {
    const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    return { range, fromIso: start.toISOString(), toIso: endOfDay(now) };
  }
  if (range === 'custom' && fromRaw) {
    const fromIso = `${fromRaw.slice(0, 10)}T00:00:00.000Z`;
    const toIso = toRaw ? `${toRaw.slice(0, 10)}T23:59:59.999Z` : endOfDay(now);
    return { range, fromIso, toIso };
  }
  return { range: 'all', fromIso: null, toIso: null };
}

  // Real Financial & Platform Analytics Summary (isolated from DEMO DATA by default unless ?includeDemo=1)
  app.get('/api/admin/overview', requireAuth, requireRoles('admin', 'super_admin'), (req, res) => {
    const rangeParam = String(req.query.range || 'all');
    const fromParam = String(req.query.from || '');
    const toParam = String(req.query.to || '');
    const includeDemo = req.query.includeDemo === '1' || req.query.includeDemo === 'true';
    const { range, fromIso, toIso } = resolveDateRange(rangeParam, fromParam, toParam);

    const hasRange = Boolean(fromIso && toIso);
    const rangeCond = (col: string) => (hasRange ? ` AND ${col} >= ? AND ${col} <= ? ` : '');
    const rangeArgs = hasRange ? [fromIso!, toIso!] : [];
    const demoCond = (alias = '') => {
      const prefix = alias ? `${alias}.` : '';
      return includeDemo ? '' : ` AND COALESCE(${prefix}is_demo, 0) = 0 `;
    };

    const customersCount = (
      db.prepare(`SELECT COUNT(*) as c FROM users WHERE role = 'customer' ${demoCond()}`).get() as { c: number }
    ).c;
    const consultantsCount = (
      db.prepare(`SELECT COUNT(*) as c FROM users WHERE role = 'consultant' ${demoCond()}`).get() as { c: number }
    ).c;
    const approvedConsultants = (
      db
        .prepare(
          `SELECT COUNT(*) as c FROM consultant_profiles cp JOIN users u ON cp.user_id = u.id WHERE cp.approval_status = 'approved' ${demoCond('u')}`
        )
        .get() as { c: number }
    ).c;
    const pendingConsultants = (
      db
        .prepare(
          `SELECT COUNT(*) as c FROM consultant_profiles cp JOIN users u ON cp.user_id = u.id WHERE cp.approval_status = 'pending' ${demoCond('u')}`
        )
        .get() as { c: number }
    ).c;
    const servicesCount = (
      db.prepare(`SELECT COUNT(*) as c FROM services WHERE is_active = 1 ${demoCond()}`).get() as { c: number }
    ).c;

    const bookingsCount = (
      db.prepare(`SELECT COUNT(*) as c FROM bookings WHERE 1=1 ${demoCond()} ${rangeCond('created_at')}`).get(...rangeArgs) as {
        c: number;
      }
    ).c;
    const pendingBookingsCount = (
      db
        .prepare(
          `SELECT COUNT(*) as c FROM bookings WHERE status IN ('Pending', 'Under Review', 'Quotation Sent', 'Awaiting Confirmation') ${demoCond()} ${rangeCond('created_at')}`
        )
        .get(...rangeArgs) as { c: number }
    ).c;
    const activeProjectsCount = (
      db.prepare(`SELECT COUNT(*) as c FROM projects WHERE status != 'Completed' ${demoCond()} ${rangeCond('created_at')}`).get(...rangeArgs) as {
        c: number;
      }
    ).c;
    const completedProjectsCount = (
      db.prepare(`SELECT COUNT(*) as c FROM projects WHERE status = 'Completed' ${demoCond()} ${rangeCond('updated_at')}`).get(...rangeArgs) as {
        c: number;
      }
    ).c;

    const totalProjectsInRange = activeProjectsCount + completedProjectsCount;
    const completionRatePct = totalProjectsInRange > 0 ? Math.round((completedProjectsCount / totalProjectsInRange) * 100) : 0;

    const txAgg = db
      .prepare(`
        SELECT
          COUNT(CASE WHEN status = 'Successful' THEN 1 END) as successful_count,
          COALESCE(SUM(CASE WHEN status = 'Successful' THEN total_payable_inr ELSE 0 END), 0) as gross_revenue,
          COALESCE(SUM(CASE WHEN status = 'Successful' THEN commission_amount_inr ELSE 0 END), 0) as platform_commission,
          COALESCE(SUM(CASE WHEN status = 'Successful' THEN consultant_earning_inr ELSE 0 END), 0) as consultant_earnings,
          COALESCE(SUM(CASE WHEN status IN ('Pending', 'Initiated') THEN total_payable_inr ELSE 0 END), 0) as pending_payments,
          COALESCE(SUM(CASE WHEN status IN ('Refunded', 'Partially Refunded') THEN refund_amount_inr ELSE 0 END), 0) as refunds_total
        FROM transactions
        WHERE 1=1 ${demoCond()} ${rangeCond('created_at')}
      `)
      .get(...rangeArgs) as Record<string, number>;

    const expDateCond = hasRange ? ' AND expense_date >= ? AND expense_date <= ? ' : '';
    const expArgs = hasRange ? [fromIso!.slice(0, 10), toIso!.slice(0, 10)] : [];
    const expensesTotal = (
      db.prepare(`SELECT COALESCE(SUM(amount_inr), 0) as total FROM operating_expenses WHERE 1=1 ${expDateCond}`).get(...expArgs) as {
        total: number;
      }
    ).total;

    const subAgg = db
      .prepare(
        `SELECT COUNT(*) as active_count, COALESCE(SUM(monthly_price_inr), 0) as mrr_inr FROM subscriptions WHERE status = 'Active' ${demoCond()}`
      )
      .get() as { active_count: number; mrr_inr: number };

    const serviceBreakdown = db
      .prepare(`
        SELECT s.title, c.name as category_name, COUNT(b.id) as bookings_count,
               COALESCE(SUM(CASE WHEN t.status = 'Successful' THEN t.total_payable_inr ELSE 0 END), 0) as revenue_inr
        FROM services s
        JOIN service_categories c ON s.category_id = c.id
        LEFT JOIN bookings b ON s.id = b.service_id ${includeDemo ? '' : 'AND COALESCE(b.is_demo, 0) = 0'} ${hasRange ? 'AND b.created_at >= ? AND b.created_at <= ?' : ''}
        LEFT JOIN transactions t ON b.id = t.booking_id ${includeDemo ? '' : 'AND COALESCE(t.is_demo, 0) = 0'} ${hasRange ? 'AND t.created_at >= ? AND t.created_at <= ?' : ''}
        WHERE 1=1 ${demoCond('s')}
        GROUP BY s.id
        HAVING bookings_count > 0
        ORDER BY revenue_inr DESC, bookings_count DESC
      `)
      .all(...(hasRange ? [...rangeArgs, ...rangeArgs] : []));

    const categoryPerformance = db
      .prepare(`
        SELECT c.id, c.name, COUNT(b.id) as bookings_count,
               COALESCE(SUM(CASE WHEN t.status = 'Successful' THEN t.total_payable_inr ELSE 0 END), 0) as revenue_inr,
               COALESCE(SUM(CASE WHEN t.status = 'Successful' THEN t.commission_amount_inr ELSE 0 END), 0) as commission_inr
        FROM service_categories c
        LEFT JOIN services s ON c.id = s.category_id ${includeDemo ? '' : 'AND COALESCE(s.is_demo, 0) = 0'}
        LEFT JOIN bookings b ON s.id = b.service_id ${includeDemo ? '' : 'AND COALESCE(b.is_demo, 0) = 0'} ${hasRange ? 'AND b.created_at >= ? AND b.created_at <= ?' : ''}
        LEFT JOIN transactions t ON b.id = t.booking_id ${includeDemo ? '' : 'AND COALESCE(t.is_demo, 0) = 0'} ${hasRange ? 'AND t.created_at >= ? AND t.created_at <= ?' : ''}
        GROUP BY c.id
        HAVING bookings_count > 0
        ORDER BY revenue_inr DESC, bookings_count DESC
      `)
      .all(...(hasRange ? [...rangeArgs, ...rangeArgs] : []));

    const monthlyRevenueSeries = db
      .prepare(`
        SELECT substr(created_at, 1, 7) as month,
               COALESCE(SUM(CASE WHEN status = 'Successful' THEN total_payable_inr ELSE 0 END), 0) as revenue_inr,
               COALESCE(SUM(CASE WHEN status = 'Successful' THEN commission_amount_inr ELSE 0 END), 0) as commission_inr,
               COALESCE(SUM(CASE WHEN status = 'Successful' THEN consultant_earning_inr ELSE 0 END), 0) as payout_inr,
               COUNT(*) as tx_count
        FROM transactions
        WHERE 1=1 ${demoCond()} ${rangeCond('created_at')}
        GROUP BY substr(created_at, 1, 7)
        ORDER BY month ASC
      `)
      .all(...rangeArgs);

    const bookingTrends = db
      .prepare(`
        SELECT substr(created_at, 1, 10) as date,
               COUNT(*) as total_bookings,
               SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) as completed_bookings
        FROM bookings
        WHERE 1=1 ${demoCond()} ${rangeCond('created_at')}
        GROUP BY substr(created_at, 1, 10)
        ORDER BY date ASC
        LIMIT 30
      `)
      .all(...rangeArgs);

    const customerGrowthSeries = db
      .prepare(`
        SELECT substr(created_at, 1, 7) as month,
               COUNT(*) as registrations
        FROM users
        WHERE role = 'customer' ${demoCond()} ${rangeCond('created_at')}
        GROUP BY substr(created_at, 1, 7)
        ORDER BY month ASC
      `)
      .all(...rangeArgs);

    const consultantBreakdown = db
      .prepare(`
        SELECT u.id, u.full_name, u.is_demo, cp.completed_count, cp.rating_avg, cp.specialisation,
               COALESCE(SUM(CASE WHEN t.status = 'Successful' THEN t.consultant_earning_inr ELSE 0 END), 0) as earned_inr
        FROM users u
        JOIN consultant_profiles cp ON u.id = cp.user_id
        LEFT JOIN transactions t ON u.id = t.consultant_id ${includeDemo ? '' : 'AND COALESCE(t.is_demo, 0) = 0'} ${hasRange ? 'AND t.created_at >= ? AND t.created_at <= ?' : ''}
        WHERE u.role = 'consultant' ${demoCond('u')}
        GROUP BY u.id
        ORDER BY earned_inr DESC, cp.completed_count DESC
      `)
      .all(...rangeArgs);

    const recentRegistrations = db
      .prepare(`
        SELECT u.id, u.full_name, u.email, u.role, u.status, u.is_demo, u.created_at,
               cust.business_name, cons.approval_status, cons.university
        FROM users u
        LEFT JOIN customer_profiles cust ON u.id = cust.user_id
        LEFT JOIN consultant_profiles cons ON u.id = cons.user_id
        WHERE u.role IN ('customer', 'consultant') ${demoCond('u')}
        ORDER BY u.created_at DESC
        LIMIT 8
      `)
      .all();

    const recentBookings = db
      .prepare(`
        SELECT b.id, b.status, b.quoted_price_inr, b.is_demo, b.created_at,
               s.title as service_title, cu.full_name as customer_name, cp.business_name
        FROM bookings b
        JOIN services s ON b.service_id = s.id
        JOIN users cu ON b.customer_id = cu.id
        LEFT JOIN customer_profiles cp ON cu.id = cp.user_id
        WHERE 1=1 ${demoCond('b')}
        ORDER BY b.created_at DESC
        LIMIT 8
      `)
      .all();

    const recentActivities = db
      .prepare(`
        SELECT a.id, a.action, a.target_type, a.target_id, a.created_at,
               u.full_name as actor_name, a.actor_role
        FROM audit_logs a
        LEFT JOIN users u ON a.actor_id = u.id
        ORDER BY a.created_at DESC
        LIMIT 12
      `)
      .all();

    const demoSummary = {
      customers: (db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'customer' AND is_demo = 1").get() as { c: number }).c,
      consultants: (db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'consultant' AND is_demo = 1").get() as { c: number }).c,
      approvedConsultants: (
        db
          .prepare(
            "SELECT COUNT(*) as c FROM users u JOIN consultant_profiles cp ON u.id = cp.user_id WHERE u.role = 'consultant' AND u.is_demo = 1 AND cp.approval_status = 'approved'"
          )
          .get() as { c: number }
      ).c,
      pendingConsultants: (
        db
          .prepare(
            "SELECT COUNT(*) as c FROM users u JOIN consultant_profiles cp ON u.id = cp.user_id WHERE u.role = 'consultant' AND u.is_demo = 1 AND cp.approval_status = 'pending'"
          )
          .get() as { c: number }
      ).c,
      services: (db.prepare('SELECT COUNT(*) as c FROM services WHERE is_demo = 1').get() as { c: number }).c,
      bookings: (db.prepare('SELECT COUNT(*) as c FROM bookings WHERE is_demo = 1').get() as { c: number }).c,
      revenueInr: (
        db
          .prepare("SELECT COALESCE(SUM(CASE WHEN status = 'Successful' THEN total_payable_inr ELSE 0 END), 0) as r FROM transactions WHERE is_demo = 1")
          .get() as { r: number }
      ).r,
    };

    const newsletterCount = (db.prepare('SELECT COUNT(*) as c FROM newsletter_subscribers').get() as { c: number }).c;
    const contactsCount = (db.prepare('SELECT COUNT(*) as c FROM contact_inquiries').get() as { c: number }).c;

    const avgOrderValueInr =
      (txAgg.successful_count || 0) > 0 ? Math.round((txAgg.gross_revenue || 0) / txAgg.successful_count) : 0;

    res.json({
      filterApplied: { range, from: fromIso, to: toIso, includeDemo },
      kpis: {
        totalCustomers: customersCount,
        totalConsultants: consultantsCount,
        approvedConsultants,
        pendingConsultantApprovals: pendingConsultants,
        totalServices: servicesCount,
        totalBookings: bookingsCount,
        pendingBookings: pendingBookingsCount,
        activeProjects: activeProjectsCount,
        completedProjects: completedProjectsCount,
        completionRatePct,
        grossRevenueInr: txAgg.gross_revenue || 0,
        platformCommissionInr: txAgg.platform_commission || 0,
        consultantEarningsInr: txAgg.consultant_earnings || 0,
        pendingPaymentsInr: txAgg.pending_payments || 0,
        refundsInr: txAgg.refunds_total || 0,
        operatingExpensesInr: expensesTotal || 0,
        netOperatingSurplusInr: (txAgg.platform_commission || 0) - (expensesTotal || 0),
        averageOrderValueInr: avgOrderValueInr,
        activeSubscriptions: subAgg.active_count || 0,
        activeRetainerMrrInr: subAgg.mrr_inr || 0,
        newsletterSubscribers: newsletterCount,
        contactInquiries: contactsCount,
      },
      demoSummary,
      serviceBreakdown,
      categoryPerformance,
      monthlyRevenueSeries,
      bookingTrends,
      customerGrowthSeries,
      consultantBreakdown,
      recentRegistrations,
      recentBookings,
      recentActivities,
    });
  });

  // ---------------- ADMIN USER, CUSTOMER & CONSULTANT MANAGEMENT ----------------
  app.get('/api/admin/users', requireAuth, requireRoles('admin', 'super_admin'), (_req: AuthenticatedRequest, res) => {
    const users = db
      .prepare(`
        SELECT u.id, u.email, u.role, u.full_name, u.mobile, u.status, u.email_verified, u.is_demo, u.created_at,
               cust.business_name, cust.business_category, cust.address, cust.gstin,
               cons.student_id, cons.university, cons.course, cons.qualification, cons.specialisation,
               cons.skills_json, cons.experience, cons.portfolio_url, cons.certifications_text,
               cons.approval_status, cons.rejection_reason, cons.availability_status,
               cons.rating_avg, cons.completed_count, cons.resume_doc_id, cons.id_doc_id,
               rd.file_name as resume_file_name,
               idd.file_name as id_doc_file_name,
               (SELECT COUNT(*) FROM bookings b WHERE b.customer_id = u.id) as customer_bookings_count,
               COALESCE((SELECT SUM(t.total_payable_inr) FROM transactions t WHERE t.customer_id = u.id AND t.status = 'Successful'), 0) as customer_paid_inr,
               (SELECT COUNT(*) FROM projects p WHERE p.consultant_id = u.id) as consultant_projects_count,
               COALESCE((SELECT SUM(t.consultant_earning_inr) FROM transactions t WHERE t.consultant_id = u.id AND t.status = 'Successful'), 0) as consultant_earned_inr
        FROM users u
        LEFT JOIN customer_profiles cust ON u.id = cust.user_id
        LEFT JOIN consultant_profiles cons ON u.id = cons.user_id
        LEFT JOIN documents rd ON cons.resume_doc_id = rd.id
        LEFT JOIN documents idd ON cons.id_doc_id = idd.id
        ORDER BY u.created_at DESC
      `)
      .all();
    const inquiries = db.prepare('SELECT * FROM contact_inquiries ORDER BY created_at DESC LIMIT 50').all();
    res.json({ users, inquiries });
  });

  // Create Customer (Admin / Super Admin)
  app.post('/api/admin/customers', requireAuth, requireRoles('admin', 'super_admin'), (req: AuthenticatedRequest, res) => {
    const body = req.body as Record<string, unknown>;
    const fullName = String(body.fullName || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const mobile = String(body.mobile || '').trim();
    const password = String(body.password || 'Customer@123');
    const businessName = String(body.businessName || '').trim();
    const businessCategory = String(body.businessCategory || '').trim();
    const address = String(body.address || '').trim();
    const gstin = String(body.gstin || '').trim();

    if (fullName.length < 2 || !email.includes('@') || mobile.length < 8 || password.length < 8) {
      res.status(400).json({ error: 'Valid full name, email, mobile (8+ digits), and password (8+ chars) are required.' });
      return;
    }
    if (!businessName || !businessCategory || !address) {
      res.status(400).json({ error: 'Business name, business category, and Dehradun address are required.' });
      return;
    }
    const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(email);
    if (existing) {
      res.status(409).json({ error: 'An account with this email address already exists.' });
      return;
    }

    const userId = `cust-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    db.exec('BEGIN');
    try {
      db.prepare(`
        INSERT INTO users (id, email, password_hash, role, full_name, mobile, status, email_verified, is_demo, created_at, updated_at)
        VALUES (?, ?, ?, 'customer', ?, ?, 'active', 1, 0, ?, ?)
      `).run(userId, email, hashPassword(password), fullName, mobile, now, now);

      db.prepare(`
        INSERT INTO customer_profiles (user_id, business_name, business_category, address, gstin, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(userId, businessName, businessCategory, address, gstin, now, now);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    logAudit(req.auth!.userId, req.auth!.role, 'CUSTOMER_CREATED_BY_ADMIN', 'user', userId, { email, businessName }, req.ip);
    res.status(201).json({ id: userId });
  });

  // View Full Customer Profile + Booking History + Payment History
  app.get('/api/admin/customers/:id', requireAuth, requireRoles('admin', 'super_admin'), (req, res) => {
    const customer = db
      .prepare(`
        SELECT u.id, u.email, u.role, u.full_name, u.mobile, u.status, u.email_verified, u.is_demo, u.created_at,
               cp.business_name, cp.business_category, cp.address, cp.gstin
        FROM users u
        LEFT JOIN customer_profiles cp ON u.id = cp.user_id
        WHERE u.id = ? AND u.role = 'customer'
      `)
      .get(req.params.id);

    if (!customer) {
      res.status(404).json({ error: 'Customer not found.' });
      return;
    }

    const bookings = db
      .prepare(`
        SELECT b.*, s.title as service_title, co.full_name as assigned_consultant_name
        FROM bookings b
        JOIN services s ON b.service_id = s.id
        LEFT JOIN users co ON b.assigned_consultant_id = co.id
        WHERE b.customer_id = ?
        ORDER BY b.created_at DESC
      `)
      .all(req.params.id);

    const transactions = db
      .prepare(`
        SELECT t.*, s.title as service_title
        FROM transactions t
        JOIN bookings b ON t.booking_id = b.id
        JOIN services s ON b.service_id = s.id
        WHERE t.customer_id = ?
        ORDER BY t.created_at DESC
      `)
      .all(req.params.id);

    res.json({ customer, bookings, transactions });
  });

  // Edit Customer
  app.patch('/api/admin/customers/:id', requireAuth, requireRoles('admin', 'super_admin'), (req: AuthenticatedRequest, res) => {
    const existing = db
      .prepare("SELECT u.*, cp.business_name, cp.business_category, cp.address, cp.gstin FROM users u LEFT JOIN customer_profiles cp ON u.id = cp.user_id WHERE u.id = ? AND u.role = 'customer'")
      .get(req.params.id) as Record<string, unknown> | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Customer not found.' });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const fullName = body.fullName !== undefined ? String(body.fullName).trim() : String(existing.full_name);
    const mobile = body.mobile !== undefined ? String(body.mobile).trim() : String(existing.mobile);
    const status = body.status && ['active', 'suspended'].includes(String(body.status)) ? String(body.status) : String(existing.status);
    const businessName = body.businessName !== undefined ? String(body.businessName).trim() : String(existing.business_name || '');
    const businessCategory = body.businessCategory !== undefined ? String(body.businessCategory).trim() : String(existing.business_category || '');
    const address = body.address !== undefined ? String(body.address).trim() : String(existing.address || '');
    const gstin = body.gstin !== undefined ? String(body.gstin).trim() : String(existing.gstin || '');

    if (!fullName || !mobile || !businessName) {
      res.status(400).json({ error: 'Customer name, mobile, and business name are required.' });
      return;
    }

    const now = new Date().toISOString();
    db.exec('BEGIN');
    try {
      db.prepare('UPDATE users SET full_name = ?, mobile = ?, status = ?, updated_at = ? WHERE id = ?').run(
        fullName,
        mobile,
        status,
        now,
        req.params.id
      );
      db.prepare(
        'UPDATE customer_profiles SET business_name = ?, business_category = ?, address = ?, gstin = ?, updated_at = ? WHERE user_id = ?'
      ).run(businessName, businessCategory, address, gstin, now, req.params.id);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    logAudit(req.auth!.userId, req.auth!.role, 'CUSTOMER_UPDATED', 'user', req.params.id, { fullName, businessName, status }, req.ip);
    res.json({ ok: true });
  });

  // Delete Customer (with force confirmation support & safe cascading cleanup)
  app.delete('/api/admin/customers/:id', requireAuth, requireRoles('admin', 'super_admin'), (req: AuthenticatedRequest, res) => {
    const existing = db.prepare("SELECT id, email, full_name, is_demo FROM users WHERE id = ? AND role = 'customer'").get(req.params.id) as
      | { id: string; email: string; full_name: string; is_demo: number }
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Customer account not found.' });
      return;
    }

    const bookingsCount = (db.prepare('SELECT COUNT(*) as c FROM bookings WHERE customer_id = ?').get(existing.id) as { c: number }).c;
    const txCount = (db.prepare('SELECT COUNT(*) as c FROM transactions WHERE customer_id = ?').get(existing.id) as { c: number }).c;
    const force = req.query.force === '1';

    if ((bookingsCount > 0 || txCount > 0) && !force && existing.is_demo !== 1) {
      res.status(409).json({
        error: `Customer has ${bookingsCount} bookings and ${txCount} transactions. Pass force=1 to confirm cascade deletion, or suspend the account instead.`,
      });
      return;
    }

    const docFiles = db.prepare('SELECT storage_path FROM documents WHERE owner_id = ?').all(existing.id) as { storage_path: string }[];

    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM invoices WHERE customer_id = ?').run(existing.id);
      db.prepare('DELETE FROM transactions WHERE customer_id = ?').run(existing.id);
      db.prepare('DELETE FROM reviews WHERE customer_id = ?').run(existing.id);
      db.prepare('DELETE FROM project_tasks WHERE project_id IN (SELECT id FROM projects WHERE customer_id = ?)').run(existing.id);
      db.prepare('DELETE FROM project_milestones WHERE project_id IN (SELECT id FROM projects WHERE customer_id = ?)').run(existing.id);
      db.prepare('DELETE FROM projects WHERE customer_id = ?').run(existing.id);
      db.prepare('DELETE FROM quotations WHERE customer_id = ?').run(existing.id);
      db.prepare('DELETE FROM bookings WHERE customer_id = ?').run(existing.id);
      db.prepare('DELETE FROM subscriptions WHERE customer_id = ?').run(existing.id);
      db.prepare('DELETE FROM support_messages WHERE ticket_id IN (SELECT id FROM support_tickets WHERE user_id = ?)').run(existing.id);
      db.prepare('DELETE FROM support_tickets WHERE user_id = ?').run(existing.id);
      db.prepare('DELETE FROM messages WHERE sender_id = ? OR conversation_id IN (SELECT id FROM conversations WHERE participant_a = ? OR participant_b = ?)').run(existing.id, existing.id, existing.id);
      db.prepare('DELETE FROM conversations WHERE participant_a = ? OR participant_b = ?').run(existing.id, existing.id);
      db.prepare('DELETE FROM documents WHERE owner_id = ?').run(existing.id);
      db.prepare('DELETE FROM notifications WHERE user_id = ?').run(existing.id);
      db.prepare('DELETE FROM customer_profiles WHERE user_id = ?').run(existing.id);
      db.prepare('DELETE FROM users WHERE id = ?').run(existing.id);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    for (const f of docFiles) {
      const fp = path.join(STORAGE_UPLOAD_DIR, f.storage_path);
      if (fs.existsSync(fp)) {
        try {
          fs.unlinkSync(fp);
        } catch {
          // ignore cleanup warning
        }
      }
    }

    logAudit(req.auth!.userId, req.auth!.role, 'CUSTOMER_DELETED', 'user', existing.id, { email: existing.email, force }, req.ip);
    res.json({ ok: true });
  });

  // View Full Consultant Profile + Documents + Assigned Projects + Performance
  app.get('/api/admin/consultants/:id', requireAuth, requireRoles('admin', 'super_admin'), (req, res) => {
    const consultant = db
      .prepare(`
        SELECT u.id, u.email, u.role, u.full_name, u.mobile, u.status, u.email_verified, u.is_demo, u.created_at,
               cp.*, rd.file_name as resume_file_name, idd.file_name as id_doc_file_name
        FROM users u
        JOIN consultant_profiles cp ON u.id = cp.user_id
        LEFT JOIN documents rd ON cp.resume_doc_id = rd.id
        LEFT JOIN documents idd ON cp.id_doc_id = idd.id
        WHERE u.id = ? AND u.role = 'consultant'
      `)
      .get(req.params.id);

    if (!consultant) {
      res.status(404).json({ error: 'Consultant not found.' });
      return;
    }

    const projects = db
      .prepare(`
        SELECT p.*, s.title as service_title, cu.full_name as customer_name, cprof.business_name
        FROM projects p
        JOIN services s ON p.service_id = s.id
        JOIN users cu ON p.customer_id = cu.id
        LEFT JOIN customer_profiles cprof ON cu.id = cprof.user_id
        WHERE p.consultant_id = ?
        ORDER BY p.updated_at DESC
      `)
      .all(req.params.id);

    const documents = db
      .prepare('SELECT id, category, file_name, mime_type, size_bytes, visibility, created_at FROM documents WHERE owner_id = ? ORDER BY created_at DESC')
      .all(req.params.id);

    const transactions = db
      .prepare(`
        SELECT t.*, s.title as service_title
        FROM transactions t
        JOIN bookings b ON t.booking_id = b.id
        JOIN services s ON b.service_id = s.id
        WHERE t.consultant_id = ?
        ORDER BY t.created_at DESC
      `)
      .all(req.params.id);

    const payouts = db.prepare('SELECT * FROM payouts WHERE consultant_id = ? ORDER BY created_at DESC').all(req.params.id);

    res.json({ consultant, projects, documents, transactions, payouts });
  });

  // Edit Consultant Details (Admin / Super Admin)
  app.patch('/api/admin/consultants/:id', requireAuth, requireRoles('admin', 'super_admin'), (req: AuthenticatedRequest, res) => {
    const existing = db
      .prepare("SELECT u.*, cp.student_id, cp.university, cp.course, cp.qualification, cp.specialisation, cp.skills_json, cp.experience, cp.portfolio_url, cp.certifications_text, cp.availability_status FROM users u JOIN consultant_profiles cp ON u.id = cp.user_id WHERE u.id = ? AND u.role = 'consultant'")
      .get(req.params.id) as Record<string, unknown> | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Consultant not found.' });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const fullName = body.fullName !== undefined ? String(body.fullName).trim() : String(existing.full_name);
    const mobile = body.mobile !== undefined ? String(body.mobile).trim() : String(existing.mobile);
    const status = body.status && ['active', 'suspended'].includes(String(body.status)) ? String(body.status) : String(existing.status);
    const studentId = body.studentId !== undefined ? String(body.studentId).trim() : String(existing.student_id || '');
    const university = body.university !== undefined ? String(body.university).trim() : String(existing.university || '');
    const course = body.course !== undefined ? String(body.course).trim() : String(existing.course || '');
    const qualification = body.qualification !== undefined ? String(body.qualification).trim() : String(existing.qualification || '');
    const specialisation = body.specialisation !== undefined ? String(body.specialisation).trim() : String(existing.specialisation || '');
    const experience = body.experience !== undefined ? String(body.experience).trim() : String(existing.experience || '');
    const portfolioUrl = body.portfolioUrl !== undefined ? String(body.portfolioUrl).trim() : String(existing.portfolio_url || '');
    const certificationsText = body.certificationsText !== undefined ? String(body.certificationsText).trim() : String(existing.certifications_text || '');
    const availabilityStatus =
      body.availabilityStatus && ['available', 'busy', 'unavailable'].includes(String(body.availabilityStatus))
        ? String(body.availabilityStatus)
        : String(existing.availability_status || 'available');

    let skillsJson = String(existing.skills_json || '[]');
    if (body.skills !== undefined) {
      const list = Array.isArray(body.skills)
        ? body.skills.map((s) => String(s).trim()).filter(Boolean)
        : String(body.skills)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
      skillsJson = JSON.stringify(list);
    }

    if (!fullName || !mobile || !university || !specialisation) {
      res.status(400).json({ error: 'Full name, mobile, college/university, and specialisation are required.' });
      return;
    }

    const now = new Date().toISOString();
    db.exec('BEGIN');
    try {
      db.prepare('UPDATE users SET full_name = ?, mobile = ?, status = ?, updated_at = ? WHERE id = ?').run(
        fullName,
        mobile,
        status,
        now,
        req.params.id
      );
      db.prepare(`
        UPDATE consultant_profiles
        SET student_id = ?, university = ?, course = ?, qualification = ?, specialisation = ?,
            skills_json = ?, experience = ?, portfolio_url = ?, certifications_text = ?,
            availability_status = ?, updated_at = ?
        WHERE user_id = ?
      `).run(
        studentId,
        university,
        course,
        qualification,
        specialisation,
        skillsJson,
        experience,
        portfolioUrl,
        certificationsText,
        availabilityStatus,
        now,
        req.params.id
      );
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    logAudit(req.auth!.userId, req.auth!.role, 'CONSULTANT_UPDATED', 'consultant', req.params.id, { fullName, specialisation, status }, req.ip);
    res.json({ ok: true });
  });

  app.patch('/api/admin/consultants/:id/approval', requireAuth, requireRoles('admin', 'super_admin'), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const body = req.body as Record<string, unknown>;
    const status = String(body.approvalStatus || '');
    const rejectionReason = String(body.rejectionReason || '').trim();

    if (!['approved', 'rejected', 'pending'].includes(status)) {
      res.status(400).json({ error: 'Invalid approval status.' });
      return;
    }
    if (status === 'rejected' && !rejectionReason) {
      res.status(400).json({ error: 'Please enter a rejection reason so the applicant receives clear feedback.' });
      return;
    }

    const exists = db.prepare('SELECT user_id FROM consultant_profiles WHERE user_id = ?').get(req.params.id);
    if (!exists) {
      res.status(404).json({ error: 'Consultant profile not found.' });
      return;
    }

    const storedReason = status === 'rejected' ? rejectionReason : '';
    db.prepare('UPDATE consultant_profiles SET approval_status = ?, rejection_reason = ?, updated_at = ? WHERE user_id = ?').run(
      status,
      storedReason,
      new Date().toISOString(),
      req.params.id
    );

    createNotification(
      req.params.id,
      'consultant_approval',
      status === 'approved'
        ? 'Consultant Profile Approved'
        : status === 'rejected'
        ? 'Consultant Application Rejected'
        : 'Consultant Application Under Review',
      status === 'approved'
        ? 'Your credentials have been verified. Your full Student Consultant dashboard and project assignments are now unlocked.'
        : status === 'rejected'
        ? `Your application was not approved. Reason: ${rejectionReason}`
        : 'Your verification status is now: pending.',
      'overview'
    );
    logAudit(auth.userId, auth.role, 'CONSULTANT_APPROVAL_UPDATED', 'consultant', req.params.id, { status, rejectionReason: storedReason }, req.ip);
    res.json({ ok: true });
  });

  app.patch('/api/admin/users/:id/status', requireAuth, requireRoles('admin', 'super_admin'), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const target = db.prepare('SELECT id, role FROM users WHERE id = ?').get(req.params.id) as
      | { id: string; role: UserRole }
      | undefined;
    if (!target) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    if ((target.role === 'admin' || target.role === 'super_admin') && auth.role !== 'super_admin') {
      res.status(403).json({ error: 'Only Super Admin can suspend or reactivate administrative accounts.' });
      return;
    }
    if (target.id === auth.userId) {
      res.status(400).json({ error: 'You cannot suspend your own active session account.' });
      return;
    }
    const status = String((req.body as Record<string, unknown>).status || '');
    if (!['active', 'suspended'].includes(status)) {
      res.status(400).json({ error: 'Invalid account status.' });
      return;
    }
    db.prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ?').run(status, new Date().toISOString(), target.id);
    logAudit(auth.userId, auth.role, 'USER_STATUS_CHANGED', 'user', target.id, { status }, req.ip);
    res.json({ ok: true });
  });

  // ---------------- SERVICE & CATEGORY CRUD ----------------
  app.get('/api/admin/catalog', requireAuth, requireRoles('admin', 'super_admin'), (_req, res) => {
    const categories = db.prepare('SELECT * FROM service_categories ORDER BY sort_order ASC').all();
    const services = db
      .prepare(`
        SELECT s.*, c.name as category_name, c.slug as category_slug, c.image_url as category_image_url
        FROM services s
        JOIN service_categories c ON s.category_id = c.id
        ORDER BY s.created_at DESC
      `)
      .all();
    res.json({ categories, services });
  });

  app.post('/api/admin/categories', requireAuth, requireRoles('admin', 'super_admin'), (req: AuthenticatedRequest, res) => {
    const body = req.body as Record<string, unknown>;
    const name = String(body.name || '').trim();
    const description = String(body.description || '').trim();
    const imageUrl = String(body.imageUrl || '').trim();
    if (!name || !description) {
      res.status(400).json({ error: 'Category name and description are required.' });
      return;
    }
    const duplicate = db.prepare('SELECT id FROM service_categories WHERE LOWER(name) = LOWER(?)').get(name);
    if (duplicate) {
      res.status(409).json({ error: 'A category with this name already exists.' });
      return;
    }
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const id = `cat-${crypto.randomUUID().slice(0, 8)}`;
    db.prepare('INSERT INTO service_categories (id, name, slug, description, sort_order, is_active, image_url) VALUES (?, ?, ?, ?, 99, 1, ?)').run(
      id,
      name,
      slug,
      description,
      imageUrl
    );
    const category = db.prepare('SELECT * FROM service_categories WHERE id = ?').get(id);
    logAudit(req.auth!.userId, req.auth!.role, 'CATEGORY_CREATED', 'category', id, { name }, req.ip);
    res.status(201).json({ id, category });
  });

  app.patch('/api/admin/categories/:id', requireAuth, requireRoles('admin', 'super_admin'), (req: AuthenticatedRequest, res) => {
    const existing = db.prepare('SELECT * FROM service_categories WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Category not found.' });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const name = body.name !== undefined && String(body.name).trim() ? String(body.name).trim() : String(existing.name);
    const description = body.description !== undefined && String(body.description).trim() ? String(body.description).trim() : String(existing.description);
    const isActive = body.isActive !== undefined ? (body.isActive ? 1 : 0) : Number(existing.is_active);
    const imageUrl = body.imageUrl !== undefined ? String(body.imageUrl).trim() : String(existing.image_url || '');
    db.prepare('UPDATE service_categories SET name = ?, description = ?, is_active = ?, image_url = ? WHERE id = ?').run(
      name,
      description,
      isActive,
      imageUrl,
      req.params.id
    );
    const category = db.prepare('SELECT * FROM service_categories WHERE id = ?').get(req.params.id);
    logAudit(req.auth!.userId, req.auth!.role, 'CATEGORY_UPDATED', 'category', req.params.id, { name, isActive }, req.ip);
    res.json({ ok: true, category });
  });

  app.delete('/api/admin/categories/:id', requireAuth, requireRoles('admin', 'super_admin'), (req: AuthenticatedRequest, res) => {
    const inUse = (db.prepare('SELECT COUNT(*) as c FROM services WHERE category_id = ?').get(req.params.id) as { c: number }).c;
    if (inUse > 0) {
      res.status(409).json({ error: 'Cannot delete a category that still contains service listings. Reassign or deactivate instead.' });
      return;
    }
    db.prepare('DELETE FROM service_categories WHERE id = ?').run(req.params.id);
    logAudit(req.auth!.userId, req.auth!.role, 'CATEGORY_DELETED', 'category', req.params.id, {}, req.ip);
    res.json({ ok: true });
  });

  app.post('/api/admin/services', requireAuth, requireRoles('admin', 'super_admin'), (req: AuthenticatedRequest, res) => {
    const body = req.body as Record<string, unknown>;
    const categoryId = String(body.categoryId || '').trim();
    const title = String(body.title || '').trim();
    const shortDescription = String(body.shortDescription || '').trim();
    const description = String(body.description || '').trim();
    const priceInr = Number(body.priceInr);
    const packageName = String(body.packageName || 'Standard Package').trim() || 'Standard Package';
    const deliverables = String(body.deliverables || '').trim();
    const estimatedDays = Math.max(1, Number(body.estimatedDays || 7) || 7);
    const requirementsPrompt = String(body.requirementsPrompt || 'Provide relevant business details and files.').trim();
    const revisionPolicy = String(body.revisionPolicy || '2 standard revisions').trim();
    const requiredSkills = String(body.requiredSkills || '').trim();
    const imageUrl = String(body.imageUrl || '').trim();
    const isStartingPrice = body.isStartingPrice === false ? 0 : 1;

    if (!categoryId) {
      res.status(400).json({ error: 'Please select a valid service category.' });
      return;
    }
    if (!title || !description || !deliverables) {
      res.status(400).json({ error: 'Service title, deliverables summary, and description are required.' });
      return;
    }
    if (!Number.isFinite(priceInr) || priceInr < 100) {
      res.status(400).json({ error: 'Please enter a valid positive INR price (minimum ₹100).' });
      return;
    }

    const categoryExists = db
      .prepare('SELECT id, name FROM service_categories WHERE id = ?')
      .get(categoryId) as { id: string; name: string } | undefined;
    if (!categoryExists) {
      res.status(400).json({ error: 'Selected service category does not exist.' });
      return;
    }

    const dupService = db
      .prepare('SELECT id FROM services WHERE LOWER(title) = LOWER(?) AND category_id = ?')
      .get(title, categoryId);
    if (dupService) {
      res.status(409).json({ error: 'A service with this title already exists in the selected category.' });
      return;
    }

    const id = `srv-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO services (
        id, category_id, title, short_description, description, price_inr, package_name,
        deliverables, estimated_days, requirements_prompt, revision_policy, required_skills,
        image_url, is_starting_price, consultant_id, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, ?, ?)
    `).run(
      id,
      categoryId,
      title,
      shortDescription || description.slice(0, 120),
      description,
      Math.round(priceInr),
      packageName,
      deliverables,
      estimatedDays,
      requirementsPrompt,
      revisionPolicy,
      requiredSkills,
      imageUrl,
      isStartingPrice,
      now,
      now
    );

    const createdService = db
      .prepare('SELECT s.*, c.name as category_name, c.slug as category_slug, c.image_url as category_image_url FROM services s JOIN service_categories c ON s.category_id = c.id WHERE s.id = ?')
      .get(id);

    logAudit(req.auth!.userId, req.auth!.role, 'SERVICE_CREATED', 'service', id, { title, priceInr: Math.round(priceInr), categoryId }, req.ip);
    res.status(201).json({ id, service: createdService });
  });

  app.patch('/api/admin/services/:id', requireAuth, requireRoles('admin', 'super_admin'), (req: AuthenticatedRequest, res) => {
    const body = req.body as Record<string, unknown>;
    const existing = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Service not found.' });
      return;
    }

    const categoryId = body.categoryId ? String(body.categoryId).trim() : String(existing.category_id);
    const title = body.title !== undefined ? String(body.title).trim() : String(existing.title);
    const shortDescription = body.shortDescription !== undefined ? String(body.shortDescription).trim() : String(existing.short_description || '');
    const description = body.description !== undefined ? String(body.description).trim() : String(existing.description);
    const deliverables = body.deliverables !== undefined ? String(body.deliverables).trim() : String(existing.deliverables);
    const packageName = body.packageName !== undefined ? String(body.packageName).trim() : String(existing.package_name);
    const estimatedDays = body.estimatedDays !== undefined ? Math.max(1, Number(body.estimatedDays)) : Number(existing.estimated_days);
    const requiredSkills = body.requiredSkills !== undefined ? String(body.requiredSkills).trim() : String(existing.required_skills || '');
    const imageUrl = body.imageUrl !== undefined ? String(body.imageUrl).trim() : String(existing.image_url || '');
    const priceInr = body.priceInr !== undefined ? Number(body.priceInr) : Number(existing.price_inr);
    const isActive = body.isActive !== undefined ? (body.isActive ? 1 : 0) : Number(existing.is_active);
    const isStartingPrice = body.isStartingPrice !== undefined ? (body.isStartingPrice ? 1 : 0) : Number(existing.is_starting_price ?? 1);

    if (!title || !description || !deliverables || !Number.isFinite(priceInr) || priceInr < 100) {
      res.status(400).json({ error: 'Valid title, description, deliverables, and price (₹100+) are required.' });
      return;
    }

    const catRow = db.prepare('SELECT id FROM service_categories WHERE id = ?').get(categoryId);
    if (!catRow) {
      res.status(400).json({ error: 'Selected category does not exist.' });
      return;
    }

    db.prepare(`
      UPDATE services
      SET category_id = ?, title = ?, short_description = ?, description = ?, price_inr = ?,
          package_name = ?, deliverables = ?, estimated_days = ?, required_skills = ?,
          image_url = ?, is_starting_price = ?, is_active = ?, updated_at = ?
      WHERE id = ?
    `).run(
      categoryId,
      title,
      shortDescription,
      description,
      Math.round(priceInr),
      packageName,
      deliverables,
      estimatedDays,
      requiredSkills,
      imageUrl,
      isStartingPrice,
      isActive,
      new Date().toISOString(),
      req.params.id
    );

    const updatedService = db
      .prepare('SELECT s.*, c.name as category_name, c.slug as category_slug, c.image_url as category_image_url FROM services s JOIN service_categories c ON s.category_id = c.id WHERE s.id = ?')
      .get(req.params.id);

    logAudit(req.auth!.userId, req.auth!.role, 'SERVICE_UPDATED', 'service', req.params.id, { title, priceInr: Math.round(priceInr), isActive }, req.ip);
    res.json({ ok: true, service: updatedService });
  });

  app.delete('/api/admin/services/:id', requireAuth, requireRoles('admin', 'super_admin'), (req: AuthenticatedRequest, res) => {
    const existing = db.prepare('SELECT id, title FROM services WHERE id = ?').get(req.params.id) as { id: string; title: string } | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Service listing not found.' });
      return;
    }
    const bookingCount = (db.prepare('SELECT COUNT(*) as c FROM bookings WHERE service_id = ?').get(req.params.id) as { c: number }).c;
    const projectCount = (db.prepare('SELECT COUNT(*) as c FROM projects WHERE service_id = ?').get(req.params.id) as { c: number }).c;
    if (bookingCount > 0 || projectCount > 0) {
      res.status(409).json({
        error: 'Cannot delete a service linked to existing bookings or projects. Deactivate it instead to preserve customer audit history.',
      });
      return;
    }

    db.prepare('DELETE FROM services WHERE id = ?').run(req.params.id);
    logAudit(req.auth!.userId, req.auth!.role, 'SERVICE_DELETED', 'service', req.params.id, { title: existing.title }, req.ip);
    res.json({ ok: true });
  });

  // ---------------- SUBSCRIPTIONS & RETAINERS (SUPER ADMIN) ----------------
  app.get('/api/superadmin/subscriptions', requireAuth, requireRoles('admin', 'super_admin'), (_req, res) => {
    const subscriptions = db
      .prepare(`
        SELECT sub.*, cu.full_name as customer_name, cp.business_name, s.title as service_title
        FROM subscriptions sub
        JOIN users cu ON sub.customer_id = cu.id
        LEFT JOIN customer_profiles cp ON cu.id = cp.user_id
        LEFT JOIN services s ON sub.service_id = s.id
        ORDER BY sub.created_at DESC
      `)
      .all();
    res.json({ subscriptions });
  });

  app.post('/api/superadmin/subscriptions', requireAuth, requireRoles('super_admin'), (req: AuthenticatedRequest, res) => {
    const body = req.body as Record<string, unknown>;
    const customerId = String(body.customerId || '').trim();
    const serviceId = body.serviceId ? String(body.serviceId).trim() : null;
    const planName = String(body.planName || '').trim();
    const monthlyPriceInr = Number(body.monthlyPriceInr);
    const nextBillingDate = String(body.nextBillingDate || '').trim();
    const notes = String(body.notes || '').trim();

    if (!customerId || !planName || !Number.isFinite(monthlyPriceInr) || monthlyPriceInr < 100 || !nextBillingDate) {
      res.status(400).json({ error: 'Customer, plan name, monthly price (₹100+), and next billing date are required.' });
      return;
    }

    const cust = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'customer'").get(customerId);
    if (!cust) {
      res.status(404).json({ error: 'Selected customer account not found.' });
      return;
    }

    const id = `ret-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO subscriptions (
        id, customer_id, service_id, plan_name, monthly_price_inr, billing_cycle,
        status, next_billing_date, notes, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'Monthly', 'Active', ?, ?, ?, ?, ?)
    `).run(id, customerId, serviceId || null, planName, Math.round(monthlyPriceInr), nextBillingDate, notes, req.auth!.userId, now, now);

    createNotification(customerId, 'subscription_created', 'Monthly Retainer Activated', `Your recurring "${planName}" plan (₹${Math.round(monthlyPriceInr)}/mo) is now active.`, 'overview');
    logAudit(req.auth!.userId, req.auth!.role, 'SUBSCRIPTION_CREATED', 'subscription', id, { customerId, planName, monthlyPriceInr }, req.ip);
    res.status(201).json({ id });
  });

  app.patch('/api/superadmin/subscriptions/:id', requireAuth, requireRoles('super_admin'), (req: AuthenticatedRequest, res) => {
    const sub = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!sub) {
      res.status(404).json({ error: 'Subscription not found.' });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const status = body.status && ['Active', 'Paused', 'Cancelled'].includes(String(body.status)) ? String(body.status) : String(sub.status);
    const monthlyPriceInr = body.monthlyPriceInr !== undefined ? Math.round(Number(body.monthlyPriceInr)) : Number(sub.monthly_price_inr);
    const nextBillingDate = body.nextBillingDate ? String(body.nextBillingDate) : String(sub.next_billing_date);

    db.prepare('UPDATE subscriptions SET status = ?, monthly_price_inr = ?, next_billing_date = ?, updated_at = ? WHERE id = ?').run(
      status,
      monthlyPriceInr,
      nextBillingDate,
      new Date().toISOString(),
      req.params.id
    );
    logAudit(req.auth!.userId, req.auth!.role, 'SUBSCRIPTION_UPDATED', 'subscription', req.params.id, { status, monthlyPriceInr }, req.ip);
    res.json({ ok: true });
  });

  // ---------------- VENTURE PLAN EDITABLE STRATEGY NOTES (SUPER ADMIN / ADMIN) ----------------
  app.get('/api/superadmin/venture-plan', requireAuth, requireRoles('admin', 'super_admin'), (_req, res) => {
    const notes = db.prepare('SELECT * FROM venture_plan_notes ORDER BY section_key ASC').all();
    const settings = getPlatformSettings();
    const txAgg = db
      .prepare(`
        SELECT
          COALESCE(SUM(CASE WHEN status = 'Successful' THEN total_payable_inr ELSE 0 END), 0) as gross_revenue,
          COALESCE(SUM(CASE WHEN status = 'Successful' THEN commission_amount_inr ELSE 0 END), 0) as platform_commission
        FROM transactions
        WHERE COALESCE(is_demo, 0) = 0
      `)
      .get() as { gross_revenue: number; platform_commission: number };

    const actuals = {
      registeredCustomers: (db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'customer' AND COALESCE(is_demo, 0) = 0").get() as { c: number }).c,
      approvedConsultants: (db.prepare("SELECT COUNT(*) as c FROM consultant_profiles cp JOIN users u ON cp.user_id = u.id WHERE cp.approval_status = 'approved' AND COALESCE(u.is_demo, 0) = 0").get() as { c: number }).c,
      totalBookings: (db.prepare('SELECT COUNT(*) as c FROM bookings WHERE COALESCE(is_demo, 0) = 0').get() as { c: number }).c,
      completedProjects: (db.prepare("SELECT COUNT(*) as c FROM projects WHERE status = 'Completed' AND COALESCE(is_demo, 0) = 0").get() as { c: number }).c,
      activeSubscriptions: (db.prepare("SELECT COUNT(*) as c FROM subscriptions WHERE status = 'Active' AND COALESCE(is_demo, 0) = 0").get() as { c: number }).c,
      grossRevenueInr: txAgg.gross_revenue || 0,
      platformCommissionInr: txAgg.platform_commission || 0,
      configuredCommissionPct: Number(settings.commissionPct ?? 15),
    };
    res.json({ notes, actuals });
  });

  app.patch('/api/superadmin/venture-plan/:sectionKey', requireAuth, requireRoles('super_admin'), (req: AuthenticatedRequest, res) => {
    const sectionKey = String(req.params.sectionKey || '').trim();
    const body = req.body as Record<string, unknown>;
    const existing = db.prepare('SELECT * FROM venture_plan_notes WHERE section_key = ?').get(sectionKey) as Record<string, unknown> | undefined;
    const sectionTitle = String(body.sectionTitle || existing?.section_title || sectionKey).trim();
    const assumptions = String(body.assumptions ?? existing?.assumptions ?? '').trim();
    const targets = String(body.targets ?? existing?.targets ?? '').trim();
    const validationNotes = String(body.validationNotes ?? existing?.validation_notes ?? '').trim();
    const now = new Date().toISOString();

    if (existing) {
      db.prepare(`
        UPDATE venture_plan_notes
        SET section_title = ?, assumptions = ?, targets = ?, validation_notes = ?, updated_by = ?, updated_at = ?
        WHERE section_key = ?
      `).run(sectionTitle, assumptions, targets, validationNotes, req.auth!.fullName, now, sectionKey);
    } else {
      db.prepare(`
        INSERT INTO venture_plan_notes (section_key, section_title, assumptions, targets, validation_notes, updated_by, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(sectionKey, sectionTitle, assumptions, targets, validationNotes, req.auth!.fullName, now);
    }

    logAudit(req.auth!.userId, req.auth!.role, 'VENTURE_PLAN_NOTE_UPDATED', 'venture_plan', sectionKey, { sectionTitle }, req.ip);
    res.json({ ok: true });
  });

  // ---------------- AUDIT LOGS & SUPER ADMIN CONTROLS ----------------
  app.get('/api/admin/audit-logs', requireAuth, requireRoles('admin', 'super_admin'), (_req, res) => {
    const logs = db
      .prepare(`
        SELECT a.*, u.full_name as actor_name, u.email as actor_email
        FROM audit_logs a
        LEFT JOIN users u ON a.actor_id = u.id
        ORDER BY a.created_at DESC
        LIMIT 120
      `)
      .all();
    res.json({ logs });
  });

  app.get('/api/admin/settings', requireAuth, requireRoles('admin', 'super_admin'), (_req, res) => {
    res.json({ settings: getPlatformSettings() });
  });

  app.patch('/api/superadmin/settings', requireAuth, requireRoles('super_admin'), (req: AuthenticatedRequest, res) => {
    const current = getPlatformSettings();
    const updates = req.body as Record<string, unknown>;
    const merged = {
      ...current,
      ...updates,
      razorpayEnabled: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
      emailDeliveryEnabled: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER),
      whatsappDeliveryEnabled: Boolean(process.env.WHATSAPP_API_TOKEN),
    };
    db.prepare('UPDATE platform_settings SET value_json = ?, updated_at = ?, updated_by = ? WHERE key = ?').run(
      JSON.stringify(merged),
      new Date().toISOString(),
      req.auth!.userId,
      'global'
    );
    logAudit(req.auth!.userId, req.auth!.role, 'SETTINGS_UPDATED', 'platform_settings', 'global', updates, req.ip);
    res.json({ settings: merged });
  });

  // Super Admin creates Admin or Super Admin accounts (never open to public)
  app.post('/api/superadmin/admins', requireAuth, requireRoles('super_admin'), (req: AuthenticatedRequest, res) => {
    const body = req.body as Record<string, unknown>;
    const fullName = String(body.fullName || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const mobile = String(body.mobile || '').trim();
    const password = String(body.password || '');
    const role = body.role === 'super_admin' ? 'super_admin' : 'admin';

    if (!fullName || !email.includes('@') || !mobile || password.length < 8) {
      res.status(400).json({ error: 'Valid name, email, mobile, and 8+ character password are required.' });
      return;
    }

    const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (exists) {
      res.status(409).json({ error: 'Email already registered.' });
      return;
    }

    const id = `usr-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO users (id, email, password_hash, role, full_name, mobile, status, email_verified, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', 1, ?, ?)
    `).run(id, email, hashPassword(password), role, fullName, mobile, now, now);

    logAudit(req.auth!.userId, req.auth!.role, 'ADMIN_ACCOUNT_CREATED', 'user', id, { email, role }, req.ip);
    res.status(201).json({ id, email, role });
  });

  app.get('/api/superadmin/health', requireAuth, requireRoles('super_admin'), (_req, res) => {
    const tables = [
      'users',
      'customer_profiles',
      'consultant_profiles',
      'service_categories',
      'services',
      'bookings',
      'projects',
      'conversations',
      'messages',
      'transactions',
      'invoices',
      'payouts',
      'subscriptions',
      'reviews',
      'support_tickets',
      'documents',
      'audit_logs',
    ];
    const counts: Record<string, number> = {};
    for (const t of tables) {
      counts[t] = (db.prepare(`SELECT COUNT(*) as c FROM ${t}`).get() as { c: number }).c;
    }
    res.json({ tableCounts: counts, nodeVersion: process.version, uptimeSeconds: Math.round(process.uptime()) });
  });

  app.get('/api/superadmin/backup', requireAuth, requireRoles('super_admin'), (req: AuthenticatedRequest, res) => {
    const backup = {
      exportedAt: new Date().toISOString(),
      exportedBy: req.auth!.email,
      categories: db.prepare('SELECT * FROM service_categories').all(),
      services: db.prepare('SELECT * FROM services').all(),
      bookings: db.prepare('SELECT * FROM bookings').all(),
      projects: db.prepare('SELECT * FROM projects').all(),
      transactions: db.prepare('SELECT * FROM transactions').all(),
      invoices: db.prepare('SELECT * FROM invoices').all(),
      subscriptions: db.prepare('SELECT * FROM subscriptions').all(),
      operating_expenses: db.prepare('SELECT * FROM operating_expenses').all(),
      venture_plan_notes: db.prepare('SELECT * FROM venture_plan_notes').all(),
      settings: getPlatformSettings(),
    };
    logAudit(req.auth!.userId, req.auth!.role, 'DATABASE_BACKUP_EXPORTED', 'system', 'backup', {}, req.ip);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="campus-consult-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    res.send(JSON.stringify(backup, null, 2));
  });

  // ---------------- DEMONSTRATION DATA SEEDING & CLEANUP (SUPER ADMIN ONLY) ----------------
  app.get('/api/superadmin/demo-data/status', requireAuth, requireRoles('super_admin'), (_req, res) => {
    const counts = {
      genuine: {
        customers: (db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'customer' AND COALESCE(is_demo, 0) = 0").get() as { c: number }).c,
        consultants: (db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'consultant' AND COALESCE(is_demo, 0) = 0").get() as { c: number }).c,
        services: (db.prepare('SELECT COUNT(*) as c FROM services WHERE COALESCE(is_demo, 0) = 0').get() as { c: number }).c,
        bookings: (db.prepare('SELECT COUNT(*) as c FROM bookings WHERE COALESCE(is_demo, 0) = 0').get() as { c: number }).c,
      },
      demo: {
        customers: (db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'customer' AND is_demo = 1").get() as { c: number }).c,
        consultants: (db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'consultant' AND is_demo = 1").get() as { c: number }).c,
        approvedConsultants: (db.prepare("SELECT COUNT(*) as c FROM users u JOIN consultant_profiles cp ON u.id = cp.user_id WHERE u.role = 'consultant' AND u.is_demo = 1 AND cp.approval_status = 'approved'").get() as { c: number }).c,
        pendingConsultants: (db.prepare("SELECT COUNT(*) as c FROM users u JOIN consultant_profiles cp ON u.id = cp.user_id WHERE u.role = 'consultant' AND u.is_demo = 1 AND cp.approval_status = 'pending'").get() as { c: number }).c,
        services: (db.prepare('SELECT COUNT(*) as c FROM services WHERE is_demo = 1').get() as { c: number }).c,
        bookings: (db.prepare('SELECT COUNT(*) as c FROM bookings WHERE is_demo = 1').get() as { c: number }).c,
      },
    };
    res.json(counts);
  });

  app.post('/api/superadmin/demo-data/seed', requireAuth, requireRoles('super_admin'), (req: AuthenticatedRequest, res) => {
    const now = new Date();
    const isoAgo = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86400000).toISOString();
    const dateAhead = (daysAhead: number) => new Date(now.getTime() + daysAhead * 86400000).toISOString().slice(0, 10);

    const writeSamplePdfDoc = (ownerId: string, docId: string, category: 'portfolio' | 'certificate', fileName: string, titleText: string, createdAt: string) => {
      const existing = db.prepare('SELECT id FROM documents WHERE id = ?').get(docId);
      if (existing) return docId;
      const pdfStub = Buffer.from(
        `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length ${titleText.length + 52} >>\nstream\nBT /F1 12 Tf 72 720 Td (${titleText.replace(/[()]/g, '')}) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \ntrailer\n<< /Root 1 0 R /Size 5 >>\nstartxref\n0\n%%EOF`,
        'utf-8'
      );
      const diskName = `${docId}_${fileName}`;
      fs.writeFileSync(path.join(STORAGE_UPLOAD_DIR, diskName), pdfStub);
      db.prepare(`
        INSERT INTO documents (id, owner_id, project_id, booking_id, category, file_name, mime_type, size_bytes, storage_path, visibility, created_at)
        VALUES (?, ?, NULL, NULL, ?, ?, 'application/pdf', ?, ?, 'admin', ?)
      `).run(docId, ownerId, category, fileName, pdfStub.length, diskName, createdAt);
      return docId;
    };

    const demoCustomers = [
      { id: 'demo-cust-01', name: 'Rajesh Dhiman', email: 'demo.customer01@campusconsult-demo.in', mobile: '9897100001', biz: 'Dhiman Provision & Kirana Store', cat: 'General Store / Kirana', addr: 'Shop 4, Dhiman Market, Selaqui, Dehradun', gst: '05AABCD1101E1Z5', daysAgo: 78 },
      { id: 'demo-cust-02', name: 'Sunita Rawat', email: 'demo.customer02@campusconsult-demo.in', mobile: '9897100002', biz: 'Rawat Medical & Pharmacy', cat: 'Pharmacy / Medical', addr: 'Main Chakrata Road, Selaqui, Dehradun', gst: '05AABCD1102E1Z4', daysAgo: 66 },
      { id: 'demo-cust-03', name: 'Vikram Negi', email: 'demo.customer03@campusconsult-demo.in', mobile: '9897100003', biz: 'Garhwal Books & Stationery', cat: 'Stationery & Books', addr: 'Near Petrol Pump, Prem Nagar, Dehradun', gst: '', daysAgo: 55 },
      { id: 'demo-cust-04', name: 'Meera Joshi', email: 'demo.customer04@campusconsult-demo.in', mobile: '9897100004', biz: 'Doon Valley Bakers & Cafe', cat: 'Cafe / Bakery / Food Outlet', addr: 'Rajpur Road Cross, Dehradun', gst: '05AABCD1104E1Z2', daysAgo: 44 },
      { id: 'demo-cust-05', name: 'Harish Kandari', email: 'demo.customer05@campusconsult-demo.in', mobile: '9897100005', biz: 'Selaqui Hardware & Electricals', cat: 'Hardware / Electronics', addr: 'Plot 12, Industrial Estate Road, Selaqui', gst: '05AABCD1105E1Z1', daysAgo: 35 },
      { id: 'demo-cust-06', name: 'Kavita Bisht', email: 'demo.customer06@campusconsult-demo.in', mobile: '9897100006', biz: 'Shivalik Coaching Academy', cat: 'Coaching / Education', addr: 'Nanda Ki Chowki, Prem Nagar, Dehradun', gst: '', daysAgo: 28 },
      { id: 'demo-cust-07', name: 'Anil Panwar', email: 'demo.customer07@campusconsult-demo.in', mobile: '9897100007', biz: 'Panwar Wellness & Salon', cat: 'Salon / Wellness', addr: 'GMS Road, Balliwala, Dehradun', gst: '', daysAgo: 20 },
      { id: 'demo-cust-08', name: 'Deepak Sharma', email: 'demo.customer08@campusconsult-demo.in', mobile: '9897100008', biz: 'Sharma Footwear & Garments', cat: 'Retail Shop', addr: 'Paltan Bazaar Lane 3, Dehradun', gst: '05AABCD1108E1Z8', daysAgo: 14 },
      { id: 'demo-cust-09', name: 'Pooja Bhandari', email: 'demo.customer09@campusconsult-demo.in', mobile: '9897100009', biz: 'Himalayan Organic Mart', cat: 'General Store / Kirana', addr: 'Vasant Vihar Phase 1, Dehradun', gst: '05AABCD1109E1Z7', daysAgo: 9 },
      { id: 'demo-cust-10', name: 'Manoj Thapa', email: 'demo.customer10@campusconsult-demo.in', mobile: '9897100010', biz: 'Thapa Mobiles & Accessories', cat: 'Hardware / Electronics', addr: 'Shop 9, Dhiman Market, Selaqui, Dehradun', gst: '', daysAgo: 4 },
    ];

    const demoConsultants = [
      // 5 Approved
      { id: 'demo-cons-01', name: 'Aarav Nautiyal', email: 'demo.consultant01@campusconsult-demo.in', mobile: '9756200001', sid: 'DBS-MBA-2025-101', univ: 'DBS Global University', course: 'MBA Finance', qual: 'B.Com (Hons), MBA Pursuing', spec: 'Accounting & Financial Analysis', skills: ['Tally Prime', 'GST Filing', 'Balance Sheet', 'Cash Flow'], exp: '2 retail audit internships in Dehradun', approval: 'approved', rating: 4.9, completed: 2, daysAgo: 70 },
      { id: 'demo-cons-02', name: 'Priya Semwal', email: 'demo.consultant02@campusconsult-demo.in', mobile: '9756200002', sid: 'DBS-MBA-2025-102', univ: 'DBS Global University', course: 'MBA Business Analytics', qual: 'BBA, MBA Analytics Pursuing', spec: 'Excel MIS & Data Analytics', skills: ['Power BI', 'Advanced Excel', 'SQL', 'KPI Dashboards'], exp: 'Built automated stock & sales MIS for 3 MSMEs', approval: 'approved', rating: 4.8, completed: 1, daysAgo: 62 },
      { id: 'demo-cons-03', name: 'Rohan Gusain', email: 'demo.consultant03@campusconsult-demo.in', mobile: '9756200003', sid: 'DBS-BBA-2025-103', univ: 'DBS Global University', course: 'BBA Marketing', qual: '12th Commerce, BBA Marketing', spec: 'Digital Marketing & Social Media', skills: ['Google My Business', 'Meta Ads', 'Canva', 'Local SEO'], exp: 'Managed Instagram & Google Maps growth for local cafes', approval: 'approved', rating: 4.7, completed: 1, daysAgo: 50 },
      { id: 'demo-cons-04', name: 'Sneha Chauhan', email: 'demo.consultant04@campusconsult-demo.in', mobile: '9756200004', sid: 'GEU-BCOM-2025-104', univ: 'Graphic Era University', course: 'M.Com Finance', qual: 'B.Com, M.Com Finance', spec: 'Inventory Management & Bookkeeping', skills: ['SKU Audits', 'Reorder Alerts', 'Ledger Cleanup', 'Excel'], exp: 'Stock reconciliation lead for pharmacy & kirana shops', approval: 'approved', rating: 4.9, completed: 0, daysAgo: 40 },
      { id: 'demo-cons-05', name: 'Karan Verma', email: 'demo.consultant05@campusconsult-demo.in', mobile: '9756200005', sid: 'DBS-MBA-2025-105', univ: 'DBS Global University', course: 'MBA Strategy', qual: 'B.Tech, MBA Strategy', spec: 'Market Research & Business Consulting', skills: ['Competitor Benchmarking', 'Pitch Decks', 'SOP Writing', 'B2B Outreach'], exp: 'Conducted Selaqui market demand surveys', approval: 'approved', rating: 4.6, completed: 0, daysAgo: 32 },
      // 5 Pending Verification
      { id: 'demo-cons-06', name: 'Ananya Kukreti', email: 'demo.consultant06@campusconsult-demo.in', mobile: '9756200006', sid: 'DBS-MBA-2025-106', univ: 'DBS Global University', course: 'MBA Finance', qual: 'B.Com, MBA Finance Sem 3', spec: 'Financial Analysis & Taxation', skills: ['Ratio Analysis', 'Tally', 'Excel Modelling'], exp: 'Campus finance club coordinator', approval: 'pending', rating: 0, completed: 0, daysAgo: 5 },
      { id: 'demo-cons-07', name: 'Siddharth Purohit', email: 'demo.consultant07@campusconsult-demo.in', mobile: '9756200007', sid: 'UTU-BCA-2025-107', univ: 'Uttaranchal University', course: 'MBA IT & Analytics', qual: 'BCA, MBA Pursuing', spec: 'Data Analytics & MIS Reporting', skills: ['Excel Macros', 'Looker Studio', 'Python Pandas'], exp: '6-month MIS trainee experience', approval: 'pending', rating: 0, completed: 0, daysAgo: 4 },
      { id: 'demo-cons-08', name: 'Divya Uniyal', email: 'demo.consultant08@campusconsult-demo.in', mobile: '9756200008', sid: 'DBS-BBA-2025-108', univ: 'DBS Global University', course: 'BBA Digital Marketing', qual: 'BBA Final Year', spec: 'Graphic Designing & Social Media', skills: ['Figma', 'Canva Pro', 'Reels Editing', 'Copywriting'], exp: 'Designed menus & festival packs for campus events', approval: 'pending', rating: 0, completed: 0, daysAgo: 3 },
      { id: 'demo-cons-09', name: 'Yashwant Rana', email: 'demo.consultant09@campusconsult-demo.in', mobile: '9756200009', sid: 'DIT-MBA-2025-109', univ: 'DIT University Dehradun', course: 'MBA Sales & BD', qual: 'B.Sc, MBA Marketing', spec: 'Sales & Business Development', skills: ['B2B Calling', 'CRM Setup', 'Pitch Presentations'], exp: 'Summer sales intern at FMCG distributor', approval: 'pending', rating: 0, completed: 0, daysAgo: 2 },
      { id: 'demo-cons-10', name: 'Neha Dobhal', email: 'demo.consultant10@campusconsult-demo.in', mobile: '9756200010', sid: 'DBS-BCOM-2025-110', univ: 'DBS Global University', course: 'B.Com (Hons)', qual: 'B.Com 3rd Year', spec: 'Business Documentation & SOPs', skills: ['Word Formatting', 'Vendor Contracts', 'Compliance Checklists'], exp: 'Drafted MSME Udyam & operational SOP handbooks', approval: 'pending', rating: 0, completed: 0, daysAgo: 1 },
    ];

    const categoryRows = db.prepare('SELECT id, slug FROM service_categories ORDER BY sort_order ASC').all() as { id: string; slug: string }[];
    const catBySlug = (slug: string) => categoryRows.find((c) => c.slug === slug)?.id || categoryRows[0]?.id || 'cat-01';

    const demoServices = [
      { id: 'demo-srv-01', catSlug: 'accounting-bookkeeping', title: '[DEMO DATA] Monthly GST Ledger & Kirana Reconciliation', price: 1400, pkg: 'Demo Standard', deliv: 'Clean GST sales/purchase register & pending vendor balance sheet', img: '/src/assets/images/service_accounting_1794998871518.jpg', skills: 'Tally, Bookkeeping' },
      { id: 'demo-srv-02', catSlug: 'financial-analysis', title: '[DEMO DATA] Store Margin & Working Capital Health Audit', price: 1800, pkg: 'Demo Analyst', deliv: 'Category margin report, working capital cycle & cost leak memo', img: '/src/assets/images/service_financial_analysis_1794998871003.jpg', skills: 'Financial Analysis, Excel' },
      { id: 'demo-srv-03', catSlug: 'excel-mis-reporting', title: '[DEMO DATA] Automated Daily Cash & Credit MIS Tracker', price: 1500, pkg: 'Demo MIS Pack', deliv: 'Formula-locked Excel cashbook + Udhaar customer ageing sheet', img: '/src/assets/images/service_excel_mis_1794998871895.jpg', skills: 'Advanced Excel, MIS' },
      { id: 'demo-srv-04', catSlug: 'inventory-management', title: '[DEMO DATA] Pharmacy & Retail Expiry + Stock Audit', price: 1700, pkg: 'Demo Stock Audit', deliv: 'Dead-stock clearance list, FIFO shelf tags & reorder sheet', img: '/src/assets/images/service_inventory_1794998873068.jpg', skills: 'Inventory Audit, Excel' },
      { id: 'demo-srv-05', catSlug: 'data-analytics', title: '[DEMO DATA] Peak-Hour Sales & Customer Basket Insights', price: 2100, pkg: 'Demo BI Pack', deliv: 'Visual sales dashboard & top-20 SKU bundling recommendations', img: '/src/assets/images/service_data_analytics_1794998873375.jpg', skills: 'Power BI, Analytics' },
      { id: 'demo-srv-06', catSlug: 'digital-marketing', title: '[DEMO DATA] Dehradun Google Business Profile Boost', price: 1300, pkg: 'Demo Local SEO', deliv: 'Verified Maps listing, catalogue photos & WhatsApp quick-links', img: '/src/assets/images/service_digital_marketing_1794998873508.jpg', skills: 'Google My Business, SEO' },
      { id: 'demo-srv-07', catSlug: 'social-media-management', title: '[DEMO DATA] Festive Instagram & WhatsApp Promo Sprint', price: 1600, pkg: 'Demo Social Sprint', deliv: '8 branded posters, 4 short reels & local hashtag calendar', img: '/src/assets/images/service_social_media_1794998873245.jpg', skills: 'Social Media, Canva' },
      { id: 'demo-srv-08', catSlug: 'graphic-design', title: '[DEMO DATA] Shop Menu, Standee & Packaging Refresh', price: 1200, pkg: 'Demo Creative', deliv: 'Print-ready storefront banner, rate card & WhatsApp flyer', img: '/src/assets/images/service_graphic_design_1794998873930.jpg', skills: 'Graphic Design, Canva' },
      { id: 'demo-srv-09', catSlug: 'business-documentation', title: '[DEMO DATA] Shop Staff Onboarding & Cash SOP Manual', price: 1400, pkg: 'Demo SOP Pack', deliv: 'Daily opening/closing SOP checklist & cash register handover form', img: '/src/assets/images/service_documentation_1794998874261.jpg', skills: 'Documentation, SOP' },
      { id: 'demo-srv-10', catSlug: 'sales-business-development', title: '[DEMO DATA] Selaqui B2B Hostel & Institutional Tie-Up Kit', price: 2200, pkg: 'Demo BD Kit', deliv: '25 verified local B2B buyer leads, rate card & pitch script', img: '/src/assets/images/service_sales_bd_1794998876049.jpg', skills: 'Sales, B2B Outreach' },
    ];

    const demoPasswordHash = hashPassword('DemoUser@2026!');

    db.exec('BEGIN');
    try {
      for (const c of demoCustomers) {
        const created = isoAgo(c.daysAgo);
        db.prepare(`
          INSERT OR IGNORE INTO users (id, email, password_hash, role, full_name, mobile, status, email_verified, is_demo, created_at, updated_at)
          VALUES (?, ?, ?, 'customer', ?, ?, 'active', 1, 1, ?, ?)
        `).run(c.id, c.email, demoPasswordHash, c.name, c.mobile, created, created);

        db.prepare(`
          INSERT OR IGNORE INTO customer_profiles (user_id, business_name, business_category, address, gstin, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(c.id, c.biz, c.cat, c.addr, c.gst, created, created);
      }

      for (const co of demoConsultants) {
        const created = isoAgo(co.daysAgo);
        db.prepare(`
          INSERT OR IGNORE INTO users (id, email, password_hash, role, full_name, mobile, status, email_verified, is_demo, created_at, updated_at)
          VALUES (?, ?, ?, 'consultant', ?, ?, 'active', 1, 1, ?, ?)
        `).run(co.id, co.email, demoPasswordHash, co.name, co.mobile, created, created);

        const resumeDocId = writeSamplePdfDoc(
          co.id,
          `doc-${co.id}-resume`,
          'portfolio',
          `${co.name.replace(/\s+/g, '_')}_Resume_DEMO.pdf`,
          `DEMO DATA Resume - ${co.name} (${co.univ}, ${co.course})`,
          created
        );
        const idDocId = writeSamplePdfDoc(
          co.id,
          `doc-${co.id}-id`,
          'certificate',
          `${co.sid}_Student_ID_DEMO.pdf`,
          `DEMO DATA Student ID Card - ${co.name} (${co.sid})`,
          created
        );

        db.prepare(`
          INSERT OR IGNORE INTO consultant_profiles (
            user_id, student_id, university, course, qualification, specialisation, skills_json, experience,
            portfolio_url, certifications_text, resume_doc_id, id_doc_id, approval_status, rejection_reason,
            availability_status, bio, rating_avg, review_count, completed_count, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, '', 'available', ?, ?, ?, ?, ?, ?)
        `).run(
          co.id,
          co.sid,
          co.univ,
          co.course,
          co.qual,
          co.spec,
          JSON.stringify(co.skills),
          co.exp,
          co.skills.join(', '),
          resumeDocId,
          idDocId,
          co.approval,
          `[DEMO DATA] ${co.course} student consultant specialising in ${co.spec}.`,
          co.rating,
          co.completed,
          co.completed,
          created,
          created
        );
      }

      for (let i = 0; i < demoServices.length; i++) {
        const s = demoServices[i];
        const created = isoAgo(50 - i * 3);
        db.prepare(`
          INSERT OR IGNORE INTO services (
            id, category_id, title, short_description, description, price_inr, package_name,
            deliverables, estimated_days, requirements_prompt, revision_policy, required_skills,
            image_url, is_starting_price, consultant_id, is_active, is_demo, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 7, 'Share monthly records & shop requirements.', '2 standard revisions', ?, ?, 1, NULL, 1, 1, ?, ?)
        `).run(
          s.id,
          catBySlug(s.catSlug),
          s.title,
          s.deliv,
          `${s.title} — Demonstration service package crafted for Dehradun MSMEs.`,
          s.price,
          s.pkg,
          s.deliv,
          s.skills,
          s.img,
          created,
          created
        );
      }

      const demoBookingsSpec = [
        { id: 'demo-bkg-01', cust: 'demo-cust-01', srv: 'demo-srv-01', cons: 'demo-cons-01', price: 1400, status: 'Completed', txStatus: 'Successful', daysAgo: 62 },
        { id: 'demo-bkg-02', cust: 'demo-cust-02', srv: 'demo-srv-04', cons: 'demo-cons-04', price: 1700, status: 'Completed', txStatus: 'Successful', daysAgo: 45 },
        { id: 'demo-bkg-03', cust: 'demo-cust-03', srv: 'demo-srv-03', cons: 'demo-cons-02', price: 1500, status: 'Completed', txStatus: 'Successful', daysAgo: 28 },
        { id: 'demo-bkg-04', cust: 'demo-cust-04', srv: 'demo-srv-07', cons: 'demo-cons-03', price: 1600, status: 'In Progress', txStatus: 'Successful', daysAgo: 15 },
        { id: 'demo-bkg-05', cust: 'demo-cust-05', srv: 'demo-srv-02', cons: 'demo-cons-01', price: 1800, status: 'In Progress', txStatus: 'Pending', daysAgo: 11 },
        { id: 'demo-bkg-06', cust: 'demo-cust-06', srv: 'demo-srv-10', cons: 'demo-cons-05', price: 2200, status: 'Confirmed', txStatus: 'Pending', daysAgo: 8 },
        { id: 'demo-bkg-07', cust: 'demo-cust-07', srv: 'demo-srv-08', cons: 'demo-cons-03', price: 1200, status: 'Confirmed', txStatus: 'Pending', daysAgo: 7 },
        { id: 'demo-bkg-08', cust: 'demo-cust-08', srv: 'demo-srv-05', cons: null, price: 2100, status: 'Awaiting Confirmation', txStatus: null, daysAgo: 6 },
        { id: 'demo-bkg-09', cust: 'demo-cust-09', srv: 'demo-srv-06', cons: null, price: 1300, status: 'Awaiting Confirmation', txStatus: null, daysAgo: 5 },
        { id: 'demo-bkg-10', cust: 'demo-cust-10', srv: 'demo-srv-09', cons: null, price: 1400, status: 'Under Review', txStatus: null, daysAgo: 4 },
        { id: 'demo-bkg-11', cust: 'demo-cust-01', srv: 'demo-srv-03', cons: null, price: 1500, status: 'Under Review', txStatus: null, daysAgo: 3 },
        { id: 'demo-bkg-12', cust: 'demo-cust-02', srv: 'demo-srv-01', cons: null, price: 1400, status: 'Pending', txStatus: null, daysAgo: 2 },
        { id: 'demo-bkg-13', cust: 'demo-cust-04', srv: 'demo-srv-06', cons: null, price: 1300, status: 'Pending', txStatus: null, daysAgo: 2 },
        { id: 'demo-bkg-14', cust: 'demo-cust-05', srv: 'demo-srv-05', cons: null, price: 2100, status: 'Pending', txStatus: null, daysAgo: 1 },
        { id: 'demo-bkg-15', cust: 'demo-cust-09', srv: 'demo-srv-02', cons: null, price: 1800, status: 'Pending', txStatus: null, daysAgo: 1 },
      ];

      for (let i = 0; i < demoBookingsSpec.length; i++) {
        const b = demoBookingsSpec[i];
        const created = isoAgo(b.daysAgo);
        const srvObj = demoServices.find((x) => x.id === b.srv)!;
        const title = `[DEMO DATA] ${srvObj.title.replace('[DEMO DATA] ', '')}`;
        db.prepare(`
          INSERT OR IGNORE INTO bookings (
            id, customer_id, service_id, preferred_consultant_id, assigned_consultant_id,
            project_title, requirements, expected_delivery_date, budget_inr, auto_assign,
            quoted_price_inr, status, status_history_json, is_demo, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 1, ?, ?)
        `).run(
          b.id,
          b.cust,
          b.srv,
          b.cons,
          b.cons,
          title,
          `[DEMO DATA] Sample Dehradun merchant requirement for ${title}.`,
          dateAhead(10 + i),
          b.price,
          b.price,
          b.status,
          JSON.stringify([{ status: b.status, at: created, by: 'system-demo', note: 'Seeded DEMO DATA booking' }]),
          created,
          created
        );

        if (b.status === 'Awaiting Confirmation') {
          db.prepare(`
            INSERT OR IGNORE INTO quotations (id, booking_id, customer_id, amount_inr, scope_notes, valid_until, status, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 'sent', ?, ?)
          `).run(`demo-qtn-${i + 1}`, b.id, b.cust, b.price, `${title} custom scope`, dateAhead(14), req.auth!.userId, created);
        }

        if (b.cons && ['Confirmed', 'In Progress', 'Completed'].includes(b.status)) {
          const prjId = `demo-prj-${i + 1}`;
          const prjStatus = b.status === 'Completed' ? 'Completed' : b.status === 'In Progress' ? 'In Progress' : 'Assigned';
          const pct = b.status === 'Completed' ? 100 : b.status === 'In Progress' ? 60 : 15;

          db.prepare(`
            INSERT OR IGNORE INTO projects (
              id, booking_id, customer_id, consultant_id, service_id, title, description,
              status, progress_pct, deadline, deliverables_notes, revision_notes, is_demo, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', 1, ?, ?)
          `).run(
            prjId,
            b.id,
            b.cust,
            b.cons,
            b.srv,
            title,
            `[DEMO DATA] Sample project execution workflow for ${title}.`,
            prjStatus,
            pct,
            dateAhead(10 + i),
            b.status === 'Completed' ? 'Deliverables submitted & approved in DEMO DATA workflow.' : '',
            created,
            created
          );

          if (b.txStatus) {
            const comm = Math.round(b.price * 0.15);
            const consEarn = b.price - comm;
            const txId = `demo-txn-${i + 1}`;
            db.prepare(`
              INSERT OR IGNORE INTO transactions (
                id, booking_id, project_id, customer_id, consultant_id,
                gross_amount_inr, tax_amount_inr, total_payable_inr,
                commission_pct, commission_amount_inr, consultant_earning_inr,
                payment_method, payment_reference, status, refund_amount_inr,
                recorded_by, is_demo, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, 15, ?, ?, 'manual_upi', ?, ?, 0, ?, 1, ?, ?)
            `).run(
              txId,
              b.id,
              prjId,
              b.cust,
              b.cons,
              b.price,
              b.price,
              comm,
              consEarn,
              b.txStatus === 'Successful' ? `DEMO-UTR-${1001 + i}` : '',
              b.txStatus,
              req.auth!.userId,
              created,
              created
            );

            db.prepare(`
              INSERT OR IGNORE INTO invoices (
                id, invoice_number, transaction_id, booking_id, customer_id, consultant_id,
                service_title, subtotal_inr, tax_pct, tax_amount_inr, total_inr, status, is_demo, issued_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, 1, ?)
            `).run(
              `demo-inv-${i + 1}`,
              `DEMO-2026-${101 + i}`,
              txId,
              b.id,
              b.cust,
              b.cons,
              title,
              b.price,
              b.price,
              b.txStatus,
              created
            );
          }
        }
      }

      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    logAudit(req.auth!.userId, req.auth!.role, 'DEMO_DATA_SEEDED', 'system', 'demo', { customers: 10, consultants: 10, bookings: 15, services: 10 }, req.ip);
    res.status(201).json({
      ok: true,
      message: 'Demonstration data seeded safely (10 customers, 10 consultants [5 approved, 5 pending], 15 bookings, 10 services), tagged DEMO DATA.',
    });
  });

  app.delete('/api/superadmin/demo-data', requireAuth, requireRoles('super_admin'), (req: AuthenticatedRequest, res) => {
    const demoUserIds = (
      db.prepare('SELECT id FROM users WHERE is_demo = 1').all() as { id: string }[]
    ).map((r) => r.id);

    const demoDocPaths =
      demoUserIds.length > 0
        ? (
            db
              .prepare(`SELECT storage_path FROM documents WHERE owner_id IN (${demoUserIds.map(() => '?').join(',')})`)
              .all(...demoUserIds) as { storage_path: string }[]
          )
        : [];

    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM invoices WHERE is_demo = 1').run();
      db.prepare('DELETE FROM transactions WHERE is_demo = 1').run();
      db.prepare('DELETE FROM project_tasks WHERE project_id IN (SELECT id FROM projects WHERE is_demo = 1)').run();
      db.prepare('DELETE FROM project_milestones WHERE project_id IN (SELECT id FROM projects WHERE is_demo = 1)').run();
      db.prepare('DELETE FROM reviews WHERE project_id IN (SELECT id FROM projects WHERE is_demo = 1)').run();
      db.prepare('DELETE FROM projects WHERE is_demo = 1').run();
      db.prepare('DELETE FROM quotations WHERE booking_id IN (SELECT id FROM bookings WHERE is_demo = 1)').run();
      db.prepare('DELETE FROM bookings WHERE is_demo = 1').run();
      db.prepare('DELETE FROM subscriptions WHERE is_demo = 1').run();
      db.prepare('DELETE FROM services WHERE is_demo = 1').run();

      if (demoUserIds.length > 0) {
        const ph = demoUserIds.map(() => '?').join(',');
        db.prepare(`DELETE FROM payouts WHERE consultant_id IN (${ph})`).run(...demoUserIds);
        db.prepare(`DELETE FROM consultant_availability WHERE consultant_id IN (${ph})`).run(...demoUserIds);
        db.prepare(`DELETE FROM support_messages WHERE sender_id IN (${ph}) OR ticket_id IN (SELECT id FROM support_tickets WHERE user_id IN (${ph}))`).run(...demoUserIds, ...demoUserIds);
        db.prepare(`DELETE FROM support_tickets WHERE user_id IN (${ph})`).run(...demoUserIds);
        db.prepare(`DELETE FROM messages WHERE sender_id IN (${ph}) OR conversation_id IN (SELECT id FROM conversations WHERE participant_a IN (${ph}) OR participant_b IN (${ph}))`).run(...demoUserIds, ...demoUserIds, ...demoUserIds);
        db.prepare(`DELETE FROM conversations WHERE participant_a IN (${ph}) OR participant_b IN (${ph})`).run(...demoUserIds, ...demoUserIds);
        db.prepare(`DELETE FROM documents WHERE owner_id IN (${ph})`).run(...demoUserIds);
        db.prepare(`DELETE FROM notifications WHERE user_id IN (${ph})`).run(...demoUserIds);
        db.prepare(`DELETE FROM customer_profiles WHERE user_id IN (${ph})`).run(...demoUserIds);
        db.prepare(`DELETE FROM consultant_profiles WHERE user_id IN (${ph})`).run(...demoUserIds);
        db.prepare(`DELETE FROM users WHERE id IN (${ph})`).run(...demoUserIds);
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    for (const f of demoDocPaths) {
      const fp = path.join(STORAGE_UPLOAD_DIR, f.storage_path);
      if (fs.existsSync(fp)) {
        try {
          fs.unlinkSync(fp);
        } catch {
          // ignore
        }
      }
    }

    logAudit(req.auth!.userId, req.auth!.role, 'DEMO_DATA_REMOVED', 'system', 'demo', { removedDemoUsers: demoUserIds.length }, req.ip);
    res.json({ ok: true, message: 'All DEMO DATA records removed cleanly. Genuine users, services, categories, and financials remain intact.' });
  });
}
