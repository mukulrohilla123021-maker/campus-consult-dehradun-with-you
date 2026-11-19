import { useEffect, useState, type FormEvent } from 'react';
import { apiFetch, formatDateShort, formatINR } from '../../lib/api';
import { resolveCategoryFallbackImage, resolveServiceImage } from '../../lib/mediaAssets';
import { useAuth } from '../../context/AuthContext';
import type {
  BookingItem,
  InvoiceItem,
  ProjectItem,
  ProjectMilestone,
  ProjectTask,
  PublicConsultant,
  QuotationItem,
  ReviewItem,
  ServiceCategory,
  ServiceItem,
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

const CUSTOMER_NAV: SidebarNavItem[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'profile', label: 'My Profile' },
  { id: 'services', label: 'Browse Services' },
  { id: 'consultants', label: 'Find Consultants' },
  { id: 'bookings', label: 'My Bookings' },
  { id: 'projects', label: 'My Projects' },
  { id: 'tracking', label: 'Project Tracking' },
  { id: 'messages', label: 'Messages' },
  { id: 'payments', label: 'Payments' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'documents', label: 'Documents' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'support', label: 'Support Tickets' },
  { id: 'settings', label: 'Settings' },
];

interface CustomerDashboardProps {
  onGoPublic: () => void;
  initialBookingServiceId?: string | null;
  onClearInitialBooking?: () => void;
}

export function CustomerDashboard({
  onGoPublic,
  initialBookingServiceId,
  onClearInitialBooking,
}: CustomerDashboardProps) {
  const { user, notifications, markAllNotificationsRead } = useAuth();
  const [tab, setTab] = useState('overview');
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [consultants, setConsultants] = useState<PublicConsultant[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [quotations, setQuotations] = useState<QuotationItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);

  // Service filter & comparison
  const [catFilter, setCatFilter] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [compareIds, setCompareIds] = useState<string[]>([]);

  // Booking wizard state
  const [bookingService, setBookingService] = useState<ServiceItem | null>(null);
  const [projectTitle, setProjectTitle] = useState('');
  const [budgetInr, setBudgetInr] = useState('');
  const [autoAssign, setAutoAssign] = useState(true);
  const [preferredConsultantId, setPreferredConsultantId] = useState('');
  const [requirements, setRequirements] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(() => {
    const d = new Date(Date.now() + 7 * 86400000);
    return d.toISOString().slice(0, 10);
  });
  const [requestQuotation, setRequestQuotation] = useState(false);
  const [bookingDocFile, setBookingDocFile] = useState<{ fileName: string; mimeType: string; contentBase64: string } | null>(null);
  const [submittingBooking, setSubmittingBooking] = useState(false);

  // Project review & revision
  const [revisionProjectId, setRevisionProjectId] = useState('');
  const [revisionNote, setRevisionNote] = useState('');

  // Verified review form
  const [reviewProjectId, setReviewProjectId] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  // Invoice print modal
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceItem | null>(null);

  const openBookingModal = (srv: ServiceItem) => {
    setBookingService(srv);
    setProjectTitle(srv.title);
    setBudgetInr(String(srv.price_inr));
    setBookingDocFile(null);
  };

  const loadAll = async () => {
    try {
      const [mkt, bkg, prj, fin, rev] = await Promise.all([
        apiFetch<{
          categories: ServiceCategory[];
          services: ServiceItem[];
          consultants: PublicConsultant[];
        }>('/api/public/marketplace'),
        apiFetch<{ bookings: BookingItem[]; quotations: QuotationItem[] }>('/api/bookings'),
        apiFetch<{ projects: ProjectItem[]; tasks: ProjectTask[]; milestones: ProjectMilestone[] }>('/api/projects'),
        apiFetch<{ transactions: TransactionItem[]; invoices: InvoiceItem[] }>('/api/finance/ledger'),
        apiFetch<{ reviews: ReviewItem[] }>('/api/reviews'),
      ]);
      setCategories(mkt.categories);
      setServices(mkt.services);
      setConsultants(mkt.consultants);
      setBookings(bkg.bookings);
      setQuotations(bkg.quotations);
      setProjects(prj.projects);
      setTasks(prj.tasks);
      setMilestones(prj.milestones);
      setTransactions(fin.transactions);
      setInvoices(fin.invoices);
      setReviews(rev.reviews);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workspace data.');
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    if (initialBookingServiceId && services.length > 0) {
      const matched = services.find((s) => s.id === initialBookingServiceId);
      if (matched) {
        setTab('services');
        openBookingModal(matched);
      }
      onClearInitialBooking?.();
    }
  }, [initialBookingServiceId, services]);

  const totalBookings = bookings.length;
  const pendingBookingsCount = bookings.filter((b) =>
    ['Draft', 'Pending', 'Under Review', 'Quotation Sent', 'Awaiting Confirmation'].includes(b.status)
  ).length;
  const activeProjects = projects.filter((p) => p.status !== 'Completed').length;
  const completedProjects = projects.filter((p) => p.status === 'Completed').length;
  const pendingPayments = transactions
    .filter((t) => t.status === 'Pending' || t.status === 'Initiated')
    .reduce((s, t) => s + t.total_payable_inr, 0);
  const totalSpending = transactions
    .filter((t) => t.status === 'Successful')
    .reduce((s, t) => s + t.total_payable_inr, 0);

  const handleBookingFileChange = (file: File | null) => {
    if (!file) {
      setBookingDocFile(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      setBookingDocFile({
        fileName: file.name,
        mimeType: file.type || 'application/pdf',
        contentBase64: base64,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitBooking = async (e: FormEvent, isDraft = false) => {
    e.preventDefault();
    if (!bookingService || submittingBooking) return;
    setError('');
    setFeedback('');
    setSubmittingBooking(true);
    try {
      const created = await apiFetch<{ id: string; status: string }>('/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: bookingService.id,
          projectTitle: projectTitle.trim() || bookingService.title,
          budgetInr: Number(budgetInr || bookingService.price_inr),
          autoAssign,
          preferredConsultantId: autoAssign ? null : preferredConsultantId || null,
          requirements,
          expectedDeliveryDate: deliveryDate,
          isDraft,
          requestQuotation,
        }),
      });

      if (bookingDocFile && created.id) {
        await apiFetch('/api/documents', {
          method: 'POST',
          body: JSON.stringify({
            bookingId: created.id,
            category: 'requirement',
            fileName: bookingDocFile.fileName,
            mimeType: bookingDocFile.mimeType,
            contentBase64: bookingDocFile.contentBase64,
          }),
        });
      }

      setBookingService(null);
      setProjectTitle('');
      setBudgetInr('');
      setRequirements('');
      setPreferredConsultantId('');
      setAutoAssign(true);
      setBookingDocFile(null);
      setFeedback(isDraft ? 'Booking saved as Draft.' : 'Booking submitted for Admin review.');
      await loadAll();
      setTab('bookings');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Booking submission failed.');
    } finally {
      setSubmittingBooking(false);
    }
  };

  const handleCustomerBookingAction = async (bookingId: string, action: 'submit_draft' | 'accept_quotation' | 'cancel') => {
    setError('');
    try {
      await apiFetch(`/api/bookings/${bookingId}/customer-action`, {
        method: 'PATCH',
        body: JSON.stringify({ action }),
      });
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
    }
  };

  const handleProjectDecision = async (projectId: string, status: 'Approved' | 'Revision Requested') => {
    setError('');
    try {
      await apiFetch(`/api/projects/${projectId}/workflow`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          revisionNotes: status === 'Revision Requested' ? revisionNote : undefined,
        }),
      });
      setRevisionProjectId('');
      setRevisionNote('');
      setFeedback(status === 'Approved' ? 'Project marked Approved & Completed.' : 'Revision request sent to consultant.');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed.');
    }
  };

  const handleStartProjectChat = async (project: ProjectItem) => {
    await apiFetch('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({
        recipientId: project.consultant_id,
        projectId: project.id,
        subject: `Project: ${project.title}`,
      }),
    });
    setTab('messages');
  };

  const handleSubmitReview = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await apiFetch('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({ projectId: reviewProjectId, rating: reviewRating, comment: reviewComment }),
      });
      setReviewComment('');
      setReviewProjectId('');
      setFeedback('Verified review published.');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Review failed.');
    }
  };

  const filteredServices = services.filter((s) => {
    if (catFilter && s.category_id !== catFilter) return false;
    if (maxPrice && s.price_inr > Number(maxPrice)) return false;
    if (search && !`${s.title} ${s.category_name} ${s.description}`.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    return true;
  });

  const completedUnreviewedProjects = projects.filter(
    (p) => p.status === 'Completed' && !reviews.some((r) => r.project_id === p.id)
  );

  return (
    <PortalLayout
      roleLabel="Customer Portal"
      navItems={CUSTOMER_NAV}
      activeTab={tab}
      onTabChange={setTab}
      onGoPublic={onGoPublic}
      globalSearch={search}
      onGlobalSearchChange={setSearch}
    >
      {feedback && (
        <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-md text-xs sm:text-sm text-emerald-900">
          {feedback}
        </div>
      )}
      {error && (
        <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-md text-xs sm:text-sm text-rose-800">
          {error}
        </div>
      )}

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white border border-zinc-200 rounded-lg p-5">
              <div className="text-xs text-zinc-500">Total Bookings</div>
              <div className="font-mono-tabular text-2xl font-semibold text-zinc-900 mt-1">{totalBookings}</div>
            </div>
            <div className="bg-white border border-zinc-200 rounded-lg p-5">
              <div className="text-xs text-zinc-500">Pending Bookings</div>
              <div className="font-mono-tabular text-2xl font-semibold text-amber-700 mt-1">{pendingBookingsCount}</div>
            </div>
            <div className="bg-white border border-zinc-200 rounded-lg p-5">
              <div className="text-xs text-zinc-500">Active Projects</div>
              <div className="font-mono-tabular text-2xl font-semibold text-blue-700 mt-1">{activeProjects}</div>
            </div>
            <div className="bg-white border border-zinc-200 rounded-lg p-5">
              <div className="text-xs text-zinc-500">Completed Projects</div>
              <div className="font-mono-tabular text-2xl font-semibold text-emerald-700 mt-1">{completedProjects}</div>
            </div>
            <div className="bg-white border border-zinc-200 rounded-lg p-5">
              <div className="text-xs text-zinc-500">Pending Payments</div>
              <div className="font-mono-tabular text-2xl font-semibold text-amber-700 mt-1">{formatINR(pendingPayments)}</div>
            </div>
            <div className="bg-white border border-zinc-200 rounded-lg p-5">
              <div className="text-xs text-zinc-500">Total Spending</div>
              <div className="font-mono-tabular text-2xl font-semibold text-purple-900 mt-1">{formatINR(totalSpending)}</div>
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-lg p-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-semibold text-zinc-900">
                Welcome, {String((user?.profile as Record<string, unknown>)?.business_name || user?.full_name)}
              </h2>
              <p className="text-sm text-zinc-600 mt-1">
                Book bookkeeping, Excel MIS, inventory audits, or digital marketing packages from vetted Dehradun student consultants.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTab('services')}
              className="px-4 py-2 bg-purple-800 hover:bg-purple-900 text-white text-xs font-medium rounded-md cursor-pointer"
            >
              Browse Services &amp; Book
            </button>
          </div>
        </div>
      )}

      {/* PROFILE / SETTINGS */}
      {(tab === 'profile' || tab === 'settings') && <AccountSettingsModule />}

      {/* BROWSE SERVICES & COMPARE + BOOKING MODAL */}
      {tab === 'services' && (
        <div className="space-y-6">
          <div className="bg-white border border-zinc-200 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
              className="border border-zinc-300 rounded-md px-3 py-2 text-sm bg-white"
            >
              <option value="">All {categories.length} Service Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="border border-zinc-300 rounded-md px-3 py-2 text-sm bg-white"
            >
              <option value="">All Price Tiers</option>
              <option value="1500">Up to ₹1,500</option>
              <option value="2000">Up to ₹2,000</option>
              <option value="2500">Up to ₹2,500</option>
            </select>
            <div className="text-xs text-zinc-500 flex items-center justify-end">
              Showing {filteredServices.length} packages · Select up to 2 to compare
            </div>
          </div>

          {/* Quick Category Browse Selector */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCatFilter('')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border cursor-pointer ${
                catFilter === '' ? 'bg-purple-800 text-white border-purple-800' : 'bg-white text-zinc-700 border-zinc-200 hover:border-purple-400'
              }`}
            >
              All Categories
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCatFilter(c.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border cursor-pointer ${
                  catFilter === c.id ? 'bg-purple-800 text-white border-purple-800' : 'bg-white text-zinc-700 border-zinc-200 hover:border-purple-400'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>

          {compareIds.length === 2 && (
            <div className="bg-white border border-purple-200 rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-purple-900">Package Comparison</h3>
                <button type="button" onClick={() => setCompareIds([])} className="text-xs text-zinc-500 hover:underline cursor-pointer">
                  Clear comparison
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {compareIds.map((id) => {
                  const s = services.find((x) => x.id === id);
                  if (!s) return null;
                  return (
                    <div key={id} className="border border-zinc-200 rounded p-4 bg-[#FAFAFC]">
                      <div className="font-semibold text-zinc-900">{s.title}</div>
                      <div className="font-mono-tabular text-base font-semibold text-purple-900 mt-1">
                        {formatINR(s.price_inr)} · {s.estimated_days} days
                      </div>
                      <p className="text-zinc-600 mt-2">{s.deliverables}</p>
                      <p className="text-zinc-500 mt-1">Revisions: {s.revision_policy}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredServices.map((s) => {
              const isCompared = compareIds.includes(s.id);
              const imgSrc = resolveServiceImage(s.image_url, s.category_image_url, s.category_slug || s.category_name);
              const fallbackImg = resolveCategoryFallbackImage(s.category_slug || s.category_name);
              return (
                <div key={s.id} className="bg-white border border-zinc-200 rounded-lg overflow-hidden flex flex-col justify-between">
                  <div>
                    <SmartImage
                      src={imgSrc}
                      fallbackSrc={fallbackImg}
                      alt={s.title}
                      fallbackLabel={s.category_name}
                      aspectClass="aspect-[4/3]"
                      className="border-b border-zinc-100"
                    />
                    <div className="p-5 pb-0">
                      <div className="text-xs font-medium text-purple-800">{s.category_name} · {s.package_name}</div>
                      <h3 className="text-base font-semibold text-zinc-900 mt-1">{s.title}</h3>
                      <p className="text-xs sm:text-sm text-zinc-600 mt-2 leading-relaxed">{s.short_description || s.description}</p>
                      <p className="text-xs text-zinc-500 mt-3"><strong>Deliverables:</strong> {s.deliverables}</p>
                    </div>
                  </div>
                  <div className="mx-5 mb-5 mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between gap-2">
                    <span className="font-mono-tabular text-lg font-semibold text-zinc-900">{formatINR(s.price_inr)}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setCompareIds((prev) =>
                            prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev.slice(-1), s.id]
                          )
                        }
                        className={`px-2.5 py-1.5 border rounded text-xs cursor-pointer ${
                          isCompared ? 'border-purple-700 bg-purple-50 text-purple-900' : 'border-zinc-300 text-zinc-700'
                        }`}
                      >
                        {isCompared ? 'Selected' : 'Compare'}
                      </button>
                      <button
                        type="button"
                        onClick={() => openBookingModal(s)}
                        className="px-3.5 py-1.5 bg-purple-800 hover:bg-purple-900 text-white text-xs font-medium rounded cursor-pointer"
                      >
                        Book Now
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* BOOKING MODAL */}
      {bookingService && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form onSubmit={(e) => void handleSubmitBooking(e, false)} className="bg-white border border-zinc-200 rounded-lg max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-baseline justify-between border-b border-zinc-200 pb-3">
              <div>
                <h3 className="font-semibold text-zinc-900">Book Service: {bookingService.title}</h3>
                <div className="text-xs text-purple-800 font-mono-tabular">
                  Starting Price: {formatINR(bookingService.price_inr)} · Est. {bookingService.estimated_days} days
                </div>
              </div>
              <button type="button" onClick={() => setBookingService(null)} className="text-xs text-zinc-500 cursor-pointer">
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 bg-[#FAFAFC] border border-zinc-200 rounded text-xs text-zinc-700">
              <div><span className="text-zinc-500">Customer:</span> <strong>{user?.full_name}</strong></div>
              <div><span className="text-zinc-500">Email:</span> <strong>{user?.email}</strong></div>
              <div>
                <span className="text-zinc-500">Business:</span>{' '}
                <strong>{String((user?.profile as Record<string, unknown>)?.business_name || 'N/A')}</strong>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Project Title</label>
                <input
                  type="text"
                  required
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Project Budget (INR)</label>
                <input
                  type="number"
                  min={100}
                  required
                  value={budgetInr}
                  onChange={(e) => setBudgetInr(e.target.value)}
                  className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm font-mono-tabular"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Project Description / Requirements</label>
              <textarea
                required
                rows={3}
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                placeholder={bookingService.requirements_prompt}
                className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Preferred Delivery Date</label>
                <input
                  type="date"
                  required
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Consultant Assignment</label>
                <select
                  value={autoAssign ? 'auto' : preferredConsultantId}
                  onChange={(e) => {
                    if (e.target.value === 'auto') {
                      setAutoAssign(true);
                      setPreferredConsultantId('');
                    } else {
                      setAutoAssign(false);
                      setPreferredConsultantId(e.target.value);
                    }
                  }}
                  className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm bg-white"
                >
                  <option value="auto">Auto Assign Best-Match Consultant</option>
                  {consultants.map((c) => (
                    <option key={c.id} value={c.id}>
                      Request: {c.full_name} ({c.specialisation})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Upload Supporting Business Document (Optional — PDF, XLSX, CSV, PNG, JPG max 5 MB)
              </label>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx,.xls,.docx,.txt"
                onChange={(e) => handleBookingFileChange(e.target.files?.[0] || null)}
                className="w-full border border-zinc-300 rounded-md px-3 py-1.5 text-xs bg-white"
              />
              {bookingDocFile && (
                <div className="text-[11px] text-emerald-700 mt-1">Attached: {bookingDocFile.fileName}</div>
              )}
            </div>

            <label className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
              <input
                type="checkbox"
                checked={requestQuotation}
                onChange={(e) => setRequestQuotation(e.target.checked)}
                className="accent-purple-800"
              />
              <span>Request custom quotation before final confirmation</span>
            </label>
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={submittingBooking}
                onClick={(e) => void handleSubmitBooking(e, true)}
                className="px-4 py-2 border border-zinc-300 text-xs font-medium rounded-md cursor-pointer disabled:opacity-60"
              >
                Save Draft
              </button>
              <button
                type="submit"
                disabled={submittingBooking}
                className="px-4 py-2 bg-purple-800 hover:bg-purple-900 text-white text-xs font-medium rounded-md cursor-pointer disabled:opacity-60"
              >
                {submittingBooking ? 'Submitting...' : 'Submit Booking'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* FIND CONSULTANTS */}
      {tab === 'consultants' && (
        <div className="bg-white border border-zinc-200 rounded-lg p-6">
          <h3 className="text-base font-semibold text-zinc-900 mb-4">Approved Student Consultants</h3>
          {consultants.length === 0 ? (
            <p className="text-sm text-zinc-500">No verified consultants available yet. You may submit a booking and Admin will assign a verified consultant.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {consultants.map((c) => (
                <div key={c.id} className="border border-zinc-200 rounded-md p-4 flex justify-between gap-4">
                  <div>
                    <div className="font-semibold text-zinc-900">{c.full_name}</div>
                    <div className="text-xs text-zinc-500">{c.university} · {c.course} · {c.specialisation}</div>
                    <div className="text-xs text-zinc-600 mt-1">Availability: {c.availability_status}</div>
                  </div>
                  <div className="text-right font-mono-tabular text-xs">
                    <div className="font-semibold text-purple-800">{c.rating_avg > 0 ? `${c.rating_avg.toFixed(1)}/5` : 'New'}</div>
                    <button
                      type="button"
                      onClick={() => {
                        setAutoAssign(false);
                        setPreferredConsultantId(c.id);
                        setTab('services');
                      }}
                      className="mt-2 px-3 py-1 bg-purple-800 text-white rounded cursor-pointer"
                    >
                      Select
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MY BOOKINGS */}
      {tab === 'bookings' && (
        <div className="bg-white border border-zinc-200 rounded-lg p-6 space-y-4">
          <h3 className="text-base font-semibold text-zinc-900">My Bookings &amp; Quotations</h3>
          {bookings.length === 0 ? (
            <p className="text-sm text-zinc-500">You have not made any bookings yet.</p>
          ) : (
            <div className="space-y-3">
              {bookings.map((b) => {
                const quote = quotations.find((q) => q.booking_id === b.id && q.status === 'sent');
                return (
                  <div key={b.id} className="border border-zinc-200 rounded-md p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold text-purple-800">{b.status}</div>
                      <h4 className="font-semibold text-zinc-900">{b.project_title || b.service_title}</h4>
                      <div className="text-[11px] text-zinc-500">{b.service_title}</div>
                      <p className="text-xs text-zinc-600 mt-1">{b.requirements}</p>
                      <div className="text-xs text-zinc-500 mt-1">
                        Target Delivery: {formatDateShort(b.expected_delivery_date)} · Price: <span className="font-mono-tabular font-semibold">{formatINR(b.quoted_price_inr)}</span>
                        {b.auto_assign === 1 && !b.assigned_consultant_name ? ' · Auto-Assign Consultant' : ''}
                        {b.assigned_consultant_name && ` · Consultant: ${b.assigned_consultant_name}`}
                      </div>
                      {quote && (
                        <div className="mt-2 p-2.5 bg-purple-50 border border-purple-200 rounded text-xs text-purple-950">
                          <strong>Quotation Received:</strong> {formatINR(quote.amount_inr)} — {quote.scope_notes} (Valid until {formatDateShort(quote.valid_until)})
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      {b.status === 'Draft' && (
                        <button
                          type="button"
                          onClick={() => void handleCustomerBookingAction(b.id, 'submit_draft')}
                          className="px-3 py-1.5 bg-purple-800 text-white text-xs rounded cursor-pointer"
                        >
                          Submit Booking
                        </button>
                      )}
                      {['Quotation Sent', 'Awaiting Confirmation'].includes(b.status) && (
                        <button
                          type="button"
                          onClick={() => void handleCustomerBookingAction(b.id, 'accept_quotation')}
                          className="px-3 py-1.5 bg-emerald-700 text-white text-xs rounded cursor-pointer"
                        >
                          Accept Quotation
                        </button>
                      )}
                      {['Draft', 'Pending', 'Under Review', 'Quotation Sent', 'Awaiting Confirmation'].includes(b.status) && (
                        <button
                          type="button"
                          onClick={() => void handleCustomerBookingAction(b.id, 'cancel')}
                          className="px-3 py-1.5 border border-rose-300 text-rose-700 text-xs rounded cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MY PROJECTS & PROJECT TRACKING */}
      {(tab === 'projects' || tab === 'tracking') && (
        <div className="space-y-5">
          {projects.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-lg p-6 text-sm text-zinc-500">
              No active or completed projects yet. Once an Admin assigns a consultant to your confirmed booking, your project workspace appears here.
            </div>
          ) : (
            projects.map((p) => {
              const pMilestones = milestones.filter((m) => m.project_id === p.id);
              const pTasks = tasks.filter((t) => t.project_id === p.id);
              return (
                <div key={p.id} className="bg-white border border-zinc-200 rounded-lg p-6 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold text-purple-800">{p.status} · Deadline {formatDateShort(p.deadline)}</div>
                      <h3 className="text-lg font-semibold text-zinc-900">{p.title}</h3>
                      <p className="text-xs text-zinc-600 mt-1">Assigned Consultant: <strong>{p.consultant_name}</strong></p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleStartProjectChat(p)}
                        className="px-3 py-1.5 border border-zinc-300 text-xs font-medium rounded cursor-pointer"
                      >
                        Chat with Consultant
                      </button>
                      {p.status === 'Deliverable Submitted' && (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleProjectDecision(p.id, 'Approved')}
                            className="px-3 py-1.5 bg-emerald-700 text-white text-xs font-medium rounded cursor-pointer"
                          >
                            Approve &amp; Complete
                          </button>
                          <button
                            type="button"
                            onClick={() => setRevisionProjectId(p.id)}
                            className="px-3 py-1.5 border border-amber-400 text-amber-800 text-xs font-medium rounded cursor-pointer"
                          >
                            Request Revision
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div>
                    <div className="flex justify-between text-xs text-zinc-600 mb-1">
                      <span>Project Progress</span>
                      <span className="font-mono-tabular font-semibold">{p.progress_pct}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-zinc-100 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-800 transition-all" style={{ width: `${p.progress_pct}%` }} />
                    </div>
                  </div>

                  {p.deliverables_notes && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-950">
                      <strong>Consultant Deliverable Summary:</strong> {p.deliverables_notes}
                    </div>
                  )}

                  {revisionProjectId === p.id && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded space-y-2">
                      <textarea
                        rows={2}
                        placeholder="Describe exact revision changes requested..."
                        value={revisionNote}
                        onChange={(e) => setRevisionNote(e.target.value)}
                        className="w-full border border-amber-300 rounded px-3 py-2 text-xs bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => void handleProjectDecision(p.id, 'Revision Requested')}
                        className="px-3 py-1.5 bg-amber-700 text-white text-xs font-medium rounded cursor-pointer"
                      >
                        Send Revision Request
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2 border-t border-zinc-100">
                    <div>
                      <div className="font-semibold text-zinc-800 mb-2">Milestones</div>
                      <ul className="space-y-1.5">
                        {pMilestones.map((m) => (
                          <li key={m.id} className="flex justify-between text-zinc-600">
                            <span>{m.title}</span>
                            <span className={m.status === 'completed' ? 'text-emerald-700 font-semibold' : 'text-zinc-400'}>
                              {m.status}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="font-semibold text-zinc-800 mb-2">Tasks ({pTasks.length})</div>
                      {pTasks.length === 0 ? (
                        <p className="text-zinc-500">Tasks will appear as your consultant breaks down work.</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {pTasks.map((t) => (
                            <li key={t.id} className="flex justify-between text-zinc-600">
                              <span>{t.title}</span>
                              <span className="capitalize">{t.status.replace('_', ' ')}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* MESSAGES */}
      {tab === 'messages' && <MessagesModule />}

      {/* PAYMENTS & INVOICES */}
      {(tab === 'payments' || tab === 'invoices') && (
        <div className="space-y-6">
          <div className="bg-white border border-zinc-200 rounded-lg p-6">
            <h3 className="text-base font-semibold text-zinc-900 mb-1">Payment Records</h3>
            <p className="text-xs text-zinc-500 mb-4">
              Payments are recorded manually (UPI/Cash/Bank Transfer) by Campus Consult administration unless live Razorpay merchant credentials are configured.
            </p>
            <div className="overflow-x-auto border border-zinc-200 rounded-md">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-[#F4F3F8] border-b border-zinc-200">
                    <th className="py-2.5 px-3 font-semibold">Service</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Amount</th>
                    <th className="py-2.5 px-3 font-semibold">Method / Ref</th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                    <th className="py-2.5 px-3 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {transactions.length === 0 ? (
                    <tr><td colSpan={5} className="py-5 text-center text-xs text-zinc-500">No transactions yet.</td></tr>
                  ) : (
                    transactions.map((t) => (
                      <tr key={t.id}>
                        <td className="py-2.5 px-3 font-medium text-zinc-900">{t.service_title}</td>
                        <td className="py-2.5 px-3 font-mono-tabular text-right">{formatINR(t.total_payable_inr)}</td>
                        <td className="py-2.5 px-3 text-zinc-600">{t.payment_method} {t.payment_reference ? `· ${t.payment_reference}` : ''}</td>
                        <td className="py-2.5 px-3 font-semibold text-purple-900">{t.status}</td>
                        <td className="py-2.5 px-3 text-zinc-500">{formatDateShort(t.created_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-lg p-6">
            <h3 className="text-base font-semibold text-zinc-900 mb-4">Invoices</h3>
            <div className="overflow-x-auto border border-zinc-200 rounded-md">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-[#F4F3F8] border-b border-zinc-200">
                    <th className="py-2.5 px-3 font-semibold">Invoice #</th>
                    <th className="py-2.5 px-3 font-semibold">Service</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Total</th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Download / Print</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {invoices.length === 0 ? (
                    <tr><td colSpan={5} className="py-5 text-center text-xs text-zinc-500">No invoices generated yet.</td></tr>
                  ) : (
                    invoices.map((inv) => (
                      <tr key={inv.id}>
                        <td className="py-2.5 px-3 font-mono-tabular font-semibold text-purple-900">{inv.invoice_number}</td>
                        <td className="py-2.5 px-3">{inv.service_title}</td>
                        <td className="py-2.5 px-3 font-mono-tabular text-right">{formatINR(inv.total_inr)}</td>
                        <td className="py-2.5 px-3">{inv.status}</td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedInvoice(inv)}
                            className="text-xs font-medium text-purple-800 hover:underline cursor-pointer"
                          >
                            View / Print PDF
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <InvoicePrintModal invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />
        </div>
      )}

      {/* DOCUMENTS */}
      {tab === 'documents' && <DocumentsModule defaultCategory="requirement" />}

      {/* VERIFIED REVIEWS */}
      {tab === 'reviews' && (
        <div className="space-y-6">
          {completedUnreviewedProjects.length > 0 && (
            <form onSubmit={handleSubmitReview} className="bg-white border border-zinc-200 rounded-lg p-6 space-y-4">
              <h3 className="text-base font-semibold text-zinc-900">Submit Verified Review</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <select
                  required
                  value={reviewProjectId}
                  onChange={(e) => setReviewProjectId(e.target.value)}
                  className="border border-zinc-300 rounded-md px-3 py-2 text-sm bg-white"
                >
                  <option value="">Select completed project...</option>
                  {completedUnreviewedProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.consultant_name})
                    </option>
                  ))}
                </select>
                <select
                  value={reviewRating}
                  onChange={(e) => setReviewRating(Number(e.target.value))}
                  className="border border-zinc-300 rounded-md px-3 py-2 text-sm bg-white"
                >
                  <option value={5}>5 Stars — Excellent</option>
                  <option value={4}>4 Stars — Very Good</option>
                  <option value={3}>3 Stars — Satisfactory</option>
                  <option value={2}>2 Stars — Needs Improvement</option>
                  <option value={1}>1 Star — Poor</option>
                </select>
              </div>
              <textarea
                required
                rows={2}
                placeholder="Share genuine feedback on project delivery..."
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm"
              />
              <button type="submit" className="px-4 py-2 bg-purple-800 text-white text-xs font-medium rounded-md cursor-pointer">
                Publish Verified Review
              </button>
            </form>
          )}

          <div className="bg-white border border-zinc-200 rounded-lg p-6 space-y-3">
            <h3 className="text-base font-semibold text-zinc-900">Your Published Reviews</h3>
            {reviews.length === 0 ? (
              <p className="text-xs text-zinc-500">Reviews can only be submitted once a project is completed.</p>
            ) : (
              reviews.map((r) => (
                <div key={r.id} className="border border-zinc-200 rounded p-4 text-sm">
                  <div className="flex justify-between text-xs text-zinc-500 mb-1">
                    <span className="font-semibold text-zinc-900">{r.service_title} · {r.consultant_name}</span>
                    <span className="font-mono-tabular font-semibold text-purple-900">{r.rating}/5 Verified</span>
                  </div>
                  <p className="text-zinc-700">{r.comment}</p>
                  {r.consultant_response && (
                    <p className="mt-2 text-xs text-zinc-500"><strong>Consultant reply:</strong> {r.consultant_response}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* NOTIFICATIONS */}
      {tab === 'notifications' && (
        <div className="bg-white border border-zinc-200 rounded-lg p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-semibold text-zinc-900">Notifications Centre</h3>
            <button type="button" onClick={() => void markAllNotificationsRead()} className="text-xs text-purple-800 hover:underline cursor-pointer">
              Mark all read
            </button>
          </div>
          <div className="divide-y divide-zinc-100">
            {notifications.length === 0 ? (
              <p className="text-xs text-zinc-500">No notifications yet.</p>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className="py-3 text-sm">
                  <div className="font-semibold text-zinc-900">{n.title}</div>
                  <div className="text-xs text-zinc-600 mt-0.5">{n.message}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SUPPORT */}
      {tab === 'support' && <SupportModule />}
    </PortalLayout>
  );
}
