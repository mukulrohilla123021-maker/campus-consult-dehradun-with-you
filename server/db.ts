import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { hashPassword } from './auth.ts';
import { WRITABLE_DATA_DIR, WRITABLE_UPLOAD_DIR } from './storagePaths.ts';

export const DB_PATH = path.join(WRITABLE_DATA_DIR, 'campus_consult.db');
export const STORAGE_UPLOAD_DIR = WRITABLE_UPLOAD_DIR;

export const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export function ensureColumn(tableName: string, columnName: string, columnDefinition: string): void {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string }[];
  if (!columns.some((col) => col.name === columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition};`);
  }
}

let dbInitialized = false;

export function initDatabase(): void {
  if (dbInitialized) return;
  dbInitialized = true;
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('customer', 'consultant', 'admin', 'super_admin')),
      full_name TEXT NOT NULL,
      mobile TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'suspended')),
      email_verified INTEGER NOT NULL DEFAULT 0,
      verification_token TEXT,
      reset_token TEXT,
      reset_expires TEXT,
      notification_prefs_json TEXT NOT NULL DEFAULT '{"email":true,"inApp":true,"whatsapp":false}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customer_profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      business_name TEXT NOT NULL,
      business_category TEXT NOT NULL,
      address TEXT NOT NULL,
      gstin TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS consultant_profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      university TEXT NOT NULL,
      course TEXT NOT NULL,
      specialisation TEXT NOT NULL,
      skills_json TEXT NOT NULL DEFAULT '[]',
      experience TEXT NOT NULL DEFAULT '',
      portfolio_url TEXT DEFAULT '',
      certifications_text TEXT DEFAULT '',
      bio TEXT DEFAULT '',
      approval_status TEXT NOT NULL DEFAULT 'pending' CHECK(approval_status IN ('pending', 'approved', 'rejected')),
      availability_status TEXT NOT NULL DEFAULT 'available' CHECK(availability_status IN ('available', 'busy', 'unavailable')),
      rating_avg REAL NOT NULL DEFAULT 0,
      review_count INTEGER NOT NULL DEFAULT 0,
      completed_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS service_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL REFERENCES service_categories(id),
      title TEXT NOT NULL,
      short_description TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL,
      price_inr REAL NOT NULL,
      package_name TEXT NOT NULL,
      deliverables TEXT NOT NULL,
      estimated_days INTEGER NOT NULL,
      requirements_prompt TEXT NOT NULL,
      revision_policy TEXT NOT NULL,
      required_skills TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL DEFAULT '',
      is_starting_price INTEGER NOT NULL DEFAULT 1,
      consultant_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES users(id),
      service_id TEXT NOT NULL REFERENCES services(id),
      preferred_consultant_id TEXT REFERENCES users(id),
      assigned_consultant_id TEXT REFERENCES users(id),
      project_title TEXT NOT NULL DEFAULT '',
      requirements TEXT NOT NULL,
      expected_delivery_date TEXT NOT NULL,
      budget_inr REAL NOT NULL DEFAULT 0,
      auto_assign INTEGER NOT NULL DEFAULT 1,
      quoted_price_inr REAL NOT NULL,
      status TEXT NOT NULL CHECK(status IN (
        'Draft', 'Pending', 'Under Review', 'Quotation Sent',
        'Awaiting Confirmation', 'Confirmed', 'In Progress',
        'Completed', 'Cancelled', 'Rejected'
      )),
      status_history_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quotations (
      id TEXT PRIMARY KEY,
      booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      customer_id TEXT NOT NULL REFERENCES users(id),
      amount_inr REAL NOT NULL,
      scope_notes TEXT NOT NULL,
      valid_until TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'sent' CHECK(status IN ('sent', 'accepted', 'declined')),
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      booking_id TEXT UNIQUE NOT NULL REFERENCES bookings(id),
      customer_id TEXT NOT NULL REFERENCES users(id),
      consultant_id TEXT NOT NULL REFERENCES users(id),
      service_id TEXT NOT NULL REFERENCES services(id),
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN (
        'Assigned', 'Accepted', 'Started', 'In Progress',
        'Deliverable Submitted', 'Revision Requested', 'Approved', 'Completed'
      )),
      progress_pct INTEGER NOT NULL DEFAULT 0,
      deadline TEXT NOT NULL,
      deliverables_notes TEXT DEFAULT '',
      revision_notes TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high')),
      status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo', 'in_progress', 'done')),
      due_date TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_milestones (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'completed')),
      due_date TEXT DEFAULT '',
      completed_at TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES users(id),
      project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
      booking_id TEXT REFERENCES bookings(id) ON DELETE SET NULL,
      category TEXT NOT NULL CHECK(category IN ('requirement', 'deliverable', 'certificate', 'portfolio', 'invoice', 'other')),
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      storage_path TEXT NOT NULL,
      visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private', 'participants', 'admin')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      subject TEXT NOT NULL,
      project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
      participant_a TEXT NOT NULL REFERENCES users(id),
      participant_b TEXT NOT NULL REFERENCES users(id),
      last_message_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender_id TEXT NOT NULL REFERENCES users(id),
      body TEXT NOT NULL,
      attachment_doc_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      booking_id TEXT NOT NULL REFERENCES bookings(id),
      project_id TEXT REFERENCES projects(id),
      customer_id TEXT NOT NULL REFERENCES users(id),
      consultant_id TEXT REFERENCES users(id),
      gross_amount_inr REAL NOT NULL,
      tax_amount_inr REAL NOT NULL DEFAULT 0,
      total_payable_inr REAL NOT NULL,
      commission_pct REAL NOT NULL,
      commission_amount_inr REAL NOT NULL,
      consultant_earning_inr REAL NOT NULL,
      payment_method TEXT NOT NULL,
      payment_reference TEXT DEFAULT '',
      status TEXT NOT NULL CHECK(status IN ('Pending', 'Initiated', 'Successful', 'Failed', 'Refunded', 'Partially Refunded')),
      refund_amount_inr REAL NOT NULL DEFAULT 0,
      recorded_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      invoice_number TEXT UNIQUE NOT NULL,
      transaction_id TEXT REFERENCES transactions(id),
      booking_id TEXT NOT NULL REFERENCES bookings(id),
      customer_id TEXT NOT NULL REFERENCES users(id),
      consultant_id TEXT REFERENCES users(id),
      service_title TEXT NOT NULL,
      subtotal_inr REAL NOT NULL,
      tax_pct REAL NOT NULL DEFAULT 0,
      tax_amount_inr REAL NOT NULL DEFAULT 0,
      total_inr REAL NOT NULL,
      status TEXT NOT NULL,
      issued_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payouts (
      id TEXT PRIMARY KEY,
      consultant_id TEXT NOT NULL REFERENCES users(id),
      amount_inr REAL NOT NULL,
      reference TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'paid')),
      period_label TEXT NOT NULL,
      recorded_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      project_id TEXT UNIQUE NOT NULL REFERENCES projects(id),
      service_id TEXT NOT NULL REFERENCES services(id),
      customer_id TEXT NOT NULL REFERENCES users(id),
      consultant_id TEXT NOT NULL REFERENCES users(id),
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      comment TEXT NOT NULL,
      consultant_response TEXT DEFAULT '',
      is_verified INTEGER NOT NULL DEFAULT 1,
      is_flagged INTEGER NOT NULL DEFAULT 0,
      moderation_status TEXT NOT NULL DEFAULT 'published' CHECK(moderation_status IN ('published', 'hidden')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      link_tab TEXT DEFAULT 'overview',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS support_tickets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      category TEXT NOT NULL,
      priority TEXT NOT NULL CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
      subject TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('Open', 'In Progress', 'Awaiting Response', 'Resolved', 'Closed')),
      assigned_admin_id TEXT REFERENCES users(id),
      refund_requested INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS support_messages (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
      sender_id TEXT NOT NULL REFERENCES users(id),
      body TEXT NOT NULL,
      is_internal_note INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS consultant_availability (
      id TEXT PRIMARY KEY,
      consultant_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      day_of_week TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      slot_note TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS operating_expenses (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      amount_inr REAL NOT NULL,
      expense_date TEXT NOT NULL,
      recorded_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      service_id TEXT REFERENCES services(id) ON DELETE SET NULL,
      plan_name TEXT NOT NULL,
      monthly_price_inr REAL NOT NULL,
      billing_cycle TEXT NOT NULL DEFAULT 'Monthly',
      status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active', 'Paused', 'Cancelled')),
      next_billing_date TEXT NOT NULL,
      notes TEXT DEFAULT '',
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS venture_plan_notes (
      section_key TEXT PRIMARY KEY,
      section_title TEXT NOT NULL,
      assumptions TEXT NOT NULL DEFAULT '',
      targets TEXT NOT NULL DEFAULT '',
      validation_notes TEXT NOT NULL DEFAULT '',
      updated_by TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS platform_settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      updated_by TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_id TEXT,
      actor_role TEXT,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      details_json TEXT NOT NULL DEFAULT '{}',
      ip_address TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contact_inquiries (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      mobile TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id);
    CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
    CREATE INDEX IF NOT EXISTS idx_projects_customer ON projects(customer_id);
    CREATE INDEX IF NOT EXISTS idx_projects_consultant ON projects(consultant_id);
    CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(customer_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
  `);

  // Safe additive column migrations for pre-existing live SQLite databases
  ensureColumn('service_categories', 'image_url', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('services', 'short_description', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('services', 'image_url', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('services', 'required_skills', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('services', 'is_starting_price', 'INTEGER NOT NULL DEFAULT 1');

  ensureColumn('bookings', 'project_title', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('bookings', 'budget_inr', 'REAL NOT NULL DEFAULT 0');
  ensureColumn('bookings', 'auto_assign', 'INTEGER NOT NULL DEFAULT 1');

  // Demo isolation flags & enhanced consultant verification fields
  ensureColumn('users', 'is_demo', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('services', 'is_demo', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('bookings', 'is_demo', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('projects', 'is_demo', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('transactions', 'is_demo', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('invoices', 'is_demo', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('subscriptions', 'is_demo', 'INTEGER NOT NULL DEFAULT 0');

  ensureColumn('consultant_profiles', 'student_id', "TEXT DEFAULT ''");
  ensureColumn('consultant_profiles', 'qualification', "TEXT DEFAULT ''");
  ensureColumn('consultant_profiles', 'rejection_reason', "TEXT DEFAULT ''");
  ensureColumn('consultant_profiles', 'resume_doc_id', "TEXT DEFAULT ''");
  ensureColumn('consultant_profiles', 'id_doc_id', "TEXT DEFAULT ''");

  seedPlatformDefaults();
}

const CATEGORY_IMAGE_BY_SLUG: Record<string, string> = {
  'accounting-bookkeeping': '/src/assets/images/service_accounting_1794998871518.jpg',
  'financial-statement-preparation': '/src/assets/images/service_financial_analysis_1794998871003.jpg',
  'financial-modelling': '/src/assets/images/service_financial_analysis_1794998871003.jpg',
  'financial-analysis': '/src/assets/images/service_financial_analysis_1794998871003.jpg',
  'excel-mis-reporting': '/src/assets/images/service_excel_mis_1794998871895.jpg',
  'data-analytics': '/src/assets/images/service_data_analytics_1794998873375.jpg',
  'inventory-management': '/src/assets/images/service_inventory_1794998873068.jpg',
  'business-research': '/src/assets/images/service_market_research_1794998875341.jpg',
  'digital-marketing': '/src/assets/images/service_digital_marketing_1794998873508.jpg',
  'social-media-management': '/src/assets/images/service_social_media_1794998873245.jpg',
  'graphic-design': '/src/assets/images/service_graphic_design_1794998873930.jpg',
  'business-documentation': '/src/assets/images/service_documentation_1794998874261.jpg',
  'business-consulting': '/src/assets/images/service_consulting_1794998875504.jpg',
  'presentation-design': '/src/assets/images/service_graphic_design_1794998873930.jpg',
  'market-research': '/src/assets/images/service_market_research_1794998875341.jpg',
  'sales-business-development': '/src/assets/images/service_sales_bd_1794998876049.jpg',
};

const SERVICE_IMAGE_BY_ID: Record<string, string> = {
  'srv-01': '/src/assets/images/service_accounting_1794998871518.jpg',
  'srv-02': '/src/assets/images/service_accounting_1794998871518.jpg',
  'srv-03': '/src/assets/images/service_inventory_1794998873068.jpg',
  'srv-04': '/src/assets/images/service_digital_marketing_1794998873508.jpg',
  'srv-05': '/src/assets/images/service_excel_mis_1794998871895.jpg',
  'srv-06': '/src/assets/images/service_financial_analysis_1794998871003.jpg',
  'srv-07': '/src/assets/images/service_financial_analysis_1794998871003.jpg',
  'srv-08': '/src/assets/images/service_financial_analysis_1794998871003.jpg',
  'srv-09': '/src/assets/images/service_data_analytics_1794998873375.jpg',
  'srv-10': '/src/assets/images/service_social_media_1794998873245.jpg',
  'srv-11': '/src/assets/images/service_graphic_design_1794998873930.jpg',
  'srv-12': '/src/assets/images/service_documentation_1794998874261.jpg',
  'srv-13': '/src/assets/images/service_consulting_1794998875504.jpg',
  'srv-14': '/src/assets/images/service_graphic_design_1794998873930.jpg',
  'srv-15': '/src/assets/images/service_market_research_1794998875341.jpg',
  'srv-16': '/src/assets/images/service_market_research_1794998875341.jpg',
  'srv-17': '/src/assets/images/service_sales_bd_1794998876049.jpg',
};

function seedPlatformDefaults(): void {
  const now = new Date().toISOString();

  // Default platform settings (only when missing — preserves live Super Admin settings)
  const globalSettingsRow = db.prepare('SELECT key FROM platform_settings WHERE key = ?').get('global');
  if (!globalSettingsRow) {
    const defaultSettings = {
      brandName: 'Campus Consult Dehradun',
      tagline: 'Student Talent. Business Solutions. Local Growth.',
      currency: 'INR',
      currencySymbol: '₹',
      commissionPct: 15,
      taxPct: 0,
      allowDuplicateBookings: false,
      cancellationNoticeHours: 24,
      razorpayEnabled: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
      emailDeliveryEnabled: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER),
      whatsappDeliveryEnabled: Boolean(process.env.WHATSAPP_API_TOKEN),
      faqItems: [
        {
          q: 'How does Campus Consult Dehradun work for local shops?',
          a: 'Book a service package or request a quotation online. An administrator reviews your requirements, assigns a vetted Dehradun university student consultant, and coordinates counter-side or remote delivery.',
        },
        {
          q: 'Are student consultants verified?',
          a: 'Yes. Every student consultant registers with their university, course, skills, and certificates and must pass manual Admin verification before accepting live client projects.',
        },
        {
          q: 'How are payments handled?',
          a: 'Currently, payments can be recorded via verified UPI, bank transfer, or cash receipt by platform administrators. Online Razorpay checkout activates automatically once live merchant API keys are configured in environment settings.',
        },
      ],
    };
    db.prepare(
      'INSERT INTO platform_settings (key, value_json, updated_at, updated_by) VALUES (?, ?, ?, ?)'
    ).run('global', JSON.stringify(defaultSettings), now, 'system');
  }

  // Ensure all 16 official service categories exist idempotently (safe on live DB)
  const categories = [
    ['cat-01', 'Accounting and Bookkeeping', 'accounting-bookkeeping', 'Daily sales, credit (udhaar), supplier payables, and ledger maintenance.', 1],
    ['cat-02', 'Financial Statement Preparation', 'financial-statement-preparation', 'Monthly income statements, cash-flow summaries, and year-end CA handoff packs.', 2],
    ['cat-03', 'Financial Modelling', 'financial-modelling', 'Unit economics, break-even projections, and working-capital forecasting.', 3],
    ['cat-04', 'Financial Analysis', 'financial-analysis', 'Gross margin diagnostics, cost leak audits, and profitability reviews.', 4],
    ['cat-05', 'Excel and MIS Reporting', 'excel-mis-reporting', 'Custom automated Excel dashboards, trackers, and weekly owner summaries.', 5],
    ['cat-06', 'Data Analytics', 'data-analytics', 'Sales velocity, customer repeat cohorts, and basket-size analytics.', 6],
    ['cat-07', 'Inventory Management', 'inventory-management', 'SKU counts, reorder alerts, expiry tracking, and dead-stock clearance.', 7],
    ['cat-08', 'Business Research', 'business-research', 'Competitor pricing scans, local catchment mapping, and supplier sourcing.', 8],
    ['cat-09', 'Digital Marketing', 'digital-marketing', 'Google Business Profile optimisation, local campaigns, and WhatsApp catalogs.', 9],
    ['cat-10', 'Social Media Management', 'social-media-management', 'Content calendars, Instagram/Facebook reels, and community engagement.', 10],
    ['cat-11', 'Graphic Design', 'graphic-design', 'Promotional flyers, festival offer banners, menu cards, and store signage.', 11],
    ['cat-12', 'Business Documentation', 'business-documentation', 'SOP manuals, vendor agreements, pitch decks, and loan-readiness folders.', 12],
    ['cat-13', 'Business Consulting', 'business-consulting', 'Operations workflow streamlining, pricing strategy, and expansion planning.', 13],
    ['cat-14', 'Presentation Design', 'presentation-design', 'Investor, bank, and partner presentation decks with clean visual charts.', 14],
    ['cat-15', 'Market Research', 'market-research', 'Customer discovery surveys, demand validation, and new product launch audits.', 15],
    ['cat-16', 'Sales & Business Development', 'sales-business-development', 'Local B2B/B2C outreach, customer lead pipelines, distributor onboarding, and sales playbooks.', 16],
  ] as const;

  const insertCatIgnore = db.prepare(
    'INSERT OR IGNORE INTO service_categories (id, name, slug, description, sort_order, is_active, image_url) VALUES (?, ?, ?, ?, ?, 1, ?)'
  );
  for (const c of categories) {
    const bySlug = db.prepare('SELECT id FROM service_categories WHERE slug = ? OR LOWER(name) = LOWER(?)').get(c[2], c[1]);
    if (!bySlug) {
      insertCatIgnore.run(c[0], c[1], c[2], c[3], c[4], CATEGORY_IMAGE_BY_SLUG[c[2]] || '');
    }
  }

  const defaultServices = [
    ['srv-01', 'cat-01', 'One-Time Digital Setup & Ledger Digitisation', 'Move paper Bahi-Khata ledgers into a structured Excel & Google Business toolkit.', 'Transition from paper Bahi-Khata to a clean bilingual Excel ledger, digital udhaar tracker, and Google Business Profile.', 1500, 'Starter Setup', 'Custom Excel sales & expense workbook, udhaar credit tracker, GBP setup, 1-hr owner walkthrough.', 5, 'Provide last 14 days of sales/purchase slips and basic business details.', '2 revisions within 7 days of setup', 'Bookkeeping, Excel, Tally Basics'],
    ['srv-02', 'cat-01', 'Monthly Bookkeeping & Weekly On-Site MIS Retainer', 'Weekly counter-side reconciliation of cash, UPI, supplier bills, and profit.', 'Dedicated weekly shop visits by a vetted MBA/BBA student consultant to reconcile cash, UPI, supplier bills, and monthly profit.', 2000, 'Monthly Retainer', '4 weekly shop visits, bill & UPI reconciliation, supplier payable log, monthly P&L WhatsApp summary.', 30, 'Share weekly purchase invoices, UPI statements, and cash register totals.', 'Unlimited monthly reconciliation corrections', 'Accounting, Cash/UPI Reconciliation, Excel MIS'],
    ['srv-03', 'cat-07', 'Inventory Audit & Reorder Control Sprint', 'Physical-to-digital SKU count, expiry alerts, and reorder threshold sheet.', 'Physical-to-digital SKU verification for general stores, pharmacies, and mini-marts to curb stockouts and expiry losses.', 1800, 'Sprint Package', 'Top-250 SKU count sheet, dead-stock & near-expiry flag report, min-max reorder alert template.', 7, 'Grant 2-hour shelf access during off-peak store hours and supplier rate list.', '1 post-audit threshold adjustment', 'Inventory Control, SKU Auditing, Excel'],
    ['srv-04', 'cat-09', 'Local Digital Marketing & Festival Offer Pack', 'WhatsApp Business catalog, Google Maps visibility, and festival promo creatives.', 'Drive neighbourhood and student footfall with WhatsApp Business catalogs, local search setup, and promotional creatives.', 1200, 'Growth Pack', '6 bilingual WhatsApp/Instagram offer creatives, WhatsApp catalog setup, Google Maps optimisation.', 7, 'Share store photos, top 15 products/offers, and shop timings.', '2 design revision rounds', 'Digital Marketing, Google Business Profile, Canva'],
    ['srv-05', 'cat-05', 'Automated Excel MIS & Daily Profit Dashboard', 'Custom formula-driven Excel tracker for daily sales, cash flow, and margins.', 'Bespoke Excel workbook tailored to your shop or service workflow with automated daily cash-flow and margin formulas.', 1800, 'Custom MIS', 'Dynamic Excel workbook, category margin breakdown, printable monthly summary sheet, training guide.', 6, 'Outline key revenue streams, expense heads, and preferred report layout.', '2 formula/layout revisions', 'Advanced Excel, Pivot Tables, MIS Reporting'],
    ['srv-06', 'cat-02', 'Monthly Financial Statement & CA-Handoff Pack', 'Clean monthly P&L, voucher index, and CA-ready accounting reconciliation.', 'Clean monthly income statement, balance summary, and structured expense classification ready for year-end CA statutory filing.', 2200, 'Compliance Prep', 'Structured P&L statement, expense vouchers index, bank/UPI tally sheet, CA-ready Excel workbook.', 10, 'Provide monthly bank statements, GST bills (if applicable), and cash expense logs.', '2 reconciliation revisions', 'Financial Accounting, P&L Statements, Tally'],
    ['srv-07', 'cat-03', 'Unit Economics & Expansion Financial Model', '3-scenario break-even and 12-month cash-flow model for expansion.', 'Rigorous break-even, pricing sensitivity, and 12-month cash-flow model for new branches or product lines in Dehradun.', 2500, 'Strategic Model', '3-scenario Excel model (Conservative/Base/Ambitious), break-even chart, capital requirement plan.', 7, 'Share target pricing, estimated fixed rent/staff costs, and expected volumes.', '2 scenario adjustments', 'Financial Modelling, Break-Even Analysis, Valuation'],
    ['srv-08', 'cat-04', 'Margin & Cost-Leakage Diagnostic Review', 'Identify SKU margin traps, supplier price drift, and overdue credit.', 'Deep-dive analysis of SKU margins, supplier price drift, and credit aging to uncover trapped working capital.', 1600, 'Diagnostic Audit', 'SKU margin ranking report, overdue credit recovery priority list, 5-point cost-saving memo.', 5, 'Provide 1–2 months of purchase bills and customer credit notebook.', '1 follow-up Q&A review', 'Financial Analysis, Cost Accounting, Working Capital'],
    ['srv-09', 'cat-06', 'Retail Sales & Customer Basket Analytics', 'Billing and UPI data analysis for peak hours and top revenue drivers.', 'Uncover peak hours, fast-moving bundles, and repeat buyer patterns from your billing or UPI history.', 1900, 'Analytics Sprint', 'Peak-hour heatmap, top-20 revenue drivers report, cross-sell bundle recommendations.', 7, 'Export CSV/Excel billing data or 30 days of UPI transaction logs.', '1 refinement cycle', 'Data Analytics, Excel Charts, Retail Metrics'],
    ['srv-10', 'cat-10', 'Social Media Management (Monthly Starter)', 'Curated Instagram & Facebook posts with local Dehradun community growth.', 'Consistent local presence on Instagram and Facebook tailored for Dehradun cafes, salons, boutiques, and coaching centres.', 2400, 'Monthly Social', '12 curated posts/reels templates, local hashtag strategy, weekly engagement schedule.', 30, 'Share brand logo, product photos, and monthly seasonal promotions.', '2 content calendar revisions', 'Social Media Marketing, Content Writing, Reels'],
    ['srv-11', 'cat-11', 'Brand Flyers, Menu & Storefront Print Design', 'Print-ready flyers, rate cards, packaging stickers, and counter standees.', 'High-impact bilingual flyers, rate cards, packaging stickers, and counter standees ready for Dehradun print shops.', 1200, 'Design Pack', '4 print-ready CMYK PDF designs + source files + WhatsApp shareable versions.', 4, 'Provide business name, logo (if any), offer copy, and contact details.', '3 design revisions', 'Graphic Design, Canva, Branding'],
    ['srv-12', 'cat-12', 'MSME Loan Readiness & Business Documentation', 'Structured Udyam/Mudra business dossier and cash-flow brief.', 'Structured business profile, projected cash-flow brief, and document checklist for Mudra or bank working-capital applications.', 2200, 'Documentation Pack', 'Business profile dossier, 12-month projection sheet, KYC & compliance checklist.', 7, 'Share Udyam certificate (if available), 6-month bank statement summary, and loan purpose.', '2 document edits', 'Business Documentation, MSME Compliance, Financial Writing'],
    ['srv-13', 'cat-13', 'Micro-Enterprise Operations & Growth Advisory', 'On-site operational audit and 30-day actionable store growth roadmap.', 'One-on-one structured consulting sprint covering store layout, supplier negotiation prep, and student-catchment marketing.', 2000, 'Advisory Sprint', '90-minute on-site audit, 30-day action roadmap PDF, 2 weekly check-in reviews.', 14, 'Describe current operational bottlenecks and 6-month revenue goals.', '1 roadmap update', 'Operations Consulting, Retail Strategy, Process Design'],
    ['srv-14', 'cat-14', 'Investor & Bank Pitch Presentation Design', 'Clean data-backed 12–15 slide PPTX/PDF deck for partners and lenders.', 'Clean, data-backed PowerPoint/PDF presentation deck for local startups, franchises, and commercial partnerships.', 1800, 'Pitch Deck', '12–15 slide designed presentation, custom financial charts, editable PPTX + PDF.', 5, 'Share rough bullet points, financials, and target audience.', '2 slide revision rounds', 'Presentation Design, Storytelling, Data Visualization'],
    ['srv-15', 'cat-15', 'Local Catchment & Competitor Market Research', 'On-ground competitor pricing scan and local buyer preference survey.', 'On-ground competitor pricing scan and customer preference survey across targeted Dehradun markets like Selaqui or Prem Nagar.', 2400, 'Field Research', 'Competitor pricing matrix (5–8 peers), 20-respondent local feedback summary, strategic brief.', 10, 'Specify target locality, product category, and key questions to answer.', '1 scope refinement', 'Market Research, Survey Design, Field Analysis'],
    ['srv-16', 'cat-08', 'Supplier Benchmarking & Sourcing Research', 'Compare 6–10 wholesale vendors on landed cost, MOQ, and credit terms.', 'Structured secondary & local wholesale market research to identify lower-cost, higher-margin vendor alternatives.', 1600, 'Sourcing Brief', 'Comparison sheet of 6–10 wholesale vendors, MOQ/credit terms, landed cost comparison.', 6, 'List top 10–15 procurement items and current wholesale purchase rates.', '1 vendor list update', 'Procurement Research, Vendor Benchmarking, Excel'],
    ['srv-17', 'cat-16', 'Local Sales Funnel & Customer Acquisition Sprint', 'Structured B2B/B2C outreach list, WhatsApp follow-up scripts, and conversion sheet.', 'Build a repeatable local customer outreach pipeline for Dehradun wholesalers, tutors, and B2B vendors.', 1700, 'Sales Growth Pack', '50-prospect local lead tracker, bilingual WhatsApp outreach scripts, follow-up cadence sheet.', 7, 'Specify target customer segment and key products/services to pitch.', '2 script adjustments', 'Sales Strategy, Lead Generation, CRM Tracking'],
  ] as const;

  const insertSrv = db.prepare(`
    INSERT INTO services (
      id, category_id, title, short_description, description, price_inr, package_name,
      deliverables, estimated_days, requirements_prompt, revision_policy, required_skills,
      image_url, is_starting_price, consultant_id, is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, 1, ?, ?)
  `);

  // Seed initial Service Marketplace listings on fresh DB
  const srvCount = (db.prepare('SELECT COUNT(*) as c FROM services').get() as { c: number }).c;
  if (srvCount === 0) {
    for (const s of defaultServices) {
      insertSrv.run(s[0], s[1], s[2], s[3], s[4], s[5], s[6], s[7], s[8], s[9], s[10], s[11], SERVICE_IMAGE_BY_ID[s[0]] || '', now, now);
    }
  }

  // One-time safe migration for pre-existing live DBs:
  // 1) Enable all 16 official categories & existing valid services
  // 2) Add srv-17 (Sales & Business Development) if missing without duplicates
  // 3) Backfill missing category & service images without overriding future Admin edits
  const migrationDone = db.prepare('SELECT key FROM platform_settings WHERE key = ?').get('migration_catalog_enable_images_v1');
  if (!migrationDone) {
    db.prepare('UPDATE service_categories SET is_active = 1 WHERE slug IN (' +
      Object.keys(CATEGORY_IMAGE_BY_SLUG).map(() => '?').join(',') +
    ')').run(...Object.keys(CATEGORY_IMAGE_BY_SLUG));

    db.prepare('UPDATE services SET is_active = 1').run();

    const salesCat = db.prepare("SELECT id FROM service_categories WHERE slug = 'sales-business-development'").get() as { id: string } | undefined;
    if (salesCat) {
      const hasSalesSrv = db.prepare('SELECT id FROM services WHERE category_id = ?').get(salesCat.id);
      if (!hasSalesSrv) {
        const s17 = defaultServices[16];
        const existsById = db.prepare('SELECT id FROM services WHERE id = ?').get(s17[0]);
        if (!existsById) {
          insertSrv.run(s17[0], salesCat.id, s17[2], s17[3], s17[4], s17[5], s17[6], s17[7], s17[8], s17[9], s17[10], s17[11], SERVICE_IMAGE_BY_ID[s17[0]] || '', now, now);
        }
      }
    }

    const catRows = db.prepare('SELECT id, slug, image_url FROM service_categories').all() as { id: string; slug: string; image_url: string }[];
    const updateCatImg = db.prepare('UPDATE service_categories SET image_url = ? WHERE id = ?');
    for (const cat of catRows) {
      if (!cat.image_url && CATEGORY_IMAGE_BY_SLUG[cat.slug]) {
        updateCatImg.run(CATEGORY_IMAGE_BY_SLUG[cat.slug], cat.id);
      }
    }

    const srvRows = db.prepare(`
      SELECT s.id, s.image_url, c.slug as category_slug
      FROM services s
      LEFT JOIN service_categories c ON s.category_id = c.id
    `).all() as { id: string; image_url: string; category_slug: string }[];
    const updateSrvImg = db.prepare('UPDATE services SET image_url = ? WHERE id = ?');
    for (const srv of srvRows) {
      if (!srv.image_url) {
        const mapped = SERVICE_IMAGE_BY_ID[srv.id] || CATEGORY_IMAGE_BY_SLUG[srv.category_slug] || '';
        if (mapped) {
          updateSrvImg.run(mapped, srv.id);
        }
      }
    }

    db.prepare('INSERT OR REPLACE INTO platform_settings (key, value_json, updated_at, updated_by) VALUES (?, ?, ?, ?)')
      .run('migration_catalog_enable_images_v1', JSON.stringify({ migratedAt: now }), now, 'system');
  }

  // Seed default Venture Plan strategic assumptions & targets ledger (only if section absent)
  const vpSeed = [
    ['sec-01', 'Executive Summary & Venture Identity', 'Tagline: Student Talent. Business Solutions. Local Growth. Initial corridor: Dhiman Market & Selaqui, Dehradun.', 'Onboard 20 active Dehradun SMEs and 15 vetted student consultants in Pilot Phase 1.', 'Verify initial unit demand through direct shop visits in Selaqui & Prem Nagar.'],
    ['sec-05', 'Revenue Model & Platform Commission', 'Default platform commission assumption: 15% of service billing; consultant payout: 85%. Configurable in Super Admin settings.', 'Achieve 40+ paid micro-consulting engagements in first 6 months at avg ticket ₹1,500–₹2,000.', 'Track real commission vs payout ledger inside Financial Reports & BI.'],
    ['sec-07', 'Service Portfolio & Packaging', '16 active consulting & business support categories priced ₹1,200–₹2,500 starter packages plus Monthly Retainer subscriptions.', 'Convert 30% of one-time setup customers into Monthly Bookkeeping/MIS Retainer plans.', 'Monitor conversion via Subscriptions Management and Service-Wise Performance charts.'],
    ['sec-12', 'Go-To-Market & Pilot Launch', 'Zero-paid-ads campus recruitment at DBS Global University paired with hyperlocal merchant demos.', 'Target ₹75,000 gross billing and positive net operating surplus within initial academic semester.', 'Compare live database metrics below against these Assignment 1 targets.'],
  ] as const;

  const insertVp = db.prepare(
    'INSERT OR IGNORE INTO venture_plan_notes (section_key, section_title, assumptions, targets, validation_notes, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  for (const row of vpSeed) {
    insertVp.run(row[0], row[1], row[2], row[3], row[4], 'system', now);
  }

  ensureSuperAdminFromEnv();

  const seedAdminPassword = String(process.env.SEED_ADMIN_PASSWORD || '').trim();
  const seedAdminEmail = String(process.env.SEED_ADMIN_EMAIL || '').trim().toLowerCase();

  const adminCount = (
    db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'admin'").get() as { c: number }
  ).c;

  if (adminCount === 0 && seedAdminPassword.length >= 8 && seedAdminEmail.includes('@')) {
    const existingAdminEmail = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(seedAdminEmail);
    if (!existingAdminEmail) {
      const id = `usr-${crypto.randomUUID()}`;
      db.prepare(`
        INSERT INTO users (id, email, password_hash, role, full_name, mobile, status, email_verified, created_at, updated_at)
        VALUES (?, ?, ?, 'admin', 'Platform Administrator', '9999999998', 'active', 1, ?, ?)
      `).run(id, seedAdminEmail, hashPassword(seedAdminPassword), now, now);
    }
  }
}

export interface EnvSeedResult {
  ok: boolean;
  alreadyInitialized?: boolean;
  missingEnv?: boolean;
  email?: string;
  userId?: string;
  error?: string;
}

export function getSeedEnvStatus(): { seedSuperAdminConfigured: boolean; sessionSecretConfigured: boolean } {
  const email = String(process.env.SEED_SUPERADMIN_EMAIL || '').trim().toLowerCase();
  const pass = String(process.env.SEED_SUPERADMIN_PASSWORD || '').trim();
  const sessionSecret = String(process.env.SESSION_SECRET || '').trim();
  return {
    seedSuperAdminConfigured: Boolean(email && email.includes('@') && pass.length >= 8),
    sessionSecretConfigured: sessionSecret.length >= 16,
  };
}

export function ensureSuperAdminFromEnv(): EnvSeedResult {
  const superAdminCount = (
    db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'super_admin'").get() as { c: number }
  ).c;

  if (superAdminCount > 0) {
    return {
      ok: false,
      alreadyInitialized: true,
      error: 'A Super Admin account already exists. Initialisation is permanently disabled to prevent duplicate or overwritten admin accounts.',
    };
  }

  const email = String(process.env.SEED_SUPERADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.SEED_SUPERADMIN_PASSWORD || '').trim();

  if (!email || !email.includes('@') || password.length < 8) {
    return {
      ok: false,
      missingEnv: true,
      error:
        'SEED_SUPERADMIN_EMAIL and SEED_SUPERADMIN_PASSWORD (minimum 8 characters) are not configured in server environment variables. Set them in Google AI Studio Secrets or use the one-time setup form below.',
    };
  }

  const existingEmail = db.prepare('SELECT id, role FROM users WHERE LOWER(email) = ?').get(email) as
    | { id: string; role: string }
    | undefined;
  if (existingEmail) {
    return {
      ok: false,
      error: `An account with email ${email} already exists (${existingEmail.role}). Existing account passwords are never overwritten automatically.`,
    };
  }

  const id = `usr-${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  db.exec('BEGIN IMMEDIATE');
  try {
    const recheck = (
      db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'super_admin'").get() as { c: number }
    ).c;
    if (recheck > 0) {
      db.exec('ROLLBACK');
      return {
        ok: false,
        alreadyInitialized: true,
        error: 'A Super Admin account already exists.',
      };
    }

    db.prepare(`
      INSERT INTO users (id, email, password_hash, role, full_name, mobile, status, email_verified, created_at, updated_at)
      VALUES (?, ?, ?, 'super_admin', 'Super Administrator', '9999999999', 'active', 1, ?, ?)
    `).run(id, email, hashPassword(password), now, now);

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  const verified = db.prepare("SELECT id, email, role FROM users WHERE id = ? AND role = 'super_admin'").get(id) as
    | { id: string; email: string; role: string }
    | undefined;

  if (!verified) {
    return { ok: false, error: 'Database verification failed after Super Admin insert.' };
  }

  logAudit(id, 'super_admin', 'SUPERADMIN_INITIALISED_FROM_ENV', 'user', id, { email });
  return { ok: true, userId: id, email: verified.email };
}

export function getPlatformSettings(): Record<string, unknown> {
  const row = db.prepare('SELECT value_json FROM platform_settings WHERE key = ?').get('global') as
    | { value_json: string }
    | undefined;
  if (!row) return {};
  try {
    return JSON.parse(row.value_json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function logAudit(
  actorId: string | null,
  actorRole: string | null,
  action: string,
  targetType: string,
  targetId: string,
  details: Record<string, unknown> = {},
  ipAddress = ''
): void {
  db.prepare(`
    INSERT INTO audit_logs (id, actor_id, actor_role, action, target_type, target_id, details_json, ip_address, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    `aud-${crypto.randomUUID()}`,
    actorId,
    actorRole,
    action,
    targetType,
    targetId,
    JSON.stringify(details),
    ipAddress,
    new Date().toISOString()
  );
}
