export interface ParsedCategoryDef {
  id: string;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
  status: 'active' | 'inactive';
  isActive: boolean;
  isCore: boolean;
  imageUrl: string;
}

export interface ParsedServiceDef {
  id: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  title: string;
  shortDescription: string;
  description: string;
  priceInr: number;
  packageName: string;
  deliverables: string;
  estimatedDays: number;
  requirementsPrompt: string;
  revisionPolicy: string;
  requiredSkills: string;
  imageUrl: string;
  categoryImageUrl: string;
  isStartingPrice: boolean;
  status: 'active' | 'inactive';
  isActive: boolean;
}

export interface ParsedCatalogResult {
  categories: ParsedCategoryDef[];
  coreCategories: ParsedCategoryDef[];
  services: ParsedServiceDef[];
  missingCoreSlugs: string[];
}

export const CORE_12_CATEGORY_SLUGS = [
  'accounting-bookkeeping',
  'financial-analysis',
  'excel-mis-reporting',
  'inventory-management',
  'data-analytics',
  'digital-marketing',
  'social-media-management',
  'graphic-design',
  'business-documentation',
  'market-research',
  'business-consulting',
  'sales-business-development',
] as const;

export const DEFAULT_CATEGORY_IMAGE_PLACEHOLDERS: Record<string, string> = {
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

export const DEFAULT_SERVICE_IMAGE_PLACEHOLDERS: Record<string, string> = {
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

export function resolveDefaultPlaceholderImage(slugOrName: string, serviceId?: string): string {
  if (serviceId && DEFAULT_SERVICE_IMAGE_PLACEHOLDERS[serviceId]) {
    return DEFAULT_SERVICE_IMAGE_PLACEHOLDERS[serviceId];
  }
  const normalized = slugOrName.trim().toLowerCase();
  if (DEFAULT_CATEGORY_IMAGE_PLACEHOLDERS[normalized]) {
    return DEFAULT_CATEGORY_IMAGE_PLACEHOLDERS[normalized];
  }
  if (normalized.includes('account') || normalized.includes('bookkeep')) return '/src/assets/images/service_accounting_1794998871518.jpg';
  if (normalized.includes('financ')) return '/src/assets/images/service_financial_analysis_1794998871003.jpg';
  if (normalized.includes('excel') || normalized.includes('mis')) return '/src/assets/images/service_excel_mis_1794998871895.jpg';
  if (normalized.includes('invent')) return '/src/assets/images/service_inventory_1794998873068.jpg';
  if (normalized.includes('data') || normalized.includes('analytic')) return '/src/assets/images/service_data_analytics_1794998873375.jpg';
  if (normalized.includes('digital')) return '/src/assets/images/service_digital_marketing_1794998873508.jpg';
  if (normalized.includes('social')) return '/src/assets/images/service_social_media_1794998873245.jpg';
  if (normalized.includes('graphic') || normalized.includes('present') || normalized.includes('design')) return '/src/assets/images/service_graphic_design_1794998873930.jpg';
  if (normalized.includes('doc')) return '/src/assets/images/service_documentation_1794998874261.jpg';
  if (normalized.includes('research') || normalized.includes('market')) return '/src/assets/images/service_market_research_1794998875341.jpg';
  if (normalized.includes('sales') || normalized.includes('business-development')) return '/src/assets/images/service_sales_bd_1794998876049.jpg';
  return '/src/assets/images/service_consulting_1794998875504.jpg';
}

function splitTupleElements(tupleBody: string): string[] {
  const parts: string[] = [];
  let current = '';
  let quoteChar: string | null = null;
  let escaped = false;

  for (let i = 0; i < tupleBody.length; i++) {
    const ch = tupleBody[i];
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\' && quoteChar) {
      escaped = true;
      current += ch;
      continue;
    }
    if (quoteChar) {
      if (ch === quoteChar) {
        quoteChar = null;
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quoteChar = ch;
      continue;
    }
    if (ch === ',') {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function extractArrayBlock(sourceText: string, declarationRegex: RegExp): string[][] {
  const match = sourceText.match(declarationRegex);
  if (!match || !match[1]) return [];
  const block = match[1];
  const rows: string[][] = [];
  const rowRegex = /^\s*\[([^\n]+)\],?\s*$/gm;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRegex.exec(block)) !== null) {
    rows.push(splitTupleElements(rowMatch[1]));
  }
  return rows;
}

function extractStringRecord(sourceText: string, recordName: string): Record<string, string> {
  const regex = new RegExp(`const\\s+${recordName}\\s*:[^=]*=\\s*\\{([\\s\\S]*?)\\};`);
  const match = sourceText.match(regex);
  if (!match || !match[1]) return {};
  const result: Record<string, string> = {};
  const entryRegex = /'([^']+)'\s*:\s*'([^']*)'/g;
  let entry: RegExpExecArray | null;
  while ((entry = entryRegex.exec(match[1])) !== null) {
    result[entry[1]] = entry[2];
  }
  return result;
}

const FALLBACK_CATEGORY_ROWS: [string, string, string, string, number][] = [
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
];

const FALLBACK_SERVICE_ROWS: [string, string, string, string, string, number, string, string, number, string, string, string][] = [
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
];

export function parseServiceCatalogDefinitions(sourceText?: string): ParsedCatalogResult {
  const coreSet = new Set<string>(CORE_12_CATEGORY_SLUGS);

  const parsedCategoryImages = sourceText ? extractStringRecord(sourceText, 'CATEGORY_IMAGE_BY_SLUG') : {};
  const parsedServiceImages = sourceText ? extractStringRecord(sourceText, 'SERVICE_IMAGE_BY_ID') : {};
  const rawCategories = sourceText
    ? extractArrayBlock(sourceText, /const\s+categories\s*=\s*\[([\s\S]*?)\]\s+as\s+const;/)
    : [];
  const rawServices = sourceText
    ? extractArrayBlock(sourceText, /const\s+defaultServices\s*=\s*\[([\s\S]*?)\]\s+as\s+const;/)
    : [];

  const categoryRows =
    rawCategories.length > 0
      ? rawCategories.map((r) => [
          r[0],
          r[1],
          r[2],
          r[3],
          Math.max(1, Number(r[4] || 1) || 1),
        ] as [string, string, string, string, number])
      : FALLBACK_CATEGORY_ROWS;

  const categories: ParsedCategoryDef[] = categoryRows.map((c) => {
    const slug = String(c[2]).trim().toLowerCase().slice(0, 120);
    const placeholder =
      parsedCategoryImages[slug] || resolveDefaultPlaceholderImage(slug);
    return {
      id: String(c[0]).trim().slice(0, 128),
      name: String(c[1]).trim().slice(0, 120),
      slug,
      description: String(c[3]).trim().slice(0, 500),
      sortOrder: Math.min(999, Math.max(1, Math.round(Number(c[4]) || 1))),
      status: 'active',
      isActive: true,
      isCore: coreSet.has(slug),
      imageUrl: placeholder,
    };
  });

  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const serviceRows =
    rawServices.length > 0
      ? rawServices.map((r) => [
          r[0],
          r[1],
          r[2],
          r[3],
          r[4],
          Math.max(100, Number(r[5] || 1500) || 1500),
          r[6],
          r[7],
          Math.max(1, Number(r[8] || 7) || 7),
          r[9],
          r[10],
          r[11],
        ] as [string, string, string, string, string, number, string, string, number, string, string, string])
      : FALLBACK_SERVICE_ROWS;

  const services: ParsedServiceDef[] = serviceRows
    .map((s): ParsedServiceDef | null => {
      const cat = categoryById.get(String(s[1]).trim());
      if (!cat) return null;
      const id = String(s[0]).trim().slice(0, 128);
      const imageUrl =
        parsedServiceImages[id] ||
        resolveDefaultPlaceholderImage(cat.slug, id);
      return {
        id,
        categoryId: cat.id,
        categoryName: cat.name,
        categorySlug: cat.slug,
        title: String(s[2]).trim().slice(0, 160),
        shortDescription: String(s[3]).trim().slice(0, 280),
        description: String(s[4]).trim().slice(0, 2000),
        priceInr: Math.min(1000000, Math.max(100, Math.round(Number(s[5]) || 1500))),
        packageName: String(s[6]).trim().slice(0, 80),
        deliverables: String(s[7]).trim().slice(0, 600),
        estimatedDays: Math.min(365, Math.max(1, Math.round(Number(s[8]) || 7))),
        requirementsPrompt: String(s[9] || '').trim().slice(0, 500),
        revisionPolicy: String(s[10] || '').trim().slice(0, 200),
        requiredSkills: String(s[11] || '').trim().slice(0, 250),
        imageUrl,
        categoryImageUrl: cat.imageUrl,
        isStartingPrice: true,
        status: 'active',
        isActive: true,
      };
    })
    .filter((item): item is ParsedServiceDef => item !== null);

  const presentSlugs = new Set(categories.map((c) => c.slug));
  const missingCoreSlugs = CORE_12_CATEGORY_SLUGS.filter((slug) => !presentSlugs.has(slug));
  const coreCategories = categories.filter((c) => c.isCore);

  return {
    categories,
    coreCategories,
    services,
    missingCoreSlugs,
  };
}
