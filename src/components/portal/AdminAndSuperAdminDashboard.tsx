import { useEffect, useState, type FormEvent } from 'react';
import { Database, Download, Printer, RefreshCw, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { onAuthStateChanged, type User as FirebaseAuthUser } from 'firebase/auth';
import { apiFetch, downloadAuthenticatedFile, downloadCsv, formatDateShort, formatDateTime, formatINR } from '../../lib/api';
import {
  auth,
  firebaseConfigInfo,
  signInFirebaseAdminWithGoogle,
  signOutFirebaseAdmin,
} from '../../lib/firebase';
import {
  fetchFirestoreCatalogStats,
  initializeFirestoreCatalog,
  type FirestoreCatalogStats,
} from '../../lib/firestoreCatalogInit';
import {
  BUNDLED_IMAGE_PRESETS,
  resolveAssetReference,
  resolveCategoryFallbackImage,
  resolveCategoryImage,
  resolveServiceImage,
} from '../../lib/mediaAssets';
import { useAuth } from '../../context/AuthContext';
import type {
  BookingItem,
  ExpenseItem,
  InvoiceItem,
  PayoutItem,
  ProjectItem,
  ReviewItem,
  ServiceCategory,
  ServiceItem,
  SubscriptionItem,
  TransactionItem,
} from '../../types/platform';
import { SmartImage } from '../common/SmartImage';
import { PortalLayout, type SidebarNavItem } from './PortalLayout';
import {
  AccountSettingsModule,
  DocumentsModule,
  InvoicePrintModal,
  MessagesModule,
  SupportModule,
} from './SharedWorkspaceModules';
import { VenturePlanWorkspace } from './VenturePlanWorkspace';

interface AdminUserRecord {
  id: string;
  email: string;
  role: string;
  full_name: string;
  mobile: string;
  status: string;
  email_verified: number;
  is_demo?: number;
  created_at: string;
  business_name?: string;
  business_category?: string;
  address?: string;
  gstin?: string;
  student_id?: string;
  university?: string;
  course?: string;
  qualification?: string;
  specialisation?: string;
  skills_json?: string;
  experience?: string;
  portfolio_url?: string;
  certifications_text?: string;
  approval_status?: string;
  rejection_reason?: string;
  availability_status?: string;
  rating_avg?: number;
  completed_count?: number;
  resume_doc_id?: string;
  id_doc_id?: string;
  resume_file_name?: string;
  id_doc_file_name?: string;
  customer_bookings_count?: number;
  customer_paid_inr?: number;
  consultant_projects_count?: number;
  consultant_earned_inr?: number;
}

interface AdminKpis {
  totalCustomers: number;
  totalConsultants: number;
  approvedConsultants?: number;
  pendingConsultantApprovals: number;
  totalServices: number;
  totalBookings: number;
  pendingBookings?: number;
  activeProjects: number;
  completedProjects: number;
  completionRatePct?: number;
  grossRevenueInr: number;
  platformCommissionInr: number;
  consultantEarningsInr: number;
  pendingPaymentsInr: number;
  refundsInr: number;
  operatingExpensesInr: number;
  netOperatingSurplusInr: number;
  averageOrderValueInr?: number;
  activeSubscriptions?: number;
  activeRetainerMrrInr?: number;
  newsletterSubscribers: number;
  contactInquiries: number;
}

interface DemoSummary {
  customers: number;
  consultants: number;
  approvedConsultants: number;
  pendingConsultants: number;
  services: number;
  bookings: number;
  revenueInr: number;
}

interface CustomerDetailPayload {
  customer: AdminUserRecord;
  bookings: (BookingItem & { service_title: string; assigned_consultant_name?: string })[];
  transactions: (TransactionItem & { service_title: string })[];
}

interface ConsultantDetailPayload {
  consultant: AdminUserRecord;
  projects: ProjectItem[];
  documents: { id: string; category: string; file_name: string; mime_type: string; size_bytes: number; created_at: string }[];
  transactions: (TransactionItem & { service_title: string })[];
  payouts: PayoutItem[];
}

const CUSTOMER_BUSINESS_CATEGORIES = [
  'General Store / Kirana',
  'Retail Shop',
  'Pharmacy / Medical',
  'Stationery & Books',
  'Cafe / Bakery / Food Outlet',
  'Coaching / Education',
  'Salon / Wellness',
  'Hardware / Electronics',
  'Other Small Business',
];

function parseSkillsList(skillsJson?: string): string[] {
  if (!skillsJson) return [];
  try {
    const arr = JSON.parse(skillsJson);
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

export function AdminAndSuperAdminDashboard({ onGoPublic }: { onGoPublic: () => void }) {
  const { user, integrations } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  const navItems: SidebarNavItem[] = [
    { id: 'overview', label: 'Dashboard Overview' },
    { id: 'customers', label: 'Customer Management' },
    { id: 'consultants', label: 'Consultant Management' },
    { id: 'verification', label: 'Consultant Verification' },
    { id: 'services', label: 'Service & Categories' },
    { id: 'bookings', label: 'Bookings & Assignments' },
    { id: 'projects', label: 'Project Management' },
    { id: 'finance', label: 'Payments, Invoices & Tax' },
    { id: 'reports', label: 'Financial Reports & BI' },
    { id: 'documents', label: 'Document Vault' },
    { id: 'reviews', label: 'Reviews Moderation' },
    { id: 'messages', label: 'Messages Moderation' },
    { id: 'support', label: 'Support & Complaints' },
    { id: 'audit', label: 'Audit Logs' },
    { id: 'venture-plan', label: 'Venture Plan (17 Sec.)' },
    ...(isSuperAdmin ? [{ id: 'superadmin', label: 'Super Admin Panel' }] : []),
    { id: 'settings', label: 'Account & Settings' },
  ];

  const [tab, setTab] = useState('overview');
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  // BI Date Range & Demo Data Toggle
  const [biRange, setBiRange] = useState('all');
  const [biFrom, setBiFrom] = useState('');
  const [biTo, setBiTo] = useState('');
  const [includeDemoInAnalytics, setIncludeDemoInAnalytics] = useState(false);

  const [kpis, setKpis] = useState<AdminKpis | null>(null);
  const [demoSummary, setDemoSummary] = useState<DemoSummary | null>(null);
  const [serviceBreakdown, setServiceBreakdown] = useState<{ title: string; category_name?: string; bookings_count: number; revenue_inr: number }[]>([]);
  const [categoryPerformance, setCategoryPerformance] = useState<{ id: string; name: string; bookings_count: number; revenue_inr: number; commission_inr: number }[]>([]);
  const [monthlyRevenueSeries, setMonthlyRevenueSeries] = useState<{ month: string; revenue_inr: number; commission_inr: number; payout_inr: number; tx_count: number }[]>([]);
  const [bookingTrends, setBookingTrends] = useState<{ date: string; total_bookings: number; completed_bookings: number }[]>([]);
  const [customerGrowthSeries, setCustomerGrowthSeries] = useState<{ month: string; registrations: number }[]>([]);
  const [consultantBreakdown, setConsultantBreakdown] = useState<{ id: string; full_name: string; is_demo?: number; completed_count: number; rating_avg: number; earned_inr: number }[]>([]);
  const [recentRegistrations, setRecentRegistrations] = useState<{ id: string; full_name: string; email: string; role: string; is_demo?: number; created_at: string; business_name?: string; approval_status?: string; university?: string }[]>([]);
  const [recentBookings, setRecentBookings] = useState<{ id: string; status: string; quoted_price_inr: number; is_demo?: number; created_at: string; service_title: string; customer_name: string; business_name?: string }[]>([]);
  const [recentActivities, setRecentActivities] = useState<{ id: string; action: string; target_type: string; target_id: string; created_at: string; actor_name?: string; actor_role?: string }[]>([]);

  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [inquiries, setInquiries] = useState<{ id: string; name: string; email: string; mobile: string; message: string; created_at: string }[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<{ id: string; actor_name: string; actor_role: string; action: string; target_type: string; target_id: string; created_at: string }[]>([]);
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [health, setHealth] = useState<{ tableCounts: Record<string, number>; nodeVersion: string; uptimeSeconds: number } | null>(null);

  // Customer Management filters & modals
  const [customerCategoryFilter, setCustomerCategoryFilter] = useState('');
  const [customerStatusFilter, setCustomerStatusFilter] = useState('all');
  const [customerSourceFilter, setCustomerSourceFilter] = useState('all');
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [addCustomerForm, setAddCustomerForm] = useState({
    fullName: '',
    email: '',
    mobile: '',
    password: '',
    businessName: '',
    businessCategory: CUSTOMER_BUSINESS_CATEGORIES[0],
    address: '',
    gstin: '',
  });
  const [editCustomerModal, setEditCustomerModal] = useState<{
    id: string;
    fullName: string;
    mobile: string;
    status: string;
    businessName: string;
    businessCategory: string;
    address: string;
    gstin: string;
  } | null>(null);
  const [viewCustomerDetail, setViewCustomerDetail] = useState<CustomerDetailPayload | null>(null);
  const [deleteConfirmCustomer, setDeleteConfirmCustomer] = useState<AdminUserRecord | null>(null);

  // Consultant Management & Verification filters & modals
  const [consultantApprovalFilter, setConsultantApprovalFilter] = useState('all');
  const [consultantSourceFilter, setConsultantSourceFilter] = useState('all');
  const [verificationStatusFilter, setVerificationStatusFilter] = useState('pending');
  const [viewConsultantDetail, setViewConsultantDetail] = useState<ConsultantDetailPayload | null>(null);
  const [editConsultantModal, setEditConsultantModal] = useState<{
    id: string;
    fullName: string;
    mobile: string;
    status: string;
    studentId: string;
    university: string;
    course: string;
    qualification: string;
    specialisation: string;
    skills: string;
    experience: string;
    portfolioUrl: string;
    certificationsText: string;
    availabilityStatus: string;
  } | null>(null);
  const [rejectModalTarget, setRejectModalTarget] = useState<{ id: string; fullName: string } | null>(null);
  const [rejectionReasonDraft, setRejectionReasonDraft] = useState('');

  // Demo Data Manager State (Super Admin)
  const [demoStatus, setDemoStatus] = useState<{
    genuine: { customers: number; consultants: number; services: number; bookings: number };
    demo: { customers: number; consultants: number; approvedConsultants: number; pendingConsultants: number; services: number; bookings: number };
  } | null>(null);
  const [demoBusy, setDemoBusy] = useState(false);
  const [confirmRemoveDemo, setConfirmRemoveDemo] = useState(false);

  // Forms
  const [newCategory, setNewCategory] = useState({ name: '', description: '', imageUrl: '' });
  const [editCategory, setEditCategory] = useState<{
    id: string;
    name: string;
    description: string;
    imageUrl: string;
    isActive: boolean;
  } | null>(null);
  const [newService, setNewService] = useState({
    categoryId: '',
    title: '',
    shortDescription: '',
    description: '',
    priceInr: '1500',
    packageName: 'Standard Package',
    deliverables: '',
    estimatedDays: '7',
    requiredSkills: '',
    imageUrl: '',
  });
  const [publishingService, setPublishingService] = useState(false);
  const [serviceSuccess, setServiceSuccess] = useState('');
  const [serviceError, setServiceError] = useState('');

  // Cloud Firestore Catalog Initialization State
  const [firebaseUser, setFirebaseUser] = useState<FirebaseAuthUser | null>(auth.currentUser);
  const [firestoreStats, setFirestoreStats] = useState<FirestoreCatalogStats | null>(null);
  const [loadingFirestoreStats, setLoadingFirestoreStats] = useState(false);
  const [syncingFirestore, setSyncingFirestore] = useState(false);
  const [firestoreSyncFeedback, setFirestoreSyncFeedback] = useState('');
  const [firestoreSyncError, setFirestoreSyncError] = useState('');
  const [editService, setEditService] = useState<{
    id: string;
    categoryId: string;
    title: string;
    shortDescription: string;
    description: string;
    priceInr: string;
    packageName: string;
    deliverables: string;
    estimatedDays: string;
    requiredSkills: string;
    imageUrl: string;
    isActive: boolean;
  } | null>(null);
  const [deleteConfirmServiceId, setDeleteConfirmServiceId] = useState<string | null>(null);
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});

  const [quoteDraft, setQuoteDraft] = useState<{ bookingId: string; amountInr: string; scopeNotes: string; validUntil: string } | null>(null);
  const [assignChoice, setAssignChoice] = useState<Record<string, string>>({});

  const [txUpdate, setTxUpdate] = useState<{ id: string; status: string; method: string; ref: string; refund: string } | null>(null);
  const [payoutForm, setPayoutForm] = useState({ consultantId: '', amountInr: '', reference: '', periodLabel: '' });
  const [expenseForm, setExpenseForm] = useState({ category: 'Marketing & Outreach', description: '', amountInr: '', expenseDate: new Date().toISOString().slice(0, 10) });
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceItem | null>(null);

  // Super Admin forms
  const [newAdmin, setNewAdmin] = useState({ fullName: '', email: '', mobile: '', password: '', role: 'admin' });
  const [commissionInput, setCommissionInput] = useState('15');
  const [taxInput, setTaxInput] = useState('0');
  const [allowDupBookings, setAllowDupBookings] = useState(false);
  const [subForm, setSubForm] = useState({
    customerId: '',
    serviceId: '',
    planName: 'Monthly Bookkeeping & MIS Retainer',
    monthlyPriceInr: '2000',
    nextBillingDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    notes: '',
  });

  const buildOverviewUrl = (range = biRange, from = biFrom, to = biTo, includeDemo = includeDemoInAnalytics) => {
    const params = new URLSearchParams();
    params.set('range', range);
    if (includeDemo) params.set('includeDemo', '1');
    if (range === 'custom' && from) {
      params.set('from', from);
      if (to) params.set('to', to);
    }
    return `/api/admin/overview?${params.toString()}`;
  };

  const applyOverviewResponse = (ov: {
    kpis: AdminKpis;
    demoSummary?: DemoSummary;
    serviceBreakdown: typeof serviceBreakdown;
    categoryPerformance: typeof categoryPerformance;
    monthlyRevenueSeries: typeof monthlyRevenueSeries;
    bookingTrends: typeof bookingTrends;
    customerGrowthSeries?: typeof customerGrowthSeries;
    consultantBreakdown: typeof consultantBreakdown;
    recentRegistrations?: typeof recentRegistrations;
    recentBookings?: typeof recentBookings;
    recentActivities?: typeof recentActivities;
  }) => {
    setKpis(ov.kpis);
    setDemoSummary(ov.demoSummary || null);
    setServiceBreakdown(ov.serviceBreakdown);
    setCategoryPerformance(ov.categoryPerformance || []);
    setMonthlyRevenueSeries(ov.monthlyRevenueSeries || []);
    setBookingTrends(ov.bookingTrends || []);
    setCustomerGrowthSeries(ov.customerGrowthSeries || []);
    setConsultantBreakdown(ov.consultantBreakdown);
    setRecentRegistrations(ov.recentRegistrations || []);
    setRecentBookings(ov.recentBookings || []);
    setRecentActivities(ov.recentActivities || []);
  };

  const loadOverviewOnly = async (range = biRange, from = biFrom, to = biTo, includeDemo = includeDemoInAnalytics) => {
    try {
      const ov = await apiFetch<Parameters<typeof applyOverviewResponse>[0]>(buildOverviewUrl(range, from, to, includeDemo));
      applyOverviewResponse(ov);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh analytics.');
    }
  };

  const loadAll = async () => {
    try {
      const [ov, usr, cat, bkg, prj, fin, rev, aud, stg, subRes] = await Promise.all([
        apiFetch<Parameters<typeof applyOverviewResponse>[0]>(buildOverviewUrl()),
        apiFetch<{ users: AdminUserRecord[]; inquiries: typeof inquiries }>('/api/admin/users'),
        apiFetch<{ categories: ServiceCategory[]; services: ServiceItem[] }>('/api/admin/catalog'),
        apiFetch<{ bookings: BookingItem[] }>('/api/bookings'),
        apiFetch<{ projects: ProjectItem[] }>('/api/projects'),
        apiFetch<{ transactions: TransactionItem[]; invoices: InvoiceItem[]; payouts: PayoutItem[]; expenses: ExpenseItem[] }>('/api/finance/ledger'),
        apiFetch<{ reviews: ReviewItem[] }>('/api/reviews'),
        apiFetch<{ logs: typeof auditLogs }>('/api/admin/audit-logs'),
        apiFetch<{ settings: Record<string, unknown> }>('/api/admin/settings'),
        apiFetch<{ subscriptions: SubscriptionItem[] }>('/api/superadmin/subscriptions'),
      ]);

      applyOverviewResponse(ov);
      setUsers(usr.users);
      setInquiries(usr.inquiries);
      setCategories(cat.categories);
      setServices(cat.services);
      if (cat.categories.length > 0) {
        setNewService((s) => (s.categoryId ? s : { ...s, categoryId: cat.categories[0].id }));
      }
      setBookings(bkg.bookings);
      setProjects(prj.projects);
      setTransactions(fin.transactions);
      setInvoices(fin.invoices);
      setPayouts(fin.payouts);
      setExpenses(fin.expenses);
      setSubscriptions(subRes.subscriptions || []);
      setReviews(rev.reviews);
      setAuditLogs(aud.logs);
      setSettings(stg.settings);
      setCommissionInput(String(stg.settings.commissionPct ?? 15));
      setTaxInput(String(stg.settings.taxPct ?? 0));
      setAllowDupBookings(Boolean(stg.settings.allowDuplicateBookings));

      if (isSuperAdmin) {
        const [h, dStatus] = await Promise.all([
          apiFetch<typeof health>('/api/superadmin/health'),
          apiFetch<NonNullable<typeof demoStatus>>('/api/superadmin/demo-data/status'),
        ]);
        setHealth(h);
        setDemoStatus(dStatus);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admin dashboard.');
    }
  };

  const formatFirestoreUiError = (err: unknown): string => {
    if (!(err instanceof Error)) return 'Firestore operation failed.';
    try {
      const parsed = JSON.parse(err.message) as { error?: string; path?: string; operationType?: string };
      if (parsed && typeof parsed.error === 'string') {
        const prefix = parsed.operationType && parsed.path ? `[${parsed.operationType} ${parsed.path}] ` : '';
        return `${prefix}${parsed.error}`;
      }
    } catch {
      // Plain error message
    }
    return err.message;
  };

  const refreshFirestoreStats = async () => {
    setLoadingFirestoreStats(true);
    setFirestoreSyncError('');
    try {
      const stats = await fetchFirestoreCatalogStats();
      setFirestoreStats(stats);
    } catch (err) {
      setFirestoreSyncError(formatFirestoreUiError(err));
    } finally {
      setLoadingFirestoreStats(false);
    }
  };

  const handleFirebaseGoogleSignIn = async () => {
    setFirestoreSyncError('');
    setFirestoreSyncFeedback('');
    try {
      const cred = await signInFirebaseAdminWithGoogle();
      setFirebaseUser(cred.user);
      setFirestoreSyncFeedback(`Connected Google Firebase Auth as ${cred.user.email || cred.user.uid}.`);
      await refreshFirestoreStats();
    } catch (err) {
      setFirestoreSyncError(formatFirestoreUiError(err));
    }
  };

  const handleFirebaseSignOut = async () => {
    setFirestoreSyncError('');
    try {
      await signOutFirebaseAdmin();
      setFirebaseUser(null);
      setFirestoreSyncFeedback('Signed out of Firebase Admin session.');
    } catch (err) {
      setFirestoreSyncError(formatFirestoreUiError(err));
    }
  };

  const handleInitializeFirestoreCatalog = async () => {
    if (syncingFirestore) return;
    setSyncingFirestore(true);
    setFirestoreSyncError('');
    setFirestoreSyncFeedback('');
    try {
      const summary = await initializeFirestoreCatalog();
      setFirestoreSyncFeedback(
        `Firestore initialized: ${summary.coreCategoriesVerified}/12 core categories verified (${summary.categoriesCreated} created, ${summary.categoriesUpdated} updated) and ${summary.totalActiveServices} active services (${summary.servicesCreated} created, ${summary.servicesUpdated} updated) with professional images.`
      );
      await refreshFirestoreStats();
    } catch (err) {
      setFirestoreSyncError(formatFirestoreUiError(err));
    } finally {
      setSyncingFirestore(false);
    }
  };

  useEffect(() => {
    void loadAll();
    void refreshFirestoreStats();
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
    });
    return () => unsubscribe();
  }, []);

  const approvedConsultants = users.filter(
    (u) => u.role === 'consultant' && u.approval_status === 'approved' && u.status === 'active'
  );

  const handleApproval = async (consultantId: string, approvalStatus: 'approved' | 'rejected', rejectionReason?: string) => {
    setError('');
    setFeedback('');
    try {
      await apiFetch(`/api/admin/consultants/${consultantId}/approval`, {
        method: 'PATCH',
        body: JSON.stringify({ approvalStatus, rejectionReason }),
      });
      setFeedback(`Consultant marked ${approvalStatus}.`);
      setRejectModalTarget(null);
      setRejectionReasonDraft('');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Consultant verification update failed.');
    }
  };

  const handleUserStatus = async (userId: string, status: 'active' | 'suspended') => {
    setError('');
    try {
      await apiFetch(`/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setFeedback(`Account marked ${status}.`);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status update failed.');
    }
  };

  const handleCreateCustomer = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setFeedback('');
    try {
      await apiFetch('/api/admin/customers', {
        method: 'POST',
        body: JSON.stringify(addCustomerForm),
      });
      setShowAddCustomerModal(false);
      setAddCustomerForm({
        fullName: '',
        email: '',
        mobile: '',
        password: '',
        businessName: '',
        businessCategory: CUSTOMER_BUSINESS_CATEGORIES[0],
        address: '',
        gstin: '',
      });
      setFeedback('Business customer created successfully.');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create customer.');
    }
  };

  const handleOpenCustomerProfile = async (customerId: string) => {
    setError('');
    try {
      const detail = await apiFetch<CustomerDetailPayload>(`/api/admin/customers/${customerId}`);
      setViewCustomerDetail(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customer profile.');
    }
  };

  const handleSaveEditCustomer = async (e: FormEvent) => {
    e.preventDefault();
    if (!editCustomerModal) return;
    setError('');
    try {
      await apiFetch(`/api/admin/customers/${editCustomerModal.id}`, {
        method: 'PATCH',
        body: JSON.stringify(editCustomerModal),
      });
      setEditCustomerModal(null);
      setFeedback('Customer profile updated.');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update customer.');
    }
  };

  const handleDeleteCustomer = async (customerId: string) => {
    setError('');
    try {
      await apiFetch(`/api/admin/customers/${customerId}?force=1`, { method: 'DELETE' });
      setDeleteConfirmCustomer(null);
      setFeedback('Customer account deleted.');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete customer.');
    }
  };

  const handleOpenConsultantProfile = async (consultantId: string) => {
    setError('');
    try {
      const detail = await apiFetch<ConsultantDetailPayload>(`/api/admin/consultants/${consultantId}`);
      setViewConsultantDetail(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load consultant profile.');
    }
  };

  const handleSaveEditConsultant = async (e: FormEvent) => {
    e.preventDefault();
    if (!editConsultantModal) return;
    setError('');
    try {
      await apiFetch(`/api/admin/consultants/${editConsultantModal.id}`, {
        method: 'PATCH',
        body: JSON.stringify(editConsultantModal),
      });
      setEditConsultantModal(null);
      setFeedback('Consultant details updated.');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update consultant.');
    }
  };

  const handleSeedDemoData = async () => {
    if (demoBusy) return;
    setDemoBusy(true);
    setError('');
    setFeedback('');
    try {
      const res = await apiFetch<{ message: string }>('/api/superadmin/demo-data/seed', { method: 'POST' });
      setFeedback(res.message);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to seed demonstration data.');
    } finally {
      setDemoBusy(false);
    }
  };

  const handleRemoveDemoData = async () => {
    if (demoBusy) return;
    setDemoBusy(true);
    setError('');
    setFeedback('');
    try {
      const res = await apiFetch<{ message: string }>('/api/superadmin/demo-data', { method: 'DELETE' });
      setConfirmRemoveDemo(false);
      setFeedback(res.message);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove demonstration data.');
    } finally {
      setDemoBusy(false);
    }
  };

  const handleCreateCategory = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setFeedback('');
    try {
      await apiFetch('/api/admin/categories', { method: 'POST', body: JSON.stringify(newCategory) });
      setNewCategory({ name: '', description: '', imageUrl: '' });
      setFeedback('Service category created.');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create category.');
    }
  };

  const handleSaveEditCategory = async (e: FormEvent) => {
    e.preventDefault();
    if (!editCategory) return;
    setError('');
    setFeedback('');
    try {
      await apiFetch(`/api/admin/categories/${editCategory.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editCategory.name.trim(),
          description: editCategory.description.trim(),
          imageUrl: editCategory.imageUrl.trim(),
          isActive: editCategory.isActive,
        }),
      });
      setFeedback(`Category "${editCategory.name}" updated.`);
      setEditCategory(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update category.');
    }
  };

  const handleImageFileSelect = (file: File | null, target: 'new' | 'edit' | 'new-cat' | 'edit-cat') => {
    if (!file) return;
    if (file.size > 400 * 1024) {
      setServiceError('Uploaded image must be under 400 KB (or choose a curated photo / paste an image URL).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      if (target === 'new') {
        setNewService((prev) => ({ ...prev, imageUrl: dataUrl }));
      } else if (target === 'edit') {
        setEditService((prev) => (prev ? { ...prev, imageUrl: dataUrl } : prev));
      } else if (target === 'new-cat') {
        setNewCategory((prev) => ({ ...prev, imageUrl: dataUrl }));
      } else if (target === 'edit-cat') {
        setEditCategory((prev) => (prev ? { ...prev, imageUrl: dataUrl } : prev));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleQuickPriceSave = async (serviceId: string) => {
    const raw = priceDrafts[serviceId];
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 100) {
      setServiceError('Price must be at least ₹100.');
      return;
    }
    setServiceError('');
    setServiceSuccess('');
    try {
      await apiFetch(`/api/admin/services/${serviceId}`, {
        method: 'PATCH',
        body: JSON.stringify({ priceInr: Math.round(parsed) }),
      });
      setServiceSuccess('Service price updated.');
      setFeedback('Service price updated.');
      setPriceDrafts((prev) => {
        const next = { ...prev };
        delete next[serviceId];
        return next;
      });
      await loadAll();
    } catch (err) {
      setServiceError(err instanceof Error ? err.message : 'Failed to update price.');
    }
  };

  const handleCreateService = async (e: FormEvent) => {
    e.preventDefault();
    if (publishingService) return;

    setError('');
    setFeedback('');
    setServiceError('');
    setServiceSuccess('');

    const resolvedCategoryId = (newService.categoryId || categories[0]?.id || '').trim();
    const cleanTitle = newService.title.trim();
    const cleanShort = newService.shortDescription.trim();
    const cleanDeliverables = newService.deliverables.trim();
    const cleanDescription = newService.description.trim();
    const numericPrice = Number(newService.priceInr);
    const numericDays = Math.max(1, Number(newService.estimatedDays || 7) || 7);

    if (!resolvedCategoryId) {
      const msg = 'Please select a service category before publishing.';
      setServiceError(msg);
      setError(msg);
      return;
    }
    if (!Number.isFinite(numericPrice) || numericPrice < 100) {
      const msg = 'Please enter a valid service price of at least ₹100.';
      setServiceError(msg);
      setError(msg);
      return;
    }
    if (!cleanTitle) {
      const msg = 'Service title is required.';
      setServiceError(msg);
      setError(msg);
      return;
    }
    if (!cleanDeliverables) {
      const msg = 'Deliverables summary is required.';
      setServiceError(msg);
      setError(msg);
      return;
    }
    if (!cleanDescription) {
      const msg = 'Service description is required.';
      setServiceError(msg);
      setError(msg);
      return;
    }

    setPublishingService(true);
    try {
      const created = await apiFetch<{ id: string; service?: ServiceItem }>('/api/admin/services', {
        method: 'POST',
        body: JSON.stringify({
          categoryId: resolvedCategoryId,
          title: cleanTitle,
          shortDescription: cleanShort || cleanDescription.slice(0, 120),
          description: cleanDescription,
          priceInr: Math.round(numericPrice),
          packageName: newService.packageName || 'Standard Package',
          deliverables: cleanDeliverables,
          estimatedDays: numericDays,
          requiredSkills: newService.requiredSkills.trim(),
          imageUrl: newService.imageUrl.trim(),
        }),
      });

      if (created.service) {
        setServices((prev) => [created.service!, ...prev.filter((item) => item.id !== created.service!.id)]);
      }

      setNewService({
        categoryId: categories[0]?.id || resolvedCategoryId,
        title: '',
        shortDescription: '',
        description: '',
        priceInr: '',
        packageName: 'Standard Package',
        deliverables: '',
        estimatedDays: '7',
        requiredSkills: '',
        imageUrl: '',
      });
      setServiceSuccess('Service published successfully!');
      setFeedback('Service published successfully!');
      await loadAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to publish service listing.';
      setServiceError(msg);
      setError(msg);
    } finally {
      setPublishingService(false);
    }
  };

  const handleSaveEditService = async (e: FormEvent) => {
    e.preventDefault();
    if (!editService) return;
    setServiceError('');
    setServiceSuccess('');
    try {
      await apiFetch(`/api/admin/services/${editService.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          categoryId: editService.categoryId,
          title: editService.title.trim(),
          shortDescription: editService.shortDescription.trim(),
          description: editService.description.trim(),
          priceInr: Math.round(Number(editService.priceInr)),
          packageName: editService.packageName.trim(),
          deliverables: editService.deliverables.trim(),
          estimatedDays: Math.max(1, Number(editService.estimatedDays) || 7),
          requiredSkills: editService.requiredSkills.trim(),
          imageUrl: editService.imageUrl.trim(),
          isActive: editService.isActive,
        }),
      });
      setServiceSuccess(`Service "${editService.title}" updated successfully!`);
      setFeedback(`Service "${editService.title}" updated.`);
      setEditService(null);
      await loadAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update service.';
      setServiceError(msg);
      setError(msg);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    setServiceError('');
    setServiceSuccess('');
    setError('');
    try {
      await apiFetch(`/api/admin/services/${serviceId}`, { method: 'DELETE' });
      setDeleteConfirmServiceId(null);
      setServiceSuccess('Service deleted permanently.');
      setFeedback('Service deleted.');
      await loadAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete service.';
      setServiceError(msg);
      setError(msg);
      setDeleteConfirmServiceId(null);
    }
  };

  const handleToggleService = async (srv: ServiceItem) => {
    setError('');
    try {
      await apiFetch(`/api/admin/services/${srv.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: srv.is_active === 1 ? false : true }),
      });
      setFeedback(`Service "${srv.title}" marked ${srv.is_active === 1 ? 'Inactive' : 'Active'}.`);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update service status.');
    }
  };

  const handleSendQuote = async (e: FormEvent) => {
    e.preventDefault();
    if (!quoteDraft) return;
    await apiFetch(`/api/bookings/${quoteDraft.bookingId}/quotation`, {
      method: 'POST',
      body: JSON.stringify({
        amountInr: Number(quoteDraft.amountInr),
        scopeNotes: quoteDraft.scopeNotes,
        validUntil: quoteDraft.validUntil,
      }),
    });
    setQuoteDraft(null);
    setFeedback('Quotation issued to customer.');
    await loadAll();
  };

  const handleAssignConsultant = async (bookingId: string) => {
    const consultantId = assignChoice[bookingId];
    if (!consultantId) return;
    setError('');
    try {
      await apiFetch(`/api/bookings/${bookingId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ consultantId }),
      });
      setFeedback('Consultant assigned and project + invoice initialised.');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assignment failed.');
    }
  };

  const handleSaveTx = async (e: FormEvent) => {
    e.preventDefault();
    if (!txUpdate) return;
    await apiFetch(`/api/finance/transactions/${txUpdate.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: txUpdate.status,
        paymentMethod: txUpdate.method,
        paymentReference: txUpdate.ref,
        refundAmountInr: Number(txUpdate.refund || 0),
      }),
    });
    setTxUpdate(null);
    setFeedback('Transaction & invoice updated.');
    await loadAll();
  };

  const handleRecordPayout = async (e: FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/finance/payouts', {
      method: 'POST',
      body: JSON.stringify({ ...payoutForm, amountInr: Number(payoutForm.amountInr) }),
    });
    setPayoutForm({ consultantId: '', amountInr: '', reference: '', periodLabel: '' });
    setFeedback('Consultant payout recorded.');
    await loadAll();
  };

  const handleRecordExpense = async (e: FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/finance/expenses', {
      method: 'POST',
      body: JSON.stringify({ ...expenseForm, amountInr: Number(expenseForm.amountInr) }),
    });
    setExpenseForm({ ...expenseForm, description: '', amountInr: '' });
    setFeedback('Operating expense recorded.');
    await loadAll();
  };

  const handleSaveGlobalSettings = async (e: FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/superadmin/settings', {
      method: 'PATCH',
      body: JSON.stringify({
        commissionPct: Number(commissionInput),
        taxPct: Number(taxInput),
        allowDuplicateBookings: allowDupBookings,
      }),
    });
    setFeedback('Global financial and platform rules saved.');
    await loadAll();
  };

  const handleCreateAdmin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await apiFetch('/api/superadmin/admins', {
        method: 'POST',
        body: JSON.stringify(newAdmin),
      });
      setNewAdmin({ fullName: '', email: '', mobile: '', password: '', role: 'admin' });
      setFeedback('Administrative account provisioned.');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Admin creation failed.');
    }
  };

  const handleCreateSubscription = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await apiFetch('/api/superadmin/subscriptions', {
        method: 'POST',
        body: JSON.stringify({
          customerId: subForm.customerId,
          serviceId: subForm.serviceId || null,
          planName: subForm.planName,
          monthlyPriceInr: Number(subForm.monthlyPriceInr),
          nextBillingDate: subForm.nextBillingDate,
          notes: subForm.notes,
        }),
      });
      setFeedback('Monthly retainer subscription created.');
      setSubForm({ ...subForm, notes: '' });
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create subscription.');
    }
  };

  const handleSubscriptionStatus = async (subId: string, status: 'Active' | 'Paused' | 'Cancelled') => {
    setError('');
    try {
      await apiFetch(`/api/superadmin/subscriptions/${subId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setFeedback(`Subscription updated to ${status}.`);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update subscription.');
    }
  };

  const exportTransactionsCsv = () => {
    downloadCsv(
      `campus-consult-transactions-${new Date().toISOString().slice(0, 10)}.csv`,
      ['ID', 'Date', 'Customer', 'Service', 'Gross INR', 'Tax INR', 'Total Payable', 'Commission INR', 'Consultant Earning', 'Method', 'Status'],
      transactions.map((t) => [
        t.id,
        t.created_at,
        t.business_name || t.customer_name,
        t.service_title,
        t.gross_amount_inr,
        t.tax_amount_inr,
        t.total_payable_inr,
        t.commission_amount_inr,
        t.consultant_earning_inr,
        t.payment_method,
        t.status,
      ])
    );
  };

  return (
    <PortalLayout
      roleLabel={isSuperAdmin ? 'Super Admin Panel' : 'Admin Command Centre'}
      navItems={navItems}
      activeTab={tab}
      onTabChange={setTab}
      onGoPublic={onGoPublic}
      globalSearch={search}
      onGlobalSearchChange={setSearch}
    >
      {feedback && (
        <div className="no-print mb-5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-md text-xs sm:text-sm text-emerald-900">
          {feedback}
        </div>
      )}
      {error && (
        <div className="no-print mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-md text-xs sm:text-sm text-rose-800">
          {error}
        </div>
      )}

      {/* OVERVIEW */}
      {tab === 'overview' && kpis && (
        <div className="space-y-6">
          {/* Analytics Scope Toggle: Genuine Only vs Including Demo Data */}
          <div className="bg-white border border-zinc-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div>
              <div className="font-semibold text-zinc-900">
                Platform Analytics Scope:{' '}
                <span className={includeDemoInAnalytics ? 'text-amber-800' : 'text-emerald-800'}>
                  {includeDemoInAnalytics ? 'Including DEMO DATA' : 'Genuine Real Business Data Only'}
                </span>
              </div>
              {demoSummary && (demoSummary.customers > 0 || demoSummary.consultants > 0) && (
                <div className="text-zinc-500 mt-0.5">
                  Demo records in DB: {demoSummary.customers} customers · {demoSummary.consultants} consultants ({demoSummary.pendingConsultants} pending) · {demoSummary.bookings} bookings · {formatINR(demoSummary.revenueInr)} demo revenue
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const next = !includeDemoInAnalytics;
                  setIncludeDemoInAnalytics(next);
                  void loadOverviewOnly(biRange, biFrom, biTo, next);
                }}
                className={`px-3 py-1.5 rounded border font-medium cursor-pointer ${
                  includeDemoInAnalytics
                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                }`}
              >
                {includeDemoInAnalytics ? 'Switch to Genuine Data Only' : 'Preview With Demo Data'}
              </button>
              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={() => setTab('superadmin')}
                  className="px-3 py-1.5 rounded bg-purple-800 hover:bg-purple-900 text-white font-medium cursor-pointer"
                >
                  Manage Demo Data / Settings
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[
              ['Total Customers', kpis.totalCustomers, 'text-zinc-900'],
              ['Total Consultants', kpis.totalConsultants, 'text-zinc-900'],
              ['Approved Consultants', kpis.approvedConsultants ?? 0, 'text-emerald-700'],
              ['Pending Verification', kpis.pendingConsultantApprovals, 'text-amber-700'],
              ['Active Services', kpis.totalServices, 'text-zinc-900'],
              ['Total Bookings', kpis.totalBookings, 'text-zinc-900'],
              ['Pending Bookings', kpis.pendingBookings ?? 0, 'text-amber-700'],
              ['Completed Projects', kpis.completedProjects, 'text-emerald-700'],
              ['Total Revenue', formatINR(kpis.grossRevenueInr), 'text-purple-900'],
              ['Pending Payments', formatINR(kpis.pendingPaymentsInr), 'text-amber-700'],
              ['Platform Commission', formatINR(kpis.platformCommissionInr), 'text-purple-900'],
              ['Net Operating Surplus', formatINR(kpis.netOperatingSurplusInr), kpis.netOperatingSurplusInr >= 0 ? 'text-emerald-700' : 'text-rose-700'],
            ].map(([label, val, cls]) => (
              <div key={String(label)} className="bg-white border border-zinc-200 rounded-lg p-4">
                <div className="text-xs text-zinc-500">{label}</div>
                <div className={`font-mono-tabular text-2xl font-semibold mt-1 ${cls}`}>{val}</div>
              </div>
            ))}
          </div>

          {/* Overview Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-zinc-200 rounded-lg p-6">
              <h3 className="text-sm font-semibold text-zinc-900 mb-3">Monthly Revenue Chart</h3>
              {monthlyRevenueSeries.length === 0 ? (
                <p className="text-xs text-zinc-500">No settled transactions in the selected scope yet (₹0).</p>
              ) : (
                <div className="space-y-3 text-xs">
                  {(() => {
                    const maxRev = Math.max(1, ...monthlyRevenueSeries.map((m) => m.revenue_inr));
                    return monthlyRevenueSeries.map((m) => (
                      <div key={m.month} className="space-y-1">
                        <div className="flex justify-between font-mono-tabular">
                          <span className="font-semibold text-zinc-800">{m.month} ({m.tx_count} tx)</span>
                          <span>{formatINR(m.revenue_inr)}</span>
                        </div>
                        <div className="w-full h-2.5 bg-zinc-100 rounded overflow-hidden">
                          <div className="h-full bg-purple-800" style={{ width: `${Math.max(4, Math.round((m.revenue_inr / maxRev) * 100))}%` }} />
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>

            <div className="bg-white border border-zinc-200 rounded-lg p-6">
              <h3 className="text-sm font-semibold text-zinc-900 mb-3">Booking Trends &amp; Customer Growth</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="font-medium text-zinc-700 mb-2">Recent Booking Volume</div>
                  {bookingTrends.length === 0 ? (
                    <p className="text-zinc-500">No bookings recorded in current scope.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {bookingTrends.slice(-6).map((b) => (
                        <div key={b.date} className="flex justify-between py-1 border-b border-zinc-100 font-mono-tabular">
                          <span>{b.date}</span>
                          <span className="font-semibold text-zinc-900">{b.total_bookings} ({b.completed_bookings} done)</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <div className="font-medium text-zinc-700 mb-2">Monthly Customer Growth</div>
                  {customerGrowthSeries.length === 0 ? (
                    <p className="text-zinc-500">No customer registrations yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {customerGrowthSeries.map((g) => (
                        <div key={g.month} className="flex justify-between py-1 border-b border-zinc-100 font-mono-tabular">
                          <span>{g.month}</span>
                          <span className="font-semibold text-purple-900">+{g.registrations} businesses</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Consultant Performance + Recent Activity Feeds */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white border border-zinc-200 rounded-lg p-5">
              <h3 className="text-sm font-semibold text-zinc-900 mb-3">Consultant Performance</h3>
              {consultantBreakdown.length === 0 ? (
                <p className="text-xs text-zinc-500">No consultants in current scope.</p>
              ) : (
                <div className="space-y-2 text-xs">
                  {consultantBreakdown.slice(0, 6).map((c) => (
                    <div key={c.id} className="flex items-center justify-between py-1.5 border-b border-zinc-100">
                      <div>
                        <span className="font-medium text-zinc-900">{c.full_name}</span>
                        {c.is_demo === 1 && <span className="ml-1.5 px-1 py-0.5 bg-amber-100 text-amber-900 text-[9px] font-semibold rounded">DEMO</span>}
                        <div className="text-[11px] text-zinc-500">{c.completed_count} projects · {c.rating_avg > 0 ? `${c.rating_avg}/5` : 'New'}</div>
                      </div>
                      <span className="font-mono-tabular font-semibold text-purple-900">{formatINR(c.earned_inr)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-zinc-200 rounded-lg p-5">
              <h3 className="text-sm font-semibold text-zinc-900 mb-3">Recent Registrations</h3>
              {recentRegistrations.length === 0 ? (
                <p className="text-xs text-zinc-500">No customer or consultant registrations yet.</p>
              ) : (
                <div className="space-y-2 text-xs">
                  {recentRegistrations.map((r) => (
                    <div key={r.id} className="py-1.5 border-b border-zinc-100">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-zinc-900 truncate">{r.business_name || r.full_name}</span>
                        <span className="capitalize text-[11px] font-semibold text-purple-800 shrink-0">
                          {r.role}{r.is_demo === 1 ? ' · DEMO' : ''}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-500">{r.email} · {formatDateShort(r.created_at)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-zinc-200 rounded-lg p-5">
              <h3 className="text-sm font-semibold text-zinc-900 mb-3">Recent Bookings &amp; Activities</h3>
              {recentBookings.length === 0 && recentActivities.length === 0 ? (
                <p className="text-xs text-zinc-500">No bookings or activity logged yet.</p>
              ) : (
                <div className="space-y-2 text-xs">
                  {recentBookings.slice(0, 4).map((b) => (
                    <div key={b.id} className="py-1.5 border-b border-zinc-100">
                      <div className="flex justify-between gap-2">
                        <span className="font-medium text-zinc-900 truncate">{b.service_title}</span>
                        <span className="font-mono-tabular text-purple-900 shrink-0">{formatINR(b.quoted_price_inr)}</span>
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        {b.business_name || b.customer_name} · {b.status}{b.is_demo === 1 ? ' · DEMO' : ''}
                      </div>
                    </div>
                  ))}
                  {recentActivities.slice(0, 4).map((a) => (
                    <div key={a.id} className="py-1 border-b border-zinc-100 text-[11px] text-zinc-600">
                      <strong className="text-zinc-800">{a.action}</strong> by {a.actor_name || 'System'} · {formatDateShort(a.created_at)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-lg p-6 text-xs sm:text-sm text-zinc-600 space-y-2">
            <h3 className="text-base font-semibold text-zinc-900">Live Integration &amp; Configuration Status</h3>
            <p>
              <strong>Database:</strong> Persistent Server-Side SQLite ({integrations?.database}) ·{' '}
              <strong>Real-Time Messaging:</strong> WebSocket Active ({integrations?.realtime}) ·{' '}
              <strong>Razorpay Online Gateway:</strong> {integrations?.razorpayConfigured ? 'Configured' : 'Manual UPI/Cash/Bank Recording Active (Configure RAZORPAY_KEY_ID & SECRET in env)'} ·{' '}
              <strong>SMTP / WhatsApp API:</strong> {integrations?.emailDeliveryConfigured ? 'Active' : 'In-App Notifications Active (Configure SMTP/WhatsApp env credentials for external dispatch)'}
            </p>
          </div>
        </div>
      )}

      {/* CUSTOMER MANAGEMENT MODULE */}
      {tab === 'customers' && (
        <div className="space-y-6">
          <div className="bg-white border border-zinc-200 rounded-lg p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-zinc-900">Customer Management</h3>
                <p className="text-xs text-zinc-500">View, add, edit, suspend, or audit business customers and their booking/payment history.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddCustomerModal(true)}
                className="px-3.5 py-2 bg-purple-800 hover:bg-purple-900 text-white text-xs font-medium rounded cursor-pointer"
              >
                + Add Customer
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <input
                type="text"
                placeholder="Search customer, email, phone, business..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border border-zinc-300 rounded px-3 py-2"
              />
              <select
                value={customerCategoryFilter}
                onChange={(e) => setCustomerCategoryFilter(e.target.value)}
                className="border border-zinc-300 rounded px-3 py-2 bg-white"
              >
                <option value="">All Business Categories</option>
                {CUSTOMER_BUSINESS_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select
                value={customerStatusFilter}
                onChange={(e) => setCustomerStatusFilter(e.target.value)}
                className="border border-zinc-300 rounded px-3 py-2 bg-white"
              >
                <option value="all">All Account Statuses</option>
                <option value="active">Active Only</option>
                <option value="suspended">Suspended Only</option>
              </select>
              <select
                value={customerSourceFilter}
                onChange={(e) => setCustomerSourceFilter(e.target.value)}
                className="border border-zinc-300 rounded px-3 py-2 bg-white"
              >
                <option value="all">Genuine + Demo Data</option>
                <option value="real">Genuine Customers Only</option>
                <option value="demo">DEMO DATA Only</option>
              </select>
            </div>

            <div className="overflow-x-auto border border-zinc-200 rounded-md">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F4F3F8] border-b border-zinc-200">
                    <th className="py-2.5 px-3 font-semibold">Customer ID</th>
                    <th className="py-2.5 px-3 font-semibold">Customer / Email</th>
                    <th className="py-2.5 px-3 font-semibold">Phone</th>
                    <th className="py-2.5 px-3 font-semibold">Business &amp; Category</th>
                    <th className="py-2.5 px-3 font-semibold">Registered</th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Bookings</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Payments</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {(() => {
                    const filtered = users
                      .filter((u) => u.role === 'customer')
                      .filter((u) => !customerCategoryFilter || u.business_category === customerCategoryFilter)
                      .filter((u) => customerStatusFilter === 'all' || u.status === customerStatusFilter)
                      .filter((u) => customerSourceFilter === 'all' || (customerSourceFilter === 'demo' ? u.is_demo === 1 : u.is_demo !== 1))
                      .filter((u) => !search || `${u.id} ${u.full_name} ${u.email} ${u.mobile} ${u.business_name || ''}`.toLowerCase().includes(search.toLowerCase()));

                    if (filtered.length === 0) {
                      return (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-zinc-500">
                            No customers match your filters. Click "+ Add Customer" or seed Demonstration Data in Super Admin Panel to inspect sample records.
                          </td>
                        </tr>
                      );
                    }
                    return filtered.map((u) => (
                      <tr key={u.id} className="align-top">
                        <td className="py-2.5 px-3 font-mono-tabular text-[11px] text-zinc-600">
                          {u.id.slice(0, 12)}
                          {u.is_demo === 1 && (
                            <div className="mt-1 inline-block px-1.5 py-0.5 bg-amber-100 text-amber-900 rounded text-[10px] font-semibold">
                              DEMO DATA
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-zinc-900">{u.full_name}</div>
                          <div className="text-zinc-500">{u.email}</div>
                        </td>
                        <td className="py-2.5 px-3 font-mono-tabular">{u.mobile}</td>
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-zinc-900">{u.business_name || '—'}</div>
                          <div className="text-zinc-500">{u.business_category || '—'}</div>
                        </td>
                        <td className="py-2.5 px-3 font-mono-tabular text-zinc-600">{formatDateShort(u.created_at)}</td>
                        <td className="py-2.5 px-3">
                          <span className={`font-semibold capitalize ${u.status === 'active' ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {u.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono-tabular text-right font-semibold">{u.customer_bookings_count ?? 0}</td>
                        <td className="py-2.5 px-3 font-mono-tabular text-right font-semibold text-purple-900">{formatINR(u.customer_paid_inr ?? 0)}</td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap space-x-2">
                          <button type="button" onClick={() => void handleOpenCustomerProfile(u.id)} className="text-purple-800 hover:underline cursor-pointer font-medium">
                            View Profile
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setEditCustomerModal({
                                id: u.id,
                                fullName: u.full_name,
                                mobile: u.mobile,
                                status: u.status,
                                businessName: u.business_name || '',
                                businessCategory: u.business_category || CUSTOMER_BUSINESS_CATEGORIES[0],
                                address: u.address || '',
                                gstin: u.gstin || '',
                              })
                            }
                            className="text-blue-700 hover:underline cursor-pointer font-medium"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleUserStatus(u.id, u.status === 'active' ? 'suspended' : 'active')}
                            className="text-zinc-700 hover:underline cursor-pointer"
                          >
                            {u.status === 'active' ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmCustomer(u)}
                            className="text-rose-700 hover:underline cursor-pointer"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          {inquiries.length > 0 && (
            <div className="bg-white border border-zinc-200 rounded-lg p-6">
              <h4 className="text-sm font-semibold text-zinc-900 mb-3">Public Contact Inquiries ({inquiries.length})</h4>
              <div className="space-y-2 text-xs">
                {inquiries.map((inq) => (
                  <div key={inq.id} className="p-3 border border-zinc-200 rounded">
                    <strong>{inq.name}</strong> ({inq.email} · {inq.mobile}) — {inq.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ADD CUSTOMER MODAL */}
          {showAddCustomerModal && (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
              <form onSubmit={handleCreateCustomer} className="bg-white border border-zinc-200 rounded-lg max-w-lg w-full p-6 space-y-3 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
                  <h3 className="text-base font-semibold text-zinc-900">Add Business Customer</h3>
                  <button type="button" onClick={() => setShowAddCustomerModal(false)} className="text-xs text-zinc-500 cursor-pointer">Close</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <input type="text" required placeholder="Full Name" value={addCustomerForm.fullName} onChange={(e) => setAddCustomerForm({ ...addCustomerForm, fullName: e.target.value })} className="border border-zinc-300 rounded px-3 py-2" />
                  <input type="tel" required placeholder="Phone Number" value={addCustomerForm.mobile} onChange={(e) => setAddCustomerForm({ ...addCustomerForm, mobile: e.target.value })} className="border border-zinc-300 rounded px-3 py-2" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <input type="email" required placeholder="Email Address" value={addCustomerForm.email} onChange={(e) => setAddCustomerForm({ ...addCustomerForm, email: e.target.value })} className="border border-zinc-300 rounded px-3 py-2" />
                  <input type="password" required minLength={8} placeholder="Password (8+ chars)" value={addCustomerForm.password} onChange={(e) => setAddCustomerForm({ ...addCustomerForm, password: e.target.value })} className="border border-zinc-300 rounded px-3 py-2" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <input type="text" required placeholder="Business Name" value={addCustomerForm.businessName} onChange={(e) => setAddCustomerForm({ ...addCustomerForm, businessName: e.target.value })} className="border border-zinc-300 rounded px-3 py-2" />
                  <select value={addCustomerForm.businessCategory} onChange={(e) => setAddCustomerForm({ ...addCustomerForm, businessCategory: e.target.value })} className="border border-zinc-300 rounded px-3 py-2 bg-white">
                    {CUSTOMER_BUSINESS_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <input type="text" required placeholder="Dehradun Shop / Business Address" value={addCustomerForm.address} onChange={(e) => setAddCustomerForm({ ...addCustomerForm, address: e.target.value })} className="w-full border border-zinc-300 rounded px-3 py-2 text-sm" />
                <input type="text" placeholder="GSTIN (optional)" value={addCustomerForm.gstin} onChange={(e) => setAddCustomerForm({ ...addCustomerForm, gstin: e.target.value })} className="w-full border border-zinc-300 rounded px-3 py-2 text-sm" />
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowAddCustomerModal(false)} className="px-4 py-2 border border-zinc-300 text-xs rounded cursor-pointer">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-purple-800 text-white text-xs font-medium rounded cursor-pointer">Create Customer</button>
                </div>
              </form>
            </div>
          )}

          {/* EDIT CUSTOMER MODAL */}
          {editCustomerModal && (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
              <form onSubmit={handleSaveEditCustomer} className="bg-white border border-zinc-200 rounded-lg max-w-lg w-full p-6 space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
                  <h3 className="text-base font-semibold text-zinc-900">Edit Customer Account</h3>
                  <button type="button" onClick={() => setEditCustomerModal(null)} className="text-xs text-zinc-500 cursor-pointer">Close</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <input type="text" required value={editCustomerModal.fullName} onChange={(e) => setEditCustomerModal({ ...editCustomerModal, fullName: e.target.value })} placeholder="Full Name" className="border border-zinc-300 rounded px-3 py-2" />
                  <input type="tel" required value={editCustomerModal.mobile} onChange={(e) => setEditCustomerModal({ ...editCustomerModal, mobile: e.target.value })} placeholder="Mobile" className="border border-zinc-300 rounded px-3 py-2" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <input type="text" required value={editCustomerModal.businessName} onChange={(e) => setEditCustomerModal({ ...editCustomerModal, businessName: e.target.value })} placeholder="Business Name" className="border border-zinc-300 rounded px-3 py-2" />
                  <select value={editCustomerModal.businessCategory} onChange={(e) => setEditCustomerModal({ ...editCustomerModal, businessCategory: e.target.value })} className="border border-zinc-300 rounded px-3 py-2 bg-white">
                    {CUSTOMER_BUSINESS_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <input type="text" required value={editCustomerModal.address} onChange={(e) => setEditCustomerModal({ ...editCustomerModal, address: e.target.value })} placeholder="Address" className="w-full border border-zinc-300 rounded px-3 py-2 text-sm" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <input type="text" value={editCustomerModal.gstin} onChange={(e) => setEditCustomerModal({ ...editCustomerModal, gstin: e.target.value })} placeholder="GSTIN" className="border border-zinc-300 rounded px-3 py-2" />
                  <select value={editCustomerModal.status} onChange={(e) => setEditCustomerModal({ ...editCustomerModal, status: e.target.value })} className="border border-zinc-300 rounded px-3 py-2 bg-white">
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setEditCustomerModal(null)} className="px-4 py-2 border border-zinc-300 text-xs rounded cursor-pointer">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-purple-800 text-white text-xs font-medium rounded cursor-pointer">Save Customer</button>
                </div>
              </form>
            </div>
          )}

          {/* VIEW CUSTOMER PROFILE MODAL */}
          {viewCustomerDetail && (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
              <div className="bg-white border border-zinc-200 rounded-lg max-w-3xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto text-xs">
                <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
                  <div>
                    <h3 className="text-base font-semibold text-zinc-900">{viewCustomerDetail.customer.business_name || viewCustomerDetail.customer.full_name}</h3>
                    <div className="text-zinc-500">{viewCustomerDetail.customer.id} · Registered {formatDateShort(viewCustomerDetail.customer.created_at)}</div>
                  </div>
                  <button type="button" onClick={() => setViewCustomerDetail(null)} className="px-3 py-1 border border-zinc-300 rounded cursor-pointer">Close</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-[#FAFAFC] border border-zinc-200 rounded">
                  <div><strong>Owner:</strong> {viewCustomerDetail.customer.full_name}</div>
                  <div><strong>Email:</strong> {viewCustomerDetail.customer.email}</div>
                  <div><strong>Phone:</strong> {viewCustomerDetail.customer.mobile}</div>
                  <div><strong>Category:</strong> {viewCustomerDetail.customer.business_category}</div>
                  <div><strong>Address:</strong> {viewCustomerDetail.customer.address}</div>
                  <div><strong>GSTIN:</strong> {viewCustomerDetail.customer.gstin || 'Unregistered'}</div>
                </div>
                <div>
                  <h4 className="font-semibold text-zinc-900 mb-2">Booking History ({viewCustomerDetail.bookings.length})</h4>
                  {viewCustomerDetail.bookings.length === 0 ? (
                    <p className="text-zinc-500">No bookings placed yet.</p>
                  ) : (
                    <div className="border border-zinc-200 rounded overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead><tr className="bg-[#F4F3F8] border-b border-zinc-200"><th className="py-2 px-3">Service</th><th className="py-2 px-3">Consultant</th><th className="py-2 px-3">Status</th><th className="py-2 px-3 text-right">Quoted</th></tr></thead>
                        <tbody className="divide-y divide-zinc-200">
                          {viewCustomerDetail.bookings.map((b) => (
                            <tr key={b.id}><td className="py-2 px-3">{b.service_title}</td><td className="py-2 px-3">{b.assigned_consultant_name || 'Unassigned'}</td><td className="py-2 px-3 font-medium">{b.status}</td><td className="py-2 px-3 text-right font-mono-tabular">{formatINR(b.quoted_price_inr)}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div>
                  <h4 className="font-semibold text-zinc-900 mb-2">Payment History ({viewCustomerDetail.transactions.length})</h4>
                  {viewCustomerDetail.transactions.length === 0 ? (
                    <p className="text-zinc-500">No payment transactions recorded yet.</p>
                  ) : (
                    <div className="border border-zinc-200 rounded overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead><tr className="bg-[#F4F3F8] border-b border-zinc-200"><th className="py-2 px-3">Service</th><th className="py-2 px-3">Method / Ref</th><th className="py-2 px-3">Status</th><th className="py-2 px-3 text-right">Amount</th></tr></thead>
                        <tbody className="divide-y divide-zinc-200">
                          {viewCustomerDetail.transactions.map((t) => (
                            <tr key={t.id}><td className="py-2 px-3">{t.service_title}</td><td className="py-2 px-3">{t.payment_method} {t.payment_reference ? `· ${t.payment_reference}` : ''}</td><td className="py-2 px-3 font-medium">{t.status}</td><td className="py-2 px-3 text-right font-mono-tabular">{formatINR(t.total_payable_inr)}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* DELETE CUSTOMER CONFIRMATION MODAL */}
          {deleteConfirmCustomer && (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
              <div className="bg-white border border-zinc-200 rounded-lg max-w-md w-full p-6 space-y-4 text-sm">
                <h3 className="font-semibold text-rose-800">Confirm Customer Deletion</h3>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Are you sure you want to permanently delete <strong>{deleteConfirmCustomer.full_name}</strong> ({deleteConfirmCustomer.email}) and their linked customer bookings/records? This cannot be undone.
                </p>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setDeleteConfirmCustomer(null)} className="px-3 py-1.5 border border-zinc-300 text-xs rounded cursor-pointer">Cancel</button>
                  <button type="button" onClick={() => void handleDeleteCustomer(deleteConfirmCustomer.id)} className="px-3 py-1.5 bg-rose-700 text-white text-xs font-medium rounded cursor-pointer">Delete Permanently</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CONSULTANT MANAGEMENT MODULE */}
      {tab === 'consultants' && (
        <div className="space-y-6">
          <div className="bg-white border border-zinc-200 rounded-lg p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-zinc-900">Student Consultant Management</h3>
                <p className="text-xs text-zinc-500">Full directory of student consultants, skills, credentials, assigned projects, and payouts.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <input
                type="text"
                placeholder="Search name, skills, specialisation, student ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border border-zinc-300 rounded px-3 py-2"
              />
              <select
                value={consultantApprovalFilter}
                onChange={(e) => setConsultantApprovalFilter(e.target.value)}
                className="border border-zinc-300 rounded px-3 py-2 bg-white"
              >
                <option value="all">All Verification Statuses</option>
                <option value="approved">Approved</option>
                <option value="pending">Pending Verification</option>
                <option value="rejected">Rejected</option>
              </select>
              <select
                value={consultantSourceFilter}
                onChange={(e) => setConsultantSourceFilter(e.target.value)}
                className="border border-zinc-300 rounded px-3 py-2 bg-white"
              >
                <option value="all">Genuine + Demo Data</option>
                <option value="real">Genuine Consultants Only</option>
                <option value="demo">DEMO DATA Only</option>
              </select>
            </div>

            <div className="overflow-x-auto border border-zinc-200 rounded-md">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F4F3F8] border-b border-zinc-200">
                    <th className="py-2.5 px-3 font-semibold">ID / Name</th>
                    <th className="py-2.5 px-3 font-semibold">Contact</th>
                    <th className="py-2.5 px-3 font-semibold">Qualification &amp; Specialisation</th>
                    <th className="py-2.5 px-3 font-semibold">Skills &amp; Experience</th>
                    <th className="py-2.5 px-3 font-semibold">Registered / Verification</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Projects</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Earnings</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {(() => {
                    const filtered = users
                      .filter((u) => u.role === 'consultant')
                      .filter((u) => consultantApprovalFilter === 'all' || u.approval_status === consultantApprovalFilter)
                      .filter((u) => consultantSourceFilter === 'all' || (consultantSourceFilter === 'demo' ? u.is_demo === 1 : u.is_demo !== 1))
                      .filter((u) => !search || `${u.id} ${u.full_name} ${u.email} ${u.specialisation || ''} ${u.skills_json || ''} ${u.student_id || ''}`.toLowerCase().includes(search.toLowerCase()));

                    if (filtered.length === 0) {
                      return (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-zinc-500">
                            No student consultants match the current filter.
                          </td>
                        </tr>
                      );
                    }
                    return filtered.map((u) => {
                      const skillsArr = parseSkillsList(u.skills_json);
                      return (
                        <tr key={u.id} className="align-top">
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-zinc-900">{u.full_name}</div>
                            <div className="font-mono-tabular text-[11px] text-zinc-500">{u.student_id || u.id.slice(0, 12)}</div>
                            {u.is_demo === 1 && (
                              <span className="mt-1 inline-block px-1.5 py-0.5 bg-amber-100 text-amber-900 rounded text-[10px] font-semibold">
                                DEMO DATA
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <div>{u.email}</div>
                            <div className="font-mono-tabular text-zinc-500">{u.mobile}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-medium text-zinc-900">{u.qualification || u.course || '—'}</div>
                            <div className="text-zinc-600">{u.university}</div>
                            <div className="text-purple-800">{u.specialisation}</div>
                          </td>
                          <td className="py-2.5 px-3 max-w-[220px]">
                            <div>{skillsArr.length > 0 ? skillsArr.join(', ') : '—'}</div>
                            {u.experience && <div className="text-zinc-500 mt-0.5 line-clamp-2">{u.experience}</div>}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="text-zinc-500 font-mono-tabular">{formatDateShort(u.created_at)}</div>
                            <div className={`font-semibold capitalize ${u.approval_status === 'approved' ? 'text-emerald-700' : u.approval_status === 'rejected' ? 'text-rose-700' : 'text-amber-700'}`}>
                              {u.approval_status}
                            </div>
                            <div className="text-[11px] text-zinc-500 capitalize">Account: {u.status}</div>
                          </td>
                          <td className="py-2.5 px-3 font-mono-tabular text-right font-semibold">{u.consultant_projects_count ?? 0}</td>
                          <td className="py-2.5 px-3 font-mono-tabular text-right font-semibold text-purple-900">{formatINR(u.consultant_earned_inr ?? 0)}</td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap space-x-2">
                            <button type="button" onClick={() => void handleOpenConsultantProfile(u.id)} className="text-purple-800 hover:underline cursor-pointer font-medium">
                              Profile / Docs
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setEditConsultantModal({
                                  id: u.id,
                                  fullName: u.full_name,
                                  mobile: u.mobile,
                                  status: u.status,
                                  studentId: u.student_id || '',
                                  university: u.university || '',
                                  course: u.course || '',
                                  qualification: u.qualification || '',
                                  specialisation: u.specialisation || '',
                                  skills: skillsArr.join(', '),
                                  experience: u.experience || '',
                                  portfolioUrl: u.portfolio_url || '',
                                  certificationsText: u.certifications_text || '',
                                  availabilityStatus: u.availability_status || 'available',
                                })
                              }
                              className="text-blue-700 hover:underline cursor-pointer font-medium"
                            >
                              Edit
                            </button>
                            {u.approval_status !== 'approved' && (
                              <button type="button" onClick={() => void handleApproval(u.id, 'approved')} className="text-emerald-700 hover:underline cursor-pointer font-medium">
                                Approve
                              </button>
                            )}
                            {u.approval_status !== 'rejected' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setRejectModalTarget({ id: u.id, fullName: u.full_name });
                                  setRejectionReasonDraft('');
                                }}
                                className="text-rose-700 hover:underline cursor-pointer"
                              >
                                Reject
                              </button>
                            )}
                            <button type="button" onClick={() => void handleUserStatus(u.id, u.status === 'active' ? 'suspended' : 'active')} className="text-zinc-700 hover:underline cursor-pointer">
                              {u.status === 'active' ? 'Suspend' : 'Activate'}
                            </button>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CONSULTANT CREDENTIAL VERIFICATION QUEUE */}
      {tab === 'verification' && (
        <div className="space-y-6">
          <div className="bg-white border border-zinc-200 rounded-lg p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-zinc-900">Consultant Credential Verification Queue</h3>
                <p className="text-xs text-zinc-500">Review uploaded Resumes, Student IDs, and qualifications before unlocking full Consultant Dashboard access.</p>
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs">
                {[
                  ['pending', 'Pending Queue'],
                  ['rejected', 'Rejected'],
                  ['approved', 'Approved'],
                  ['all', 'All Applications'],
                ].map(([val, lbl]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setVerificationStatusFilter(val)}
                    className={`px-3 py-1.5 rounded border cursor-pointer ${
                      verificationStatusFilter === val ? 'bg-purple-800 text-white border-purple-800' : 'bg-white text-zinc-700 border-zinc-200'
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto border border-zinc-200 rounded-md">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F4F3F8] border-b border-zinc-200">
                    <th className="py-2.5 px-3 font-semibold">Applicant Name / Contact</th>
                    <th className="py-2.5 px-3 font-semibold">Student ID &amp; College</th>
                    <th className="py-2.5 px-3 font-semibold">Qualification</th>
                    <th className="py-2.5 px-3 font-semibold">Resume Upload</th>
                    <th className="py-2.5 px-3 font-semibold">Identity Document</th>
                    <th className="py-2.5 px-3 font-semibold">Skills &amp; Experience</th>
                    <th className="py-2.5 px-3 font-semibold">Applied / Status</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {(() => {
                    const queue = users
                      .filter((u) => u.role === 'consultant')
                      .filter((u) => verificationStatusFilter === 'all' || u.approval_status === verificationStatusFilter)
                      .filter((u) => !search || `${u.full_name} ${u.email} ${u.student_id || ''} ${u.university || ''}`.toLowerCase().includes(search.toLowerCase()));

                    if (queue.length === 0) {
                      return (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-zinc-500">
                            No consultant applications in "{verificationStatusFilter}" queue.
                          </td>
                        </tr>
                      );
                    }
                    return queue.map((u) => {
                      const skillsArr = parseSkillsList(u.skills_json);
                      return (
                        <tr key={u.id} className="align-top">
                          <td className="py-3 px-3">
                            <div className="font-semibold text-zinc-900">{u.full_name}</div>
                            <div className="text-zinc-600">{u.email}</div>
                            <div className="font-mono-tabular text-zinc-500">{u.mobile}</div>
                            {u.is_demo === 1 && (
                              <span className="mt-1 inline-block px-1.5 py-0.5 bg-amber-100 text-amber-900 rounded text-[10px] font-semibold">
                                DEMO DATA
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-mono-tabular font-semibold text-zinc-900">{u.student_id || 'Not Provided'}</div>
                            <div className="text-zinc-600">{u.university}</div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-medium text-zinc-900">{u.qualification || u.course || '—'}</div>
                            <div className="text-zinc-500">{u.specialisation}</div>
                          </td>
                          <td className="py-3 px-3">
                            {u.resume_doc_id ? (
                              <button
                                type="button"
                                onClick={() =>
                                  void downloadAuthenticatedFile(
                                    `/api/documents/${u.resume_doc_id}/download`,
                                    u.resume_file_name || `${u.full_name}_Resume.pdf`
                                  ).catch((err) => setError(err instanceof Error ? err.message : 'Download failed'))
                                }
                                className="inline-flex items-center gap-1 px-2 py-1 border border-purple-300 bg-purple-50 text-purple-900 rounded hover:bg-purple-100 cursor-pointer"
                              >
                                <Download className="w-3 h-3" aria-hidden="true" />
                                <span>Resume</span>
                              </button>
                            ) : (
                              <span className="text-zinc-400">Not uploaded</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            {u.id_doc_id ? (
                              <button
                                type="button"
                                onClick={() =>
                                  void downloadAuthenticatedFile(
                                    `/api/documents/${u.id_doc_id}/download`,
                                    u.id_doc_file_name || `${u.full_name}_ID.pdf`
                                  ).catch((err) => setError(err instanceof Error ? err.message : 'Download failed'))
                                }
                                className="inline-flex items-center gap-1 px-2 py-1 border border-blue-300 bg-blue-50 text-blue-900 rounded hover:bg-blue-100 cursor-pointer"
                              >
                                <Download className="w-3 h-3" aria-hidden="true" />
                                <span>ID Card</span>
                              </button>
                            ) : (
                              <span className="text-zinc-400">Not uploaded</span>
                            )}
                          </td>
                          <td className="py-3 px-3 max-w-[200px]">
                            <div>{skillsArr.join(', ') || '—'}</div>
                            {u.experience && <div className="text-zinc-500 mt-0.5">{u.experience}</div>}
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-mono-tabular text-zinc-500">{formatDateShort(u.created_at)}</div>
                            <div className={`font-semibold capitalize ${u.approval_status === 'approved' ? 'text-emerald-700' : u.approval_status === 'rejected' ? 'text-rose-700' : 'text-amber-700'}`}>
                              {u.approval_status}
                            </div>
                            {u.rejection_reason && (
                              <div className="text-[11px] text-rose-700 mt-0.5">Reason: {u.rejection_reason}</div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right whitespace-nowrap space-x-2">
                            {u.approval_status !== 'approved' && (
                              <button
                                type="button"
                                onClick={() => void handleApproval(u.id, 'approved')}
                                className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded cursor-pointer font-medium"
                              >
                                Approve
                              </button>
                            )}
                            {u.approval_status !== 'rejected' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setRejectModalTarget({ id: u.id, fullName: u.full_name });
                                  setRejectionReasonDraft('');
                                }}
                                className="px-2.5 py-1 border border-rose-300 text-rose-700 hover:bg-rose-50 rounded cursor-pointer font-medium"
                              >
                                Reject
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW CONSULTANT PROFILE + DOCUMENTS + ASSIGNED PROJECTS + PERFORMANCE MODAL */}
      {viewConsultantDetail && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-lg max-w-3xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
              <div>
                <h3 className="text-base font-semibold text-zinc-900">{viewConsultantDetail.consultant.full_name}</h3>
                <div className="text-zinc-500">
                  {viewConsultantDetail.consultant.student_id || viewConsultantDetail.consultant.id} · {viewConsultantDetail.consultant.university} · Status:{' '}
                  <strong className="capitalize text-purple-800">{viewConsultantDetail.consultant.approval_status}</strong>
                </div>
              </div>
              <button type="button" onClick={() => setViewConsultantDetail(null)} className="px-3 py-1 border border-zinc-300 rounded cursor-pointer">Close</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-[#FAFAFC] border border-zinc-200 rounded">
              <div><strong>Email:</strong> {viewConsultantDetail.consultant.email}</div>
              <div><strong>Phone:</strong> {viewConsultantDetail.consultant.mobile}</div>
              <div><strong>Qualification:</strong> {viewConsultantDetail.consultant.qualification || viewConsultantDetail.consultant.course}</div>
              <div><strong>Specialisation:</strong> {viewConsultantDetail.consultant.specialisation}</div>
              <div><strong>Skills:</strong> {parseSkillsList(viewConsultantDetail.consultant.skills_json).join(', ') || '—'}</div>
              <div><strong>Experience:</strong> {viewConsultantDetail.consultant.experience || '—'}</div>
              <div><strong>Rating:</strong> {viewConsultantDetail.consultant.rating_avg ? `${viewConsultantDetail.consultant.rating_avg}/5` : 'Unrated'}</div>
              <div><strong>Completed Projects:</strong> {viewConsultantDetail.consultant.completed_count ?? 0}</div>
            </div>

            <div>
              <h4 className="font-semibold text-zinc-900 mb-2">Uploaded Documents ({viewConsultantDetail.documents.length})</h4>
              {viewConsultantDetail.documents.length === 0 ? (
                <p className="text-zinc-500">No documents uploaded yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {viewConsultantDetail.documents.map((d) => (
                    <div key={d.id} className="flex items-center justify-between p-2 border border-zinc-200 rounded">
                      <span><strong>{d.category}:</strong> {d.file_name} ({Math.round(d.size_bytes / 1024)} KB)</span>
                      <button
                        type="button"
                        onClick={() =>
                          void downloadAuthenticatedFile(`/api/documents/${d.id}/download`, d.file_name).catch((err) =>
                            setError(err instanceof Error ? err.message : 'Download failed')
                          )
                        }
                        className="text-purple-800 hover:underline cursor-pointer font-medium"
                      >
                        Download
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h4 className="font-semibold text-zinc-900 mb-2">Assigned Projects ({viewConsultantDetail.projects.length})</h4>
              {viewConsultantDetail.projects.length === 0 ? (
                <p className="text-zinc-500">No projects assigned yet.</p>
              ) : (
                <div className="border border-zinc-200 rounded overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead><tr className="bg-[#F4F3F8] border-b border-zinc-200"><th className="py-2 px-3">Project</th><th className="py-2 px-3">Customer</th><th className="py-2 px-3">Status</th><th className="py-2 px-3 text-right">Progress</th></tr></thead>
                    <tbody className="divide-y divide-zinc-200">
                      {viewConsultantDetail.projects.map((p) => (
                        <tr key={p.id}><td className="py-2 px-3">{p.title}</td><td className="py-2 px-3">{p.business_name || p.customer_name}</td><td className="py-2 px-3">{p.status}</td><td className="py-2 px-3 text-right font-mono-tabular">{p.progress_pct}%</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* EDIT CONSULTANT MODAL */}
      {editConsultantModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveEditConsultant} className="bg-white border border-zinc-200 rounded-lg max-w-lg w-full p-6 space-y-3 max-h-[90vh] overflow-y-auto text-sm">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
              <h3 className="text-base font-semibold text-zinc-900">Edit Student Consultant Details</h3>
              <button type="button" onClick={() => setEditConsultantModal(null)} className="text-xs text-zinc-500 cursor-pointer">Close</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input type="text" required value={editConsultantModal.fullName} onChange={(e) => setEditConsultantModal({ ...editConsultantModal, fullName: e.target.value })} placeholder="Full Name" className="border border-zinc-300 rounded px-3 py-2" />
              <input type="tel" required value={editConsultantModal.mobile} onChange={(e) => setEditConsultantModal({ ...editConsultantModal, mobile: e.target.value })} placeholder="Mobile" className="border border-zinc-300 rounded px-3 py-2" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input type="text" value={editConsultantModal.studentId} onChange={(e) => setEditConsultantModal({ ...editConsultantModal, studentId: e.target.value })} placeholder="Student ID" className="border border-zinc-300 rounded px-3 py-2" />
              <input type="text" required value={editConsultantModal.university} onChange={(e) => setEditConsultantModal({ ...editConsultantModal, university: e.target.value })} placeholder="College / University" className="border border-zinc-300 rounded px-3 py-2" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input type="text" required value={editConsultantModal.course} onChange={(e) => setEditConsultantModal({ ...editConsultantModal, course: e.target.value })} placeholder="Course" className="border border-zinc-300 rounded px-3 py-2" />
              <input type="text" value={editConsultantModal.qualification} onChange={(e) => setEditConsultantModal({ ...editConsultantModal, qualification: e.target.value })} placeholder="Qualification" className="border border-zinc-300 rounded px-3 py-2" />
              <input type="text" required value={editConsultantModal.specialisation} onChange={(e) => setEditConsultantModal({ ...editConsultantModal, specialisation: e.target.value })} placeholder="Specialisation" className="border border-zinc-300 rounded px-3 py-2" />
            </div>
            <input type="text" value={editConsultantModal.skills} onChange={(e) => setEditConsultantModal({ ...editConsultantModal, skills: e.target.value })} placeholder="Skills (comma-separated)" className="w-full border border-zinc-300 rounded px-3 py-2" />
            <input type="text" value={editConsultantModal.experience} onChange={(e) => setEditConsultantModal({ ...editConsultantModal, experience: e.target.value })} placeholder="Experience" className="w-full border border-zinc-300 rounded px-3 py-2" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select value={editConsultantModal.availabilityStatus} onChange={(e) => setEditConsultantModal({ ...editConsultantModal, availabilityStatus: e.target.value })} className="border border-zinc-300 rounded px-3 py-2 bg-white">
                <option value="available">Available</option>
                <option value="busy">Busy</option>
                <option value="unavailable">Unavailable</option>
              </select>
              <select value={editConsultantModal.status} onChange={(e) => setEditConsultantModal({ ...editConsultantModal, status: e.target.value })} className="border border-zinc-300 rounded px-3 py-2 bg-white">
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditConsultantModal(null)} className="px-4 py-2 border border-zinc-300 text-xs rounded cursor-pointer">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-purple-800 text-white text-xs font-medium rounded cursor-pointer">Save Consultant</button>
            </div>
          </form>
        </div>
      )}

      {/* REJECT CONSULTANT WITH REASON MODAL */}
      {rejectModalTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleApproval(rejectModalTarget.id, 'rejected', rejectionReasonDraft);
            }}
            className="bg-white border border-zinc-200 rounded-lg max-w-md w-full p-6 space-y-3 text-sm"
          >
            <h3 className="font-semibold text-rose-800">Reject Consultant Application</h3>
            <p className="text-xs text-zinc-600">
              Provide a clear reason for rejecting <strong>{rejectModalTarget.fullName}</strong>. This feedback is recorded and sent to the applicant.
            </p>
            <textarea
              rows={3}
              required
              value={rejectionReasonDraft}
              onChange={(e) => setRejectionReasonDraft(e.target.value)}
              placeholder="e.g., Student ID card image is unclear; please re-upload valid enrollment ID."
              className="w-full border border-zinc-300 rounded px-3 py-2 text-xs"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setRejectModalTarget(null)} className="px-3 py-1.5 border border-zinc-300 text-xs rounded cursor-pointer">Cancel</button>
              <button type="submit" className="px-3 py-1.5 bg-rose-700 text-white text-xs font-medium rounded cursor-pointer">Confirm Rejection</button>
            </div>
          </form>
        </div>
      )}

      {/* SERVICE & CATEGORY MANAGEMENT */}
      {tab === 'services' && (
        <div className="space-y-6">
          <div className="bg-white border border-zinc-200 rounded-lg p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-purple-800" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-zinc-900">
                    Cloud Firestore Catalog Initializer
                  </h3>
                </div>
                <p className="text-xs text-zinc-600 mt-1">
                  Parses all catalog definitions, verifies the 12 core categories, enforces <span className="font-mono">active</span> status, and assigns default professional images in Firestore (<span className="font-mono">{firebaseConfigInfo.projectId}</span>).
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {firebaseUser ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded text-xs">
                      <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                      {firebaseUser.email || firebaseUser.uid}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleFirebaseSignOut()}
                      className="px-2.5 py-1.5 border border-zinc-300 hover:bg-zinc-50 text-xs rounded cursor-pointer"
                    >
                      Sign Out
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleFirebaseGoogleSignIn()}
                    className="px-3 py-1.5 border border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-900 text-xs font-medium rounded cursor-pointer"
                  >
                    Sign In with Google (Admin)
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void refreshFirestoreStats()}
                  disabled={loadingFirestoreStats}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-zinc-300 hover:bg-zinc-50 text-xs rounded cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingFirestoreStats ? 'animate-spin' : ''}`} aria-hidden="true" />
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={() => void handleInitializeFirestoreCatalog()}
                  disabled={syncingFirestore || !firebaseUser}
                  title={!firebaseUser ? 'Sign in with Google Admin first to authorize Firestore writes' : undefined}
                  className="px-3.5 py-1.5 bg-purple-800 hover:bg-purple-900 disabled:opacity-50 text-white text-xs font-medium rounded cursor-pointer"
                >
                  {syncingFirestore ? 'Initializing Firestore...' : 'Initialize 12 Core Categories & Catalog'}
                </button>
              </div>
            </div>

            {firestoreStats && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t border-zinc-100 text-xs">
                <div className="p-2.5 bg-[#FAFAFC] border border-zinc-200 rounded">
                  <div className="text-zinc-500">Core Categories</div>
                  <div className="font-mono-tabular text-base font-semibold text-zinc-900 mt-0.5">
                    {firestoreStats.coreCategoriesPresentCount} / 12
                  </div>
                </div>
                <div className="p-2.5 bg-[#FAFAFC] border border-zinc-200 rounded">
                  <div className="text-zinc-500">Active Categories</div>
                  <div className="font-mono-tabular text-base font-semibold text-zinc-900 mt-0.5">
                    {firestoreStats.activeCategoriesCount}
                  </div>
                </div>
                <div className="p-2.5 bg-[#FAFAFC] border border-zinc-200 rounded">
                  <div className="text-zinc-500">Active Services</div>
                  <div className="font-mono-tabular text-base font-semibold text-zinc-900 mt-0.5">
                    {firestoreStats.activeServicesCount}
                  </div>
                </div>
                <div className="p-2.5 bg-[#FAFAFC] border border-zinc-200 rounded">
                  <div className="text-zinc-500">Category Images</div>
                  <div className="font-mono-tabular text-base font-semibold text-zinc-900 mt-0.5">
                    {firestoreStats.categoriesWithImagesCount}
                  </div>
                </div>
                <div className="p-2.5 bg-[#FAFAFC] border border-zinc-200 rounded">
                  <div className="text-zinc-500">Service Images</div>
                  <div className="font-mono-tabular text-base font-semibold text-zinc-900 mt-0.5">
                    {firestoreStats.servicesWithImagesCount}
                  </div>
                </div>
              </div>
            )}

            {firestoreSyncFeedback && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded text-xs">
                {firestoreSyncFeedback}
              </div>
            )}
            {firestoreSyncError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded text-xs break-words">
                {firestoreSyncError}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <form onSubmit={handleCreateCategory} className="bg-white border border-zinc-200 rounded-lg p-6 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-zinc-900">
                  Service Categories ({categories.filter((c) => c.is_active === 1).length}/{categories.length} active)
                </h3>
                <span className="text-[11px] text-zinc-500">Images &amp; visibility</span>
              </div>
              <input
                type="text"
                required
                placeholder="Category Name"
                value={newCategory.name}
                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                className="w-full border border-zinc-300 rounded px-3 py-2 text-sm"
              />
              <input
                type="text"
                required
                placeholder="Short description"
                value={newCategory.description}
                onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                className="w-full border border-zinc-300 rounded px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  value={BUNDLED_IMAGE_PRESETS.some((p) => p.value === newCategory.imageUrl) ? newCategory.imageUrl : ''}
                  onChange={(e) => setNewCategory({ ...newCategory, imageUrl: e.target.value })}
                  className="border border-zinc-300 rounded px-2.5 py-2 text-xs bg-white"
                >
                  <option value="">Choose category photo preset...</option>
                  {BUNDLED_IMAGE_PRESETS.map((p) => (
                    <option key={p.value + p.label} value={p.value}>{p.label}</option>
                  ))}
                </select>
                <label className="flex items-center justify-center gap-1.5 border border-zinc-300 rounded px-3 py-2 text-xs bg-white hover:bg-zinc-50 cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-zinc-600" aria-hidden="true" />
                  <span>Upload Category Image</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => handleImageFileSelect(e.target.files?.[0] || null, 'new-cat')}
                    className="hidden"
                  />
                </label>
              </div>
              {newCategory.imageUrl && (
                <div className="flex items-center gap-3 p-2 bg-[#FAFAFC] border border-zinc-200 rounded">
                  <SmartImage
                    src={resolveAssetReference(newCategory.imageUrl)}
                    alt="New category preview"
                    className="w-16 rounded shrink-0"
                    aspectClass="aspect-[4/3]"
                  />
                  <div className="text-[11px] text-zinc-600 flex-1 truncate">Preview ready</div>
                  <button
                    type="button"
                    onClick={() => setNewCategory({ ...newCategory, imageUrl: '' })}
                    className="text-xs text-rose-700 hover:underline cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              )}
              <button type="submit" className="px-4 py-2 bg-purple-800 hover:bg-purple-900 text-white text-xs font-medium rounded cursor-pointer">
                Add Category
              </button>
              <div className="pt-3 border-t border-zinc-100 max-h-72 overflow-y-auto space-y-2 text-xs">
                {categories.map((c) => {
                  const catImg = resolveCategoryImage(c.image_url, c.slug || c.name);
                  return (
                    <div key={c.id} className="flex items-center justify-between gap-3 py-1.5 border-b border-zinc-100">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <SmartImage
                          src={catImg}
                          alt={c.name}
                          fallbackLabel={c.name}
                          className="w-12 rounded shrink-0 border border-zinc-200"
                          aspectClass="aspect-[4/3]"
                        />
                        <div className="min-w-0">
                          <div className={c.is_active === 1 ? 'text-zinc-900 font-medium truncate' : 'text-zinc-400 line-through truncate'}>
                            {c.name}
                          </div>
                          <div className="text-[11px] text-zinc-500 truncate">{c.image_url ? 'Image assigned' : 'Default fallback image'}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setEditCategory({
                              id: c.id,
                              name: c.name,
                              description: c.description,
                              imageUrl: c.image_url || '',
                              isActive: c.is_active === 1,
                            })
                          }
                          className="text-blue-700 hover:underline cursor-pointer font-medium"
                        >
                          Edit / Photo
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/api/admin/categories/${c.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ isActive: c.is_active !== 1 }),
                            });
                            await loadAll();
                          }}
                          className="text-purple-800 hover:underline cursor-pointer"
                        >
                          {c.is_active === 1 ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </form>

            <form onSubmit={handleCreateService} noValidate className="bg-white border border-zinc-200 rounded-lg p-6 space-y-3">
              <h3 className="text-sm font-semibold text-zinc-900">Add New Marketplace Service</h3>
              {serviceSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-900">
                  {serviceSuccess}
                </div>
              )}
              {serviceError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800">
                  {serviceError}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select
                  value={newService.categoryId || categories[0]?.id || ''}
                  onChange={(e) => setNewService({ ...newService, categoryId: e.target.value })}
                  className="border border-zinc-300 rounded px-3 py-2 text-sm bg-white"
                >
                  {categories.length === 0 ? (
                    <option value="">Loading categories...</option>
                  ) : (
                    categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))
                  )}
                </select>
                <input
                  type="number"
                  required
                  min={100}
                  placeholder="Price (INR)"
                  value={newService.priceInr}
                  onChange={(e) => setNewService({ ...newService, priceInr: e.target.value })}
                  className="border border-zinc-300 rounded px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Service Title"
                  value={newService.title}
                  onChange={(e) => setNewService({ ...newService, title: e.target.value })}
                  className="border border-zinc-300 rounded px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min={1}
                  placeholder="Est. Days (e.g. 7)"
                  value={newService.estimatedDays}
                  onChange={(e) => setNewService({ ...newService, estimatedDays: e.target.value })}
                  className="border border-zinc-300 rounded px-3 py-2 text-sm"
                />
              </div>
              <input
                type="text"
                placeholder="Short one-line summary (shown on service cards)"
                value={newService.shortDescription}
                onChange={(e) => setNewService({ ...newService, shortDescription: e.target.value })}
                className="w-full border border-zinc-300 rounded px-3 py-2 text-sm"
              />
              <input
                type="text"
                required
                placeholder="Deliverables summary"
                value={newService.deliverables}
                onChange={(e) => setNewService({ ...newService, deliverables: e.target.value })}
                className="w-full border border-zinc-300 rounded px-3 py-2 text-sm"
              />
              <input
                type="text"
                placeholder="Consultant skill requirements (e.g. Tally, Excel MIS)"
                value={newService.requiredSkills}
                onChange={(e) => setNewService({ ...newService, requiredSkills: e.target.value })}
                className="w-full border border-zinc-300 rounded px-3 py-2 text-sm"
              />
              <textarea
                rows={2}
                required
                placeholder="Service description"
                value={newService.description}
                onChange={(e) => setNewService({ ...newService, description: e.target.value })}
                className="w-full border border-zinc-300 rounded px-3 py-2 text-sm"
              />
              <div className="space-y-2 p-3 bg-[#FAFAFC] border border-zinc-200 rounded">
                <div className="text-xs font-medium text-zinc-700">Service Image (Preset, Upload, or URL)</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    value={BUNDLED_IMAGE_PRESETS.some((p) => p.value === newService.imageUrl) ? newService.imageUrl : ''}
                    onChange={(e) => setNewService({ ...newService, imageUrl: e.target.value })}
                    className="border border-zinc-300 rounded px-2.5 py-2 text-xs bg-white"
                  >
                    <option value="">Use category photo or pick preset...</option>
                    {BUNDLED_IMAGE_PRESETS.map((p) => (
                      <option key={p.value + p.label} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                  <label className="flex items-center justify-center gap-1.5 border border-zinc-300 rounded px-3 py-2 text-xs bg-white hover:bg-zinc-50 cursor-pointer">
                    <Upload className="w-3.5 h-3.5 text-zinc-600" aria-hidden="true" />
                    <span>Upload Image (&lt;400 KB)</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => handleImageFileSelect(e.target.files?.[0] || null, 'new')}
                      className="hidden"
                    />
                  </label>
                </div>
                <input
                  type="text"
                  placeholder="Or paste custom Image URL (optional)"
                  value={newService.imageUrl}
                  onChange={(e) => setNewService({ ...newService, imageUrl: e.target.value })}
                  className="w-full border border-zinc-300 rounded px-3 py-1.5 text-xs bg-white"
                />
                {newService.imageUrl && (
                  <div className="flex items-center gap-3 pt-1">
                    <SmartImage
                      src={resolveAssetReference(newService.imageUrl)}
                      alt="Service preview"
                      className="w-20 rounded border border-zinc-200 shrink-0"
                      aspectClass="aspect-[4/3]"
                    />
                    <span className="text-[11px] text-zinc-600 flex-1">Custom service image selected</span>
                    <button
                      type="button"
                      onClick={() => setNewService({ ...newService, imageUrl: '' })}
                      className="inline-flex items-center gap-1 text-xs text-rose-700 hover:underline cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" aria-hidden="true" />
                      <span>Remove</span>
                    </button>
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={publishingService}
                className="px-4 py-2 bg-purple-800 hover:bg-purple-900 text-white text-xs font-medium rounded cursor-pointer disabled:opacity-60"
              >
                {publishingService ? 'Publishing Service...' : 'Publish Service Listing'}
              </button>
            </form>
          </div>

          <div className="bg-white border border-zinc-200 rounded-lg p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="text-base font-semibold text-zinc-900">
                All Marketplace Services ({services.filter((s) => s.is_active === 1).length}/{services.length} active)
              </h3>
              <span className="text-xs text-zinc-500">Edit prices inline or open full editor for images &amp; details</span>
            </div>
            <div className="overflow-x-auto border border-zinc-200 rounded-md">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-[#F4F3F8] border-b border-zinc-200">
                    <th className="py-2.5 px-3 font-semibold">Service &amp; Image</th>
                    <th className="py-2.5 px-3 font-semibold">Category</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Price (INR)</th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {services.map((s) => {
                    const thumbSrc = resolveServiceImage(s.image_url, s.category_image_url, s.category_slug || s.category_name);
                    const draftPrice = priceDrafts[s.id];
                    return (
                      <tr key={s.id}>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-3">
                            <SmartImage
                              src={thumbSrc}
                              fallbackSrc={resolveCategoryFallbackImage(s.category_slug || s.category_name)}
                              alt={s.title}
                              fallbackLabel={s.category_name}
                              className="w-16 rounded border border-zinc-200 shrink-0"
                              aspectClass="aspect-[4/3]"
                            />
                            <div>
                              <div className="font-medium text-zinc-900">{s.title}</div>
                              <div className="text-[11px] text-zinc-500">{s.estimated_days}d · {s.package_name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-zinc-600">{s.category_name}</td>
                        <td className="py-2.5 px-3 text-right">
                          {draftPrice !== undefined ? (
                            <div className="inline-flex items-center gap-1.5">
                              <input
                                type="number"
                                min={100}
                                value={draftPrice}
                                onChange={(e) => setPriceDrafts({ ...priceDrafts, [s.id]: e.target.value })}
                                className="w-24 border border-purple-400 rounded px-2 py-1 text-xs font-mono-tabular text-right"
                              />
                              <button
                                type="button"
                                onClick={() => void handleQuickPriceSave(s.id)}
                                className="px-2 py-1 bg-purple-800 text-white text-[11px] rounded cursor-pointer"
                              >
                                Save
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setPriceDrafts({ ...priceDrafts, [s.id]: String(s.price_inr) })}
                              title="Click to edit price"
                              className="font-mono-tabular text-zinc-900 hover:text-purple-800 hover:underline cursor-pointer"
                            >
                              {formatINR(s.price_inr)}
                            </button>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={s.is_active === 1 ? 'text-emerald-700 font-medium' : 'text-zinc-400'}>
                            {s.is_active === 1 ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap space-x-2">
                          <button
                            type="button"
                            onClick={() =>
                              setEditService({
                                id: s.id,
                                categoryId: s.category_id,
                                title: s.title,
                                shortDescription: s.short_description || '',
                                description: s.description,
                                priceInr: String(s.price_inr),
                                packageName: s.package_name,
                                deliverables: s.deliverables,
                                estimatedDays: String(s.estimated_days),
                                requiredSkills: s.required_skills || '',
                                imageUrl: s.image_url || '',
                                isActive: s.is_active === 1,
                              })
                            }
                            className="text-xs font-medium text-blue-700 hover:underline cursor-pointer"
                          >
                            Edit / Image
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleToggleService(s)}
                            className="text-xs font-medium text-purple-800 hover:underline cursor-pointer"
                          >
                            {s.is_active === 1 ? 'Deactivate' : 'Activate'}
                          </button>
                          {deleteConfirmServiceId === s.id ? (
                            <span className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => void handleDeleteService(s.id)}
                                className="px-2 py-0.5 bg-rose-700 text-white text-[11px] rounded cursor-pointer"
                              >
                                Confirm Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmServiceId(null)}
                                className="text-[11px] text-zinc-500 cursor-pointer"
                              >
                                Cancel
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmServiceId(s.id)}
                              className="text-xs font-medium text-rose-700 hover:underline cursor-pointer"
                            >
                              Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* EDIT CATEGORY MODAL */}
          {editCategory && (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
              <form onSubmit={handleSaveEditCategory} className="bg-white border border-zinc-200 rounded-lg max-w-lg w-full p-6 space-y-3 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
                  <h3 className="text-base font-semibold text-zinc-900">Edit Service Category &amp; Photo</h3>
                  <button type="button" onClick={() => setEditCategory(null)} className="text-xs text-zinc-500 cursor-pointer">Close</button>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Category Name</label>
                  <input
                    type="text"
                    required
                    value={editCategory.name}
                    onChange={(e) => setEditCategory({ ...editCategory, name: e.target.value })}
                    className="w-full border border-zinc-300 rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Description</label>
                  <textarea
                    rows={2}
                    required
                    value={editCategory.description}
                    onChange={(e) => setEditCategory({ ...editCategory, description: e.target.value })}
                    className="w-full border border-zinc-300 rounded px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-2 p-3 bg-[#FAFAFC] border border-zinc-200 rounded">
                  <div className="text-xs font-medium text-zinc-700">Category Image</div>
                  <SmartImage
                    src={resolveCategoryImage(editCategory.imageUrl, editCategory.name)}
                    alt={editCategory.name}
                    fallbackLabel={editCategory.name}
                    className="w-full rounded border border-zinc-200"
                    aspectClass="aspect-[16/9]"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select
                      value={BUNDLED_IMAGE_PRESETS.some((p) => p.value === editCategory.imageUrl) ? editCategory.imageUrl : ''}
                      onChange={(e) => setEditCategory({ ...editCategory, imageUrl: e.target.value })}
                      className="border border-zinc-300 rounded px-2.5 py-2 text-xs bg-white"
                    >
                      <option value="">Choose curated preset...</option>
                      {BUNDLED_IMAGE_PRESETS.map((p) => (
                        <option key={p.value + p.label} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                    <label className="flex items-center justify-center gap-1.5 border border-zinc-300 rounded px-3 py-2 text-xs bg-white hover:bg-zinc-50 cursor-pointer">
                      <Upload className="w-3.5 h-3.5 text-zinc-600" aria-hidden="true" />
                      <span>Upload Replacement</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => handleImageFileSelect(e.target.files?.[0] || null, 'edit-cat')}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Image URL or /src/assets/images/..."
                      value={editCategory.imageUrl}
                      onChange={(e) => setEditCategory({ ...editCategory, imageUrl: e.target.value })}
                      className="flex-1 border border-zinc-300 rounded px-3 py-1.5 text-xs bg-white"
                    />
                    {editCategory.imageUrl && (
                      <button
                        type="button"
                        onClick={() => setEditCategory({ ...editCategory, imageUrl: '' })}
                        className="px-2.5 py-1.5 border border-rose-200 text-rose-700 text-xs rounded hover:bg-rose-50 cursor-pointer"
                      >
                        Delete Image
                      </button>
                    )}
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editCategory.isActive}
                    onChange={(e) => setEditCategory({ ...editCategory, isActive: e.target.checked })}
                    className="accent-purple-800"
                  />
                  <span>Active on Public Marketplace</span>
                </label>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setEditCategory(null)} className="px-4 py-2 border border-zinc-300 text-xs rounded cursor-pointer">
                    Cancel
                  </button>
                  <button type="submit" className="px-4 py-2 bg-purple-800 text-white text-xs font-medium rounded cursor-pointer">
                    Save Category
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* EDIT SERVICE MODAL */}
          {editService && (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
              <form onSubmit={handleSaveEditService} className="bg-white border border-zinc-200 rounded-lg max-w-xl w-full p-6 space-y-3 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
                  <h3 className="text-base font-semibold text-zinc-900">Edit Marketplace Service</h3>
                  <button type="button" onClick={() => setEditService(null)} className="text-xs text-zinc-500 cursor-pointer">Close</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Category</label>
                    <select
                      value={editService.categoryId}
                      onChange={(e) => setEditService({ ...editService, categoryId: e.target.value })}
                      className="w-full border border-zinc-300 rounded px-3 py-2 bg-white"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Starting Price (INR)</label>
                    <input
                      type="number"
                      min={100}
                      required
                      value={editService.priceInr}
                      onChange={(e) => setEditService({ ...editService, priceInr: e.target.value })}
                      className="w-full border border-zinc-300 rounded px-3 py-2"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Service Title</label>
                    <input
                      type="text"
                      required
                      value={editService.title}
                      onChange={(e) => setEditService({ ...editService, title: e.target.value })}
                      className="w-full border border-zinc-300 rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Estimated Days</label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={editService.estimatedDays}
                      onChange={(e) => setEditService({ ...editService, estimatedDays: e.target.value })}
                      className="w-full border border-zinc-300 rounded px-3 py-2"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Short Summary</label>
                  <input
                    type="text"
                    value={editService.shortDescription}
                    onChange={(e) => setEditService({ ...editService, shortDescription: e.target.value })}
                    className="w-full border border-zinc-300 rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Deliverables</label>
                  <input
                    type="text"
                    required
                    value={editService.deliverables}
                    onChange={(e) => setEditService({ ...editService, deliverables: e.target.value })}
                    className="w-full border border-zinc-300 rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Required Consultant Skills</label>
                  <input
                    type="text"
                    value={editService.requiredSkills}
                    onChange={(e) => setEditService({ ...editService, requiredSkills: e.target.value })}
                    className="w-full border border-zinc-300 rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Full Description</label>
                  <textarea
                    rows={3}
                    required
                    value={editService.description}
                    onChange={(e) => setEditService({ ...editService, description: e.target.value })}
                    className="w-full border border-zinc-300 rounded px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-2 p-3 bg-[#FAFAFC] border border-zinc-200 rounded">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-zinc-700">Service Photograph</span>
                    <span className="text-zinc-500">
                      {editService.imageUrl ? 'Custom image assigned' : 'Inherits category image'}
                    </span>
                  </div>
                  <SmartImage
                    src={resolveServiceImage(
                      editService.imageUrl,
                      categories.find((c) => c.id === editService.categoryId)?.image_url,
                      categories.find((c) => c.id === editService.categoryId)?.slug
                    )}
                    alt={editService.title}
                    fallbackLabel={editService.title}
                    className="w-full rounded border border-zinc-200"
                    aspectClass="aspect-[16/9]"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select
                      value={BUNDLED_IMAGE_PRESETS.some((p) => p.value === editService.imageUrl) ? editService.imageUrl : ''}
                      onChange={(e) => setEditService({ ...editService, imageUrl: e.target.value })}
                      className="border border-zinc-300 rounded px-2.5 py-2 text-xs bg-white"
                    >
                      <option value="">Choose curated preset...</option>
                      {BUNDLED_IMAGE_PRESETS.map((p) => (
                        <option key={p.value + p.label} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                    <label className="flex items-center justify-center gap-1.5 border border-zinc-300 rounded px-3 py-2 text-xs bg-white hover:bg-zinc-50 cursor-pointer">
                      <Upload className="w-3.5 h-3.5 text-zinc-600" aria-hidden="true" />
                      <span>Upload Replacement</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => handleImageFileSelect(e.target.files?.[0] || null, 'edit')}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Image URL or /src/assets/images/..."
                      value={editService.imageUrl}
                      onChange={(e) => setEditService({ ...editService, imageUrl: e.target.value })}
                      className="flex-1 border border-zinc-300 rounded px-3 py-1.5 text-xs bg-white"
                    />
                    {editService.imageUrl && (
                      <button
                        type="button"
                        onClick={() => setEditService({ ...editService, imageUrl: '' })}
                        className="px-2.5 py-1.5 border border-rose-200 text-rose-700 text-xs rounded hover:bg-rose-50 cursor-pointer"
                      >
                        Delete Image
                      </button>
                    )}
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editService.isActive}
                    onChange={(e) => setEditService({ ...editService, isActive: e.target.checked })}
                    className="accent-purple-800"
                  />
                  <span>Active on Public Marketplace</span>
                </label>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setEditService(null)} className="px-4 py-2 border border-zinc-300 text-xs rounded cursor-pointer">
                    Cancel
                  </button>
                  <button type="submit" className="px-4 py-2 bg-purple-800 text-white text-xs font-medium rounded cursor-pointer">
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* BOOKINGS & ASSIGNMENTS */}
      {tab === 'bookings' && (
        <div className="bg-white border border-zinc-200 rounded-lg p-6 space-y-4">
          <h3 className="text-base font-semibold text-zinc-900">Booking Queue, Quotations &amp; Consultant Assignment</h3>
          {bookings.length === 0 ? (
            <p className="text-sm text-zinc-500">No bookings submitted yet.</p>
          ) : (
            <div className="space-y-4">
              {bookings.map((b) => (
                <div key={b.id} className="border border-zinc-200 rounded-md p-4 space-y-3">
                  <div className="flex flex-wrap justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold text-purple-800">{b.status} · Due {formatDateShort(b.expected_delivery_date)}</div>
                      <h4 className="font-semibold text-zinc-900">{b.service_title} — {b.business_name || b.customer_name}</h4>
                      <p className="text-xs text-zinc-600 mt-1">{b.requirements}</p>
                      <div className="text-xs text-zinc-500 mt-1">
                        Quoted Price: <span className="font-mono-tabular font-semibold">{formatINR(b.quoted_price_inr)}</span>
                        {b.preferred_consultant_name && ` · Requested: ${b.preferred_consultant_name}`}
                        {b.assigned_consultant_name && ` · Assigned: ${b.assigned_consultant_name}`}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setQuoteDraft({
                            bookingId: b.id,
                            amountInr: String(b.quoted_price_inr),
                            scopeNotes: b.service_title,
                            validUntil: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
                          })
                        }
                        className="px-3 py-1.5 border border-zinc-300 text-xs font-medium rounded cursor-pointer"
                      >
                        Send Quotation
                      </button>
                      <select
                        value={assignChoice[b.id] ?? (b.preferred_consultant_id || '')}
                        onChange={(e) => setAssignChoice((prev) => ({ ...prev, [b.id]: e.target.value }))}
                        className="border border-zinc-300 rounded px-2.5 py-1.5 text-xs bg-white"
                      >
                        <option value="">Select approved consultant...</option>
                        {approvedConsultants.map((c) => (
                          <option key={c.id} value={c.id}>{c.full_name} ({c.specialisation})</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => void handleAssignConsultant(b.id)}
                        className="px-3 py-1.5 bg-purple-800 text-white text-xs font-medium rounded cursor-pointer"
                      >
                        Assign &amp; Start Project
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {quoteDraft && (
            <form onSubmit={handleSendQuote} className="p-4 border border-purple-200 bg-purple-50/40 rounded-md space-y-3">
              <div className="text-xs font-semibold text-purple-900">Issue Custom Quotation</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input type="number" required value={quoteDraft.amountInr} onChange={(e) => setQuoteDraft({ ...quoteDraft, amountInr: e.target.value })} placeholder="Amount INR" className="border border-zinc-300 rounded px-3 py-1.5 text-sm bg-white" />
                <input type="date" required value={quoteDraft.validUntil} onChange={(e) => setQuoteDraft({ ...quoteDraft, validUntil: e.target.value })} className="border border-zinc-300 rounded px-3 py-1.5 text-sm bg-white" />
                <input type="text" required value={quoteDraft.scopeNotes} onChange={(e) => setQuoteDraft({ ...quoteDraft, scopeNotes: e.target.value })} placeholder="Scope notes" className="border border-zinc-300 rounded px-3 py-1.5 text-sm bg-white" />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="px-3 py-1.5 bg-purple-800 text-white text-xs rounded cursor-pointer">Send Quotation</button>
                <button type="button" onClick={() => setQuoteDraft(null)} className="px-3 py-1.5 border border-zinc-300 text-xs rounded cursor-pointer">Cancel</button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* PROJECT MANAGEMENT */}
      {tab === 'projects' && (
        <div className="bg-white border border-zinc-200 rounded-lg p-6 space-y-4">
          <h3 className="text-base font-semibold text-zinc-900">Active &amp; Completed Projects ({projects.length})</h3>
          {projects.length === 0 ? (
            <p className="text-sm text-zinc-500">No projects initialised yet.</p>
          ) : (
            <div className="overflow-x-auto border border-zinc-200 rounded-md">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-[#F4F3F8] border-b border-zinc-200">
                    <th className="py-2.5 px-3 font-semibold">Project</th>
                    <th className="py-2.5 px-3 font-semibold">Customer</th>
                    <th className="py-2.5 px-3 font-semibold">Consultant</th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {projects.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2.5 px-3 font-medium text-zinc-900">{p.title}</td>
                      <td className="py-2.5 px-3 text-zinc-600">{p.business_name || p.customer_name}</td>
                      <td className="py-2.5 px-3 text-zinc-600">{p.consultant_name}</td>
                      <td className="py-2.5 px-3 font-semibold text-purple-800">{p.status}</td>
                      <td className="py-2.5 px-3 font-mono-tabular text-right">{p.progress_pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* PAYMENTS, INVOICES, PAYOUTS & EXPENSES */}
      {tab === 'finance' && (
        <div className="space-y-6">
          <div className="bg-white border border-zinc-200 rounded-lg p-6 space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <div>
                <h3 className="text-base font-semibold text-zinc-900">Transactions &amp; Manual Payment Recording</h3>
                <p className="text-xs text-zinc-500">Record verified UPI, Cash, or Bank Transfer settlements or process refunds.</p>
              </div>
              <button type="button" onClick={exportTransactionsCsv} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-zinc-300 text-xs font-medium rounded cursor-pointer">
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Export CSV</span>
              </button>
            </div>

            {txUpdate && (
              <form onSubmit={handleSaveTx} className="p-4 border border-purple-200 bg-purple-50/40 rounded-md grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
                <select value={txUpdate.status} onChange={(e) => setTxUpdate({ ...txUpdate, status: e.target.value })} className="border border-zinc-300 rounded px-2 py-1.5 bg-white">
                  {['Pending', 'Initiated', 'Successful', 'Failed', 'Refunded', 'Partially Refunded'].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <select value={txUpdate.method} onChange={(e) => setTxUpdate({ ...txUpdate, method: e.target.value })} className="border border-zinc-300 rounded px-2 py-1.5 bg-white">
                  <option value="manual_upi">Manual UPI</option>
                  <option value="manual_cash">Manual Cash</option>
                  <option value="manual_bank">Manual Bank Transfer</option>
                </select>
                <input type="text" placeholder="UTR / Receipt Ref" value={txUpdate.ref} onChange={(e) => setTxUpdate({ ...txUpdate, ref: e.target.value })} className="border border-zinc-300 rounded px-2 py-1.5 bg-white" />
                <input type="number" placeholder="Refund INR" value={txUpdate.refund} onChange={(e) => setTxUpdate({ ...txUpdate, refund: e.target.value })} className="border border-zinc-300 rounded px-2 py-1.5 bg-white" />
                <div className="flex gap-2">
                  <button type="submit" className="px-3 py-1.5 bg-purple-800 text-white rounded cursor-pointer">Save</button>
                  <button type="button" onClick={() => setTxUpdate(null)} className="px-3 py-1.5 border border-zinc-300 rounded cursor-pointer">Cancel</button>
                </div>
              </form>
            )}

            <div className="overflow-x-auto border border-zinc-200 rounded-md">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-[#F4F3F8] border-b border-zinc-200">
                    <th className="py-2.5 px-3 font-semibold">Customer / Service</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Total INR</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Comm.</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Consultant</th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {transactions.length === 0 ? (
                    <tr><td colSpan={6} className="py-5 text-center text-xs text-zinc-500">No transactions generated yet.</td></tr>
                  ) : (
                    transactions.map((t) => (
                      <tr key={t.id}>
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-zinc-900">
                            {t.business_name || t.customer_name}
                            {t.is_demo === 1 && (
                              <span className="ml-2 px-1.5 py-0.5 bg-amber-100 text-amber-900 rounded text-[10px] font-semibold">
                                DEMO DATA
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-zinc-500">{t.service_title}</div>
                        </td>
                        <td className="py-2.5 px-3 font-mono-tabular text-right">{formatINR(t.total_payable_inr)}</td>
                        <td className="py-2.5 px-3 font-mono-tabular text-right text-purple-800">{formatINR(t.commission_amount_inr)}</td>
                        <td className="py-2.5 px-3 font-mono-tabular text-right">{formatINR(t.consultant_earning_inr)}</td>
                        <td className="py-2.5 px-3 text-xs font-semibold">{t.status}</td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setTxUpdate({
                                id: t.id,
                                status: t.status,
                                method: t.payment_method,
                                ref: t.payment_reference || '',
                                refund: String(t.refund_amount_inr || 0),
                              })
                            }
                            className="text-xs font-medium text-purple-800 hover:underline cursor-pointer"
                          >
                            Record / Edit
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <form onSubmit={handleRecordPayout} className="bg-white border border-zinc-200 rounded-lg p-6 space-y-3">
              <h4 className="text-sm font-semibold text-zinc-900">Record Consultant Payout</h4>
              <select
                required
                value={payoutForm.consultantId}
                onChange={(e) => setPayoutForm({ ...payoutForm, consultantId: e.target.value })}
                className="w-full border border-zinc-300 rounded px-3 py-2 text-sm bg-white"
              >
                <option value="">Select consultant...</option>
                {users.filter((u) => u.role === 'consultant').map((c) => (
                  <option key={c.id} value={c.id}>{c.full_name}</option>
                ))}
              </select>
              <div className="grid grid-cols-3 gap-2">
                <input type="number" required placeholder="Amount INR" value={payoutForm.amountInr} onChange={(e) => setPayoutForm({ ...payoutForm, amountInr: e.target.value })} className="border border-zinc-300 rounded px-3 py-2 text-sm" />
                <input type="text" required placeholder="UTR / Ref" value={payoutForm.reference} onChange={(e) => setPayoutForm({ ...payoutForm, reference: e.target.value })} className="border border-zinc-300 rounded px-3 py-2 text-sm" />
                <input type="text" required placeholder="Period (e.g. Nov 2026)" value={payoutForm.periodLabel} onChange={(e) => setPayoutForm({ ...payoutForm, periodLabel: e.target.value })} className="border border-zinc-300 rounded px-3 py-2 text-sm" />
              </div>
              <button type="submit" className="px-4 py-2 bg-purple-800 text-white text-xs font-medium rounded cursor-pointer">
                Record Payout ({payouts.length} logged)
              </button>
            </form>

            <form onSubmit={handleRecordExpense} className="bg-white border border-zinc-200 rounded-lg p-6 space-y-3">
              <h4 className="text-sm font-semibold text-zinc-900">Record Platform Operating Expense</h4>
              <div className="grid grid-cols-2 gap-2">
                <input type="text" required placeholder="Category" value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })} className="border border-zinc-300 rounded px-3 py-2 text-sm" />
                <input type="number" required placeholder="Amount INR" value={expenseForm.amountInr} onChange={(e) => setExpenseForm({ ...expenseForm, amountInr: e.target.value })} className="border border-zinc-300 rounded px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="text" required placeholder="Description" value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} className="border border-zinc-300 rounded px-3 py-2 text-sm" />
                <input type="date" required value={expenseForm.expenseDate} onChange={(e) => setExpenseForm({ ...expenseForm, expenseDate: e.target.value })} className="border border-zinc-300 rounded px-3 py-2 text-sm" />
              </div>
              <button type="submit" className="px-4 py-2 bg-zinc-900 text-white text-xs font-medium rounded cursor-pointer">
                Log Expense ({expenses.length} logged)
              </button>
            </form>
          </div>

          {/* Invoices Table */}
          <div className="bg-white border border-zinc-200 rounded-lg p-6">
            <h4 className="text-sm font-semibold text-zinc-900 mb-3">Issued Customer Invoices ({invoices.length})</h4>
            <div className="overflow-x-auto border border-zinc-200 rounded-md">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F4F3F8] border-b border-zinc-200">
                    <th className="py-2 px-3">Invoice #</th>
                    <th className="py-2 px-3">Customer</th>
                    <th className="py-2 px-3 text-right">Total</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-right">Print</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td className="py-2 px-3 font-mono-tabular font-semibold text-purple-900">{inv.invoice_number}</td>
                      <td className="py-2 px-3">{inv.business_name || inv.customer_name}</td>
                      <td className="py-2 px-3 font-mono-tabular text-right">{formatINR(inv.total_inr)}</td>
                      <td className="py-2 px-3">{inv.status}</td>
                      <td className="py-2 px-3 text-right">
                        <button type="button" onClick={() => setSelectedInvoice(inv)} className="text-purple-800 hover:underline cursor-pointer">
                          PDF View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <InvoicePrintModal invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />
        </div>
      )}

      {/* FINANCIAL REPORTS & BI */}
      {tab === 'reports' && kpis && (
        <div className="space-y-6">
          <div className="bg-white border border-zinc-200 rounded-lg p-6 space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-4">
              <div>
                <h3 className="text-base font-semibold text-zinc-900">Real-Time Financial &amp; BI Report</h3>
                <p className="text-xs text-zinc-500">All figures and charts below are derived strictly from verified SQLite transactions and expense entries.</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={exportTransactionsCsv} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-zinc-300 text-xs rounded cursor-pointer">
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>CSV Export</span>
                </button>
                <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-800 text-white text-xs rounded cursor-pointer">
                  <Printer className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Print PDF Report</span>
                </button>
              </div>
            </div>

            {/* Date Range Filter Bar */}
            <div className="no-print flex flex-wrap items-center gap-2 pt-3 border-t border-zinc-100 text-xs">
              {[
                ['all', 'All Time'],
                ['today', 'Today'],
                ['7d', 'Last 7 Days'],
                ['30d', 'Last 30 Days'],
                ['monthly', 'This Month'],
                ['quarterly', 'This Quarter'],
                ['yearly', 'This Year'],
                ['custom', 'Custom Range'],
              ].map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => {
                    setBiRange(val);
                    if (val !== 'custom') {
                      void loadOverviewOnly(val, '', '');
                    }
                  }}
                  className={`px-3 py-1.5 rounded border cursor-pointer ${
                    biRange === val ? 'bg-purple-800 text-white border-purple-800' : 'bg-white text-zinc-700 border-zinc-200'
                  }`}
                >
                  {label}
                </button>
              ))}
              {biRange === 'custom' && (
                <div className="flex flex-wrap items-center gap-2 ml-2">
                  <input type="date" value={biFrom} onChange={(e) => setBiFrom(e.target.value)} className="border border-zinc-300 rounded px-2 py-1" />
                  <span className="text-zinc-500">to</span>
                  <input type="date" value={biTo} onChange={(e) => setBiTo(e.target.value)} className="border border-zinc-300 rounded px-2 py-1" />
                  <button
                    type="button"
                    onClick={() => void loadOverviewOnly('custom', biFrom, biTo)}
                    className="px-3 py-1 bg-zinc-900 text-white rounded cursor-pointer"
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>

            {/* Filtered BI Metrics Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 pt-2 text-xs">
              <div className="border border-zinc-200 rounded p-3 bg-[#FAFAFC]">
                <div className="text-zinc-500">Gross Revenue</div>
                <div className="font-mono-tabular text-lg font-semibold text-purple-900">{formatINR(kpis.grossRevenueInr)}</div>
              </div>
              <div className="border border-zinc-200 rounded p-3 bg-[#FAFAFC]">
                <div className="text-zinc-500">Platform Commission</div>
                <div className="font-mono-tabular text-lg font-semibold text-purple-900">{formatINR(kpis.platformCommissionInr)}</div>
              </div>
              <div className="border border-zinc-200 rounded p-3 bg-[#FAFAFC]">
                <div className="text-zinc-500">Consultant Earnings</div>
                <div className="font-mono-tabular text-lg font-semibold text-zinc-900">{formatINR(kpis.consultantEarningsInr)}</div>
              </div>
              <div className="border border-zinc-200 rounded p-3 bg-[#FAFAFC]">
                <div className="text-zinc-500">Avg Order Value</div>
                <div className="font-mono-tabular text-lg font-semibold text-zinc-900">{formatINR(kpis.averageOrderValueInr || 0)}</div>
              </div>
              <div className="border border-zinc-200 rounded p-3 bg-[#FAFAFC]">
                <div className="text-zinc-500">Completion Rate</div>
                <div className="font-mono-tabular text-lg font-semibold text-emerald-700">{kpis.completionRatePct ?? 0}%</div>
              </div>
              <div className="border border-zinc-200 rounded p-3 bg-[#FAFAFC]">
                <div className="text-zinc-500">Retainer MRR</div>
                <div className="font-mono-tabular text-lg font-semibold text-blue-700">{formatINR(kpis.activeRetainerMrrInr || 0)}</div>
              </div>
            </div>
          </div>

          {/* BI Charts Derived From Real Database Data */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-zinc-200 rounded-lg p-6">
              <h4 className="text-sm font-semibold text-zinc-900 mb-4">Monthly Revenue vs. Platform Commission</h4>
              {monthlyRevenueSeries.length === 0 ? (
                <p className="text-xs text-zinc-500">No transaction history recorded for this date filter yet (₹0).</p>
              ) : (
                <div className="space-y-3 text-xs">
                  {(() => {
                    const maxRev = Math.max(1, ...monthlyRevenueSeries.map((m) => m.revenue_inr));
                    return monthlyRevenueSeries.map((m) => (
                      <div key={m.month} className="space-y-1">
                        <div className="flex justify-between font-mono-tabular">
                          <span className="font-semibold text-zinc-800">{m.month} ({m.tx_count} tx)</span>
                          <span>Rev {formatINR(m.revenue_inr)} · Comm {formatINR(m.commission_inr)}</span>
                        </div>
                        <div className="w-full h-3 bg-zinc-100 rounded overflow-hidden">
                          <div className="h-full bg-purple-800" style={{ width: `${Math.round((m.revenue_inr / maxRev) * 100)}%` }} />
                        </div>
                        <div className="w-full h-2 bg-zinc-100 rounded overflow-hidden">
                          <div className="h-full bg-emerald-600" style={{ width: `${Math.round((m.commission_inr / maxRev) * 100)}%` }} />
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>

            <div className="bg-white border border-zinc-200 rounded-lg p-6">
              <h4 className="text-sm font-semibold text-zinc-900 mb-4">Service Category Performance</h4>
              {categoryPerformance.length === 0 ? (
                <p className="text-xs text-zinc-500">No category bookings recorded in this period yet.</p>
              ) : (
                <div className="space-y-3 text-xs">
                  {(() => {
                    const maxCat = Math.max(1, ...categoryPerformance.map((c) => Math.max(c.revenue_inr, c.bookings_count)));
                    return categoryPerformance.map((c) => (
                      <div key={c.id} className="space-y-1">
                        <div className="flex justify-between">
                          <span className="font-medium text-zinc-800">{c.name} ({c.bookings_count} bookings)</span>
                          <span className="font-mono-tabular font-semibold text-purple-900">{formatINR(c.revenue_inr)}</span>
                        </div>
                        <div className="w-full h-2.5 bg-zinc-100 rounded overflow-hidden">
                          <div
                            className="h-full bg-blue-700"
                            style={{ width: `${Math.max(6, Math.round(((c.revenue_inr || c.bookings_count) / maxCat) * 100))}%` }}
                          />
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-zinc-200 rounded-lg p-6">
              <h4 className="text-sm font-semibold text-zinc-900 mb-3">Service-Wise Bookings &amp; Realised Revenue</h4>
              {serviceBreakdown.length === 0 ? (
                <p className="text-xs text-zinc-500">No service bookings recorded yet.</p>
              ) : (
                <div className="space-y-2 text-xs">
                  {serviceBreakdown.map((s) => (
                    <div key={s.title} className="flex justify-between py-2 border-b border-zinc-100">
                      <span className="font-medium text-zinc-800">{s.title} ({s.bookings_count} bookings)</span>
                      <span className="font-mono-tabular font-semibold text-purple-900">{formatINR(s.revenue_inr)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-zinc-200 rounded-lg p-6">
              <h4 className="text-sm font-semibold text-zinc-900 mb-3">Consultant-Wise Performance &amp; Earnings</h4>
              {consultantBreakdown.length === 0 ? (
                <p className="text-xs text-zinc-500">No consultants registered yet.</p>
              ) : (
                <div className="space-y-2 text-xs">
                  {consultantBreakdown.map((c) => (
                    <div key={c.id} className="flex justify-between py-2 border-b border-zinc-100">
                      <span className="font-medium text-zinc-800">{c.full_name} ({c.completed_count} done)</span>
                      <span className="font-mono-tabular font-semibold text-zinc-900">{formatINR(c.earned_inr)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {bookingTrends.length > 0 && (
            <div className="bg-white border border-zinc-200 rounded-lg p-6">
              <h4 className="text-sm font-semibold text-zinc-900 mb-3">Daily Booking Volume Trend</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
                {bookingTrends.map((t) => (
                  <div key={t.date} className="border border-zinc-200 rounded p-2.5 bg-[#FAFAFC] font-mono-tabular">
                    <div className="text-zinc-500">{t.date}</div>
                    <div className="font-semibold text-zinc-900">{t.total_bookings} total · {t.completed_bookings} done</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'documents' && <DocumentsModule defaultCategory="other" />}

      {tab === 'reviews' && (
        <div className="bg-white border border-zinc-200 rounded-lg p-6 space-y-3">
          <h3 className="text-base font-semibold text-zinc-900">Reviews Moderation ({reviews.length})</h3>
          {reviews.length === 0 ? (
            <p className="text-xs text-zinc-500">No reviews submitted yet.</p>
          ) : (
            reviews.map((r) => (
              <div key={r.id} className="border border-zinc-200 rounded p-4 flex justify-between gap-4 text-xs">
                <div>
                  <div className="font-semibold text-zinc-900">{r.customer_name} → {r.consultant_name} ({r.rating}/5)</div>
                  <p className="text-zinc-600 mt-1">{r.comment}</p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await apiFetch(`/api/reviews/${r.id}`, {
                      method: 'PATCH',
                      body: JSON.stringify({ moderationStatus: r.moderation_status === 'published' ? 'hidden' : 'published' }),
                    });
                    await loadAll();
                  }}
                  className="px-3 py-1 border border-zinc-300 rounded h-fit cursor-pointer"
                >
                  {r.moderation_status === 'published' ? 'Hide' : 'Restore'}
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'messages' && <MessagesModule />}
      {tab === 'support' && <SupportModule />}

      {/* AUDIT LOGS */}
      {tab === 'audit' && (
        <div className="bg-white border border-zinc-200 rounded-lg p-6">
          <h3 className="text-base font-semibold text-zinc-900 mb-3">Platform Audit Trail</h3>
          <div className="overflow-x-auto border border-zinc-200 rounded-md">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F4F3F8] border-b border-zinc-200">
                  <th className="py-2 px-3">Timestamp</th>
                  <th className="py-2 px-3">Actor</th>
                  <th className="py-2 px-3">Action</th>
                  <th className="py-2 px-3">Target</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {auditLogs.map((l) => (
                  <tr key={l.id}>
                    <td className="py-2 px-3 font-mono-tabular text-zinc-500">{formatDateTime(l.created_at)}</td>
                    <td className="py-2 px-3">{l.actor_name || 'System'} ({l.actor_role || 'sys'})</td>
                    <td className="py-2 px-3 font-semibold text-purple-900">{l.action}</td>
                    <td className="py-2 px-3 text-zinc-600">{l.target_type}:{l.target_id.slice(0, 12)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PRESERVED 17-SECTION VENTURE PLAN */}
      {tab === 'venture-plan' && <VenturePlanWorkspace />}

      {/* SUPER ADMIN PANEL */}
      {tab === 'superadmin' && isSuperAdmin && (
        <div className="space-y-6">
          {/* DEMONSTRATION DATA SEEDING & CLEANUP MANAGER */}
          <div className="bg-white border border-zinc-200 rounded-lg p-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-zinc-900">Demonstration Data Manager (10 Customers · 10 Consultants · 15 Bookings · 10 Services)</h3>
                <p className="text-xs text-zinc-600 mt-1">
                  All demonstration entries are strictly flagged <span className="font-mono font-semibold">is_demo = 1</span> and clearly labelled <span className="px-1.5 py-0.5 bg-amber-100 text-amber-900 rounded text-[10px] font-semibold">DEMO DATA</span>. Genuine user accounts, original services, and real revenue reports remain completely separate and untouched.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={demoBusy}
                  onClick={() => void handleSeedDemoData()}
                  className="px-3.5 py-2 bg-purple-800 hover:bg-purple-900 disabled:opacity-50 text-white text-xs font-medium rounded cursor-pointer"
                >
                  {demoBusy ? 'Working...' : 'Seed Demonstration Data'}
                </button>
                {confirmRemoveDemo ? (
                  <span className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      disabled={demoBusy}
                      onClick={() => void handleRemoveDemoData()}
                      className="px-3 py-2 bg-rose-700 hover:bg-rose-800 text-white text-xs font-medium rounded cursor-pointer"
                    >
                      Confirm Remove All Demo Data
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmRemoveDemo(false)}
                      className="px-2.5 py-2 border border-zinc-300 text-xs rounded cursor-pointer"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={demoBusy}
                    onClick={() => setConfirmRemoveDemo(true)}
                    className="px-3.5 py-2 border border-rose-300 text-rose-700 hover:bg-rose-50 disabled:opacity-50 text-xs font-medium rounded cursor-pointer"
                  >
                    Remove All Demo Data (Go Live)
                  </button>
                )}
              </div>
            </div>

            {demoStatus && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-md">
                  <div className="font-semibold text-emerald-900 mb-1.5">Genuine Live Database Records (Untouched)</div>
                  <div className="grid grid-cols-4 gap-2 font-mono-tabular">
                    <div><span className="text-zinc-500 block">Customers</span><strong>{demoStatus.genuine.customers}</strong></div>
                    <div><span className="text-zinc-500 block">Consultants</span><strong>{demoStatus.genuine.consultants}</strong></div>
                    <div><span className="text-zinc-500 block">Services</span><strong>{demoStatus.genuine.services}</strong></div>
                    <div><span className="text-zinc-500 block">Bookings</span><strong>{demoStatus.genuine.bookings}</strong></div>
                  </div>
                </div>
                <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-md">
                  <div className="font-semibold text-amber-900 mb-1.5">DEMO DATA Records (Removable Anytime)</div>
                  <div className="grid grid-cols-4 gap-2 font-mono-tabular">
                    <div><span className="text-zinc-500 block">Customers</span><strong>{demoStatus.demo.customers}</strong></div>
                    <div><span className="text-zinc-500 block">Consultants</span><strong>{demoStatus.demo.consultants} ({demoStatus.demo.pendingConsultants}p)</strong></div>
                    <div><span className="text-zinc-500 block">Services</span><strong>{demoStatus.demo.services}</strong></div>
                    <div><span className="text-zinc-500 block">Bookings</span><strong>{demoStatus.demo.bookings}</strong></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <form onSubmit={handleSaveGlobalSettings} className="bg-white border border-zinc-200 rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-zinc-900">Global Commission, Tax &amp; Booking Rules</h3>
                <button
                  type="button"
                  onClick={() => setCommissionInput('15')}
                  className="text-xs font-medium text-purple-800 hover:underline cursor-pointer"
                >
                  Apply 15% Standard Rate
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Platform Commission (%)</label>
                  <input type="number" min={0} max={80} value={commissionInput} onChange={(e) => setCommissionInput(e.target.value)} className="w-full border border-zinc-300 rounded px-3 py-2" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">GST / Tax Rate (%)</label>
                  <input type="number" min={0} max={28} value={taxInput} onChange={(e) => setTaxInput(e.target.value)} className="w-full border border-zinc-300 rounded px-3 py-2" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
                <input type="checkbox" checked={allowDupBookings} onChange={(e) => setAllowDupBookings(e.target.checked)} className="accent-purple-800" />
                <span>Allow duplicate concurrent bookings for the same service</span>
              </label>
              <button type="submit" className="px-4 py-2 bg-purple-800 text-white text-xs font-medium rounded cursor-pointer">
                Save Global Rules
              </button>
            </form>

            <form onSubmit={handleCreateAdmin} className="bg-white border border-zinc-200 rounded-lg p-6 space-y-3">
              <h3 className="text-base font-semibold text-zinc-900">Create Authorised Admin Account</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <input type="text" required placeholder="Full Name" value={newAdmin.fullName} onChange={(e) => setNewAdmin({ ...newAdmin, fullName: e.target.value })} className="border border-zinc-300 rounded px-3 py-2" />
                <input type="tel" required placeholder="Mobile" value={newAdmin.mobile} onChange={(e) => setNewAdmin({ ...newAdmin, mobile: e.target.value })} className="border border-zinc-300 rounded px-3 py-2" />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <input type="email" required placeholder="Admin Email" value={newAdmin.email} onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })} className="border border-zinc-300 rounded px-3 py-2" />
                <input type="password" required minLength={8} placeholder="Password (8+ chars)" value={newAdmin.password} onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })} className="border border-zinc-300 rounded px-3 py-2" />
              </div>
              <select value={newAdmin.role} onChange={(e) => setNewAdmin({ ...newAdmin, role: e.target.value })} className="border border-zinc-300 rounded px-3 py-2 text-sm bg-white">
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
              <button type="submit" className="px-4 py-2 bg-zinc-900 text-white text-xs font-medium rounded cursor-pointer">
                Provision Admin Account
              </button>
            </form>
          </div>

          {/* MONTHLY RETAINER SUBSCRIPTIONS MANAGEMENT */}
          <div className="bg-white border border-zinc-200 rounded-lg p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-zinc-900">Monthly Retainer Subscriptions ({subscriptions.length})</h3>
                <p className="text-xs text-zinc-500">Manage recurring Dehradun business bookkeeping, MIS, and social media retainers.</p>
              </div>
              <span className="font-mono-tabular text-xs font-semibold text-purple-900">
                Active MRR: {formatINR(subscriptions.filter((s) => s.status === 'Active').reduce((acc, s) => acc + s.monthly_price_inr, 0))}
              </span>
            </div>

            <form onSubmit={handleCreateSubscription} className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs p-4 bg-[#FAFAFC] border border-zinc-200 rounded-md">
              <select
                required
                value={subForm.customerId}
                onChange={(e) => setSubForm({ ...subForm, customerId: e.target.value })}
                className="border border-zinc-300 rounded px-2.5 py-2 bg-white"
              >
                <option value="">Select Customer...</option>
                {users.filter((u) => u.role === 'customer').map((c) => (
                  <option key={c.id} value={c.id}>{c.business_name || c.full_name}</option>
                ))}
              </select>
              <input
                type="text"
                required
                placeholder="Retainer Plan Name"
                value={subForm.planName}
                onChange={(e) => setSubForm({ ...subForm, planName: e.target.value })}
                className="border border-zinc-300 rounded px-2.5 py-2 bg-white"
              />
              <input
                type="number"
                required
                min={100}
                placeholder="Monthly INR"
                value={subForm.monthlyPriceInr}
                onChange={(e) => setSubForm({ ...subForm, monthlyPriceInr: e.target.value })}
                className="border border-zinc-300 rounded px-2.5 py-2 bg-white font-mono-tabular"
              />
              <input
                type="date"
                required
                value={subForm.nextBillingDate}
                onChange={(e) => setSubForm({ ...subForm, nextBillingDate: e.target.value })}
                className="border border-zinc-300 rounded px-2.5 py-2 bg-white"
              />
              <button type="submit" className="px-3 py-2 bg-purple-800 text-white font-medium rounded cursor-pointer">
                Activate Retainer
              </button>
            </form>

            {subscriptions.length > 0 && (
              <div className="overflow-x-auto border border-zinc-200 rounded-md">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#F4F3F8] border-b border-zinc-200">
                      <th className="py-2 px-3">Business / Customer</th>
                      <th className="py-2 px-3">Plan</th>
                      <th className="py-2 px-3 text-right">Monthly INR</th>
                      <th className="py-2 px-3">Next Billing</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3 text-right">Control</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {subscriptions.map((sub) => (
                      <tr key={sub.id}>
                        <td className="py-2 px-3 font-medium">{sub.business_name || sub.customer_name}</td>
                        <td className="py-2 px-3">{sub.plan_name}</td>
                        <td className="py-2 px-3 font-mono-tabular text-right">{formatINR(sub.monthly_price_inr)}</td>
                        <td className="py-2 px-3">{formatDateShort(sub.next_billing_date)}</td>
                        <td className="py-2 px-3 font-semibold text-purple-900">{sub.status}</td>
                        <td className="py-2 px-3 text-right space-x-2">
                          {sub.status !== 'Active' && (
                            <button type="button" onClick={() => void handleSubscriptionStatus(sub.id, 'Active')} className="text-emerald-700 hover:underline cursor-pointer">
                              Resume
                            </button>
                          )}
                          {sub.status === 'Active' && (
                            <button type="button" onClick={() => void handleSubscriptionStatus(sub.id, 'Paused')} className="text-amber-700 hover:underline cursor-pointer">
                              Pause
                            </button>
                          )}
                          {sub.status !== 'Cancelled' && (
                            <button type="button" onClick={() => void handleSubscriptionStatus(sub.id, 'Cancelled')} className="text-rose-700 hover:underline cursor-pointer">
                              Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {health && (
            <div className="bg-white border border-zinc-200 rounded-lg p-6 space-y-4">
              <div className="flex flex-wrap justify-between items-center gap-3">
                <div>
                  <h3 className="text-base font-semibold text-zinc-900">Database Monitoring &amp; Backup</h3>
                  <p className="text-xs text-zinc-500">Runtime {health.nodeVersion} · Uptime {health.uptimeSeconds}s · Currency {String(settings.currency || 'INR')}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void downloadAuthenticatedFile(
                      '/api/superadmin/backup',
                      `campus-consult-backup-${new Date().toISOString().slice(0, 10)}.json`
                    ).catch((err) => setError(err instanceof Error ? err.message : 'Backup download failed.'));
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-purple-800 text-white text-xs font-medium rounded cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Download JSON Backup</span>
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-xs">
                {Object.entries(health.tableCounts).map(([table, count]) => (
                  <div key={table} className="border border-zinc-200 rounded p-2.5 bg-[#FAFAFC]">
                    <div className="text-zinc-500 truncate">{table}</div>
                    <div className="font-mono-tabular font-semibold text-zinc-900 text-base mt-0.5">{count}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'settings' && <AccountSettingsModule />}
    </PortalLayout>
  );
}
