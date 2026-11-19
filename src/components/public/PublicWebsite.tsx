import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, CheckCircle2, Mail, MapPin, Phone, Search, Star } from 'lucide-react';
import { apiFetch, formatINR } from '../../lib/api';
import {
  ABOUT_TEAM_IMG,
  DEHRADUN_MARKET_IMG,
  HERO_CONSULTING_IMG,
  HOW_WORKFLOW_IMG,
  resolveCategoryFallbackImage,
  resolveCategoryImage,
  resolveServiceImage,
} from '../../lib/mediaAssets';
import { useAuth } from '../../context/AuthContext';
import type { PublicConsultant, ReviewItem, ServiceCategory, ServiceItem } from '../../types/platform';
import { SmartImage } from '../common/SmartImage';
import { AuthPages, type AuthViewMode } from './AuthPages';

export type PublicPage =
  | 'home'
  | 'about'
  | 'categories'
  | 'services'
  | 'consultants'
  | 'pricing'
  | 'how-it-works'
  | 'contact'
  | 'faq'
  | 'terms'
  | 'privacy'
  | 'refund'
  | 'auth';

interface PublicWebsiteProps {
  onEnterPortal: (selectedServiceId?: string) => void;
}

export function PublicWebsite({ onEnterPortal }: PublicWebsiteProps) {
  const { user } = useAuth();
  const [page, setPage] = useState<PublicPage>('home');
  const [authMode, setAuthMode] = useState<AuthViewMode>('login');
  const [pendingServiceId, setPendingServiceId] = useState<string | undefined>(undefined);
  const [detailService, setDetailService] = useState<ServiceItem | null>(null);

  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [allServicesSnapshot, setAllServicesSnapshot] = useState<ServiceItem[]>([]);
  const [consultants, setConsultants] = useState<PublicConsultant[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [faqItems, setFaqItems] = useState<{ q: string; a: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [minPriceFilter, setMinPriceFilter] = useState('');
  const [maxPriceFilter, setMaxPriceFilter] = useState('');

  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState('');

  const [contactForm, setContactForm] = useState({ name: '', email: '', mobile: '', message: '' });
  const [contactStatus, setContactStatus] = useState('');

  const loadMarketplace = async (q = '', categoryId = '', minPrice = '', maxPrice = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (categoryId) params.set('categoryId', categoryId);
      if (minPrice) params.set('minPrice', minPrice);
      if (maxPrice) params.set('maxPrice', maxPrice);
      const data = await apiFetch<{
        categories: ServiceCategory[];
        services: ServiceItem[];
        consultants: PublicConsultant[];
        verifiedReviews: ReviewItem[];
        settings: { faqItems?: { q: string; a: string }[] };
      }>(`/api/public/marketplace?${params.toString()}`);

      setCategories(data.categories);
      setServices(data.services);
      if (!q && !categoryId && !minPrice && !maxPrice) {
        setAllServicesSnapshot(data.services);
      }
      setConsultants(data.consultants);
      setReviews(data.verifiedReviews);
      setFaqItems(data.settings?.faqItems || []);
    } catch {
      // Handled gracefully
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMarketplace();
  }, []);

  const navigate = (nextPage: PublicPage, nextAuthMode?: AuthViewMode) => {
    setPage(nextPage);
    if (nextAuthMode) setAuthMode(nextAuthMode);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBookNowClick = (serviceId?: string) => {
    setDetailService(null);
    if (user) {
      onEnterPortal(serviceId);
    } else {
      setPendingServiceId(serviceId);
      navigate('auth', 'register-customer');
    }
  };

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    void loadMarketplace(searchQuery, selectedCategory, minPriceFilter, maxPriceFilter);
    if (page === 'home') {
      navigate('services');
    }
  };

  const handleCategoryFilterJump = (categoryId: string) => {
    setSelectedCategory(categoryId);
    void loadMarketplace(searchQuery, categoryId, minPriceFilter, maxPriceFilter);
    navigate('services');
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setMinPriceFilter('');
    setMaxPriceFilter('');
    void loadMarketplace('', '', '', '');
  };

  const handleNewsletter = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch<{ message: string }>('/api/public/newsletter', {
        method: 'POST',
        body: JSON.stringify({ email: newsletterEmail }),
      });
      setNewsletterStatus(res.message);
      setNewsletterEmail('');
    } catch (err) {
      setNewsletterStatus(err instanceof Error ? err.message : 'Subscription failed.');
    }
  };

  const handleContactSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/public/contact', {
        method: 'POST',
        body: JSON.stringify(contactForm),
      });
      setContactStatus('Message received. Our Dehradun coordinator team will respond shortly.');
      setContactForm({ name: '', email: '', mobile: '', message: '' });
    } catch (err) {
      setContactStatus(err instanceof Error ? err.message : 'Failed to send message.');
    }
  };

  const featuredSource = allServicesSnapshot.length > 0 ? allServicesSnapshot : services;
  const featuredServices = featuredSource.slice(0, 8);
  const totalCatalogServices = featuredSource.length;

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F7F9] text-zinc-900">
      {/* Strict 3-Zone Top Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-zinc-200">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-10 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-element Brand Wordmark */}
          <button
            type="button"
            onClick={() => navigate('home')}
            className="font-display text-lg font-semibold tracking-tight text-zinc-900 whitespace-nowrap shrink-0 cursor-pointer hover:text-purple-800 transition-colors"
          >
            Campus Consult Dehradun
          </button>

          {/* Zone 2: 5 concise nav links */}
          <nav aria-label="Public navigation" className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-600">
            <button
              type="button"
              onClick={() => navigate('categories')}
              className={`hover:text-purple-800 hover:underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer ${page === 'categories' ? 'text-purple-800 font-semibold' : ''}`}
            >
              Categories
            </button>
            <button
              type="button"
              onClick={() => {
                void loadMarketplace(searchQuery, selectedCategory, minPriceFilter, maxPriceFilter);
                navigate('services');
              }}
              className={`hover:text-purple-800 hover:underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer ${page === 'services' ? 'text-purple-800 font-semibold' : ''}`}
            >
              Services
            </button>
            <button
              type="button"
              onClick={() => navigate('consultants')}
              className={`hover:text-purple-800 hover:underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer ${page === 'consultants' ? 'text-purple-800 font-semibold' : ''}`}
            >
              Consultants
            </button>
            <button
              type="button"
              onClick={() => navigate('pricing')}
              className={`hover:text-purple-800 hover:underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer ${page === 'pricing' ? 'text-purple-800 font-semibold' : ''}`}
            >
              Pricing
            </button>
            <button
              type="button"
              onClick={() => navigate('how-it-works')}
              className={`hover:text-purple-800 hover:underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer ${page === 'how-it-works' ? 'text-purple-800 font-semibold' : ''}`}
            >
              How It Works
            </button>
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="flex items-center shrink-0">
            {user ? (
              <button
                type="button"
                onClick={() => onEnterPortal()}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-800 hover:bg-purple-900 rounded-md whitespace-nowrap shrink-0 cursor-pointer transition-colors"
              >
                Open Dashboard
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate('auth', 'login')}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-800 hover:bg-purple-900 rounded-md whitespace-nowrap shrink-0 cursor-pointer transition-colors"
              >
                Sign In / Register
              </button>
            )}
          </div>
        </div>

        {/* Compact Mobile Navigation Row */}
        <nav aria-label="Mobile navigation" className="md:hidden border-t border-zinc-100 bg-white px-4 py-2 flex items-center gap-4 overflow-x-auto text-xs font-medium text-zinc-600">
          <button type="button" onClick={() => navigate('categories')} className={`whitespace-nowrap shrink-0 cursor-pointer ${page === 'categories' ? 'text-purple-800 font-semibold' : ''}`}>Categories</button>
          <button type="button" onClick={() => navigate('services')} className={`whitespace-nowrap shrink-0 cursor-pointer ${page === 'services' ? 'text-purple-800 font-semibold' : ''}`}>Services</button>
          <button type="button" onClick={() => navigate('consultants')} className={`whitespace-nowrap shrink-0 cursor-pointer ${page === 'consultants' ? 'text-purple-800 font-semibold' : ''}`}>Consultants</button>
          <button type="button" onClick={() => navigate('pricing')} className={`whitespace-nowrap shrink-0 cursor-pointer ${page === 'pricing' ? 'text-purple-800 font-semibold' : ''}`}>Pricing</button>
          <button type="button" onClick={() => navigate('how-it-works')} className={`whitespace-nowrap shrink-0 cursor-pointer ${page === 'how-it-works' ? 'text-purple-800 font-semibold' : ''}`}>How It Works</button>
        </nav>
      </header>

      <main className="flex-1">
        {page === 'auth' && (
          <AuthPages
            mode={authMode}
            onChangeMode={setAuthMode}
            onAuthSuccess={() => onEnterPortal(pendingServiceId)}
          />
        )}

        {page === 'home' && (
          <div>
            {/* Hero Section */}
            <section className="bg-white border-b border-zinc-200">
              <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-10 py-12 lg:py-16">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
                  <div className="lg:col-span-7 flex flex-col justify-center">
                    <div className="text-xs font-semibold tracking-wider text-purple-800 mb-3">
                      Dehradun, Uttarakhand · Dhiman Market &amp; Selaqui Micro-Consulting
                    </div>
                    <h1 className="font-display text-4xl sm:text-5xl font-semibold text-zinc-900 tracking-tight leading-[1.1] text-balance">
                      Student Talent. Business Solutions. Local Growth.
                    </h1>
                    <p className="mt-4 text-base sm:text-lg text-zinc-600 leading-relaxed max-w-2xl">
                      Hire vetted Dehradun university students for bookkeeping, financial analysis, Excel MIS reporting, inventory audits, digital marketing, and sales development—starting at ₹1,200.
                    </p>

                    {/* Integrated Marketplace Search */}
                    <form onSubmit={handleSearchSubmit} className="mt-7 flex flex-col sm:flex-row gap-3">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search bookkeeping, Excel MIS, inventory audit, marketing..."
                          className="w-full pl-10 pr-4 py-2.5 text-sm border border-zinc-300 rounded-md bg-white focus:outline-none focus:border-purple-700"
                        />
                      </div>
                      <button
                        type="submit"
                        className="px-5 py-2.5 bg-purple-800 hover:bg-purple-900 text-white text-sm font-medium rounded-md whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Find Services
                      </button>
                    </form>

                    <div className="mt-6 flex flex-wrap items-center gap-6 text-xs text-zinc-600">
                      <button
                        type="button"
                        onClick={() => navigate('auth', 'register-customer')}
                        className="font-semibold text-purple-800 hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>Register Your Business</span>
                        <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate('auth', 'register-consultant')}
                        className="font-semibold text-blue-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>Apply as Student Consultant</span>
                        <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate('services')}
                        className="font-semibold text-zinc-700 hover:text-purple-800 hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>Browse All {totalCatalogServices} Services</span>
                        <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <div className="lg:col-span-5">
                    <div className="space-y-3">
                      <SmartImage
                        src={HERO_CONSULTING_IMG}
                        alt="Dehradun student consultants assisting a local business owner with Excel financial records"
                        fallbackLabel="Campus Consult Dehradun"
                        aspectClass="aspect-[4/3]"
                        className="rounded-lg border border-zinc-200 shadow-sm"
                      />
                      <div className="grid grid-cols-3 gap-3 text-center bg-[#FAFAFC] border border-zinc-200 rounded-lg p-3">
                        <div>
                          <div className="font-mono-tabular text-base font-semibold text-purple-900">{categories.length}</div>
                          <div className="text-[11px] text-zinc-600">Active Categories</div>
                        </div>
                        <div>
                          <div className="font-mono-tabular text-base font-semibold text-purple-900">{totalCatalogServices}</div>
                          <div className="text-[11px] text-zinc-600">Service Packages</div>
                        </div>
                        <div>
                          <div className="font-mono-tabular text-base font-semibold text-purple-900">₹1,200+</div>
                          <div className="text-[11px] text-zinc-600">Fixed Starter Fee</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Service Categories Showcase */}
            <section className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-10 py-14">
              <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
                <div>
                  <div className="text-xs font-semibold text-purple-800">Explore By Domain</div>
                  <h2 className="font-display text-3xl font-semibold text-zinc-900 mt-1">
                    {categories.length} Active Business &amp; Consulting Categories
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('categories')}
                  className="text-sm font-medium text-purple-800 hover:underline cursor-pointer"
                >
                  View category directory →
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {categories.map((cat) => {
                  const catImg = resolveCategoryImage(cat.image_url, cat.slug || cat.name);
                  const pkgCount = featuredSource.filter((s) => s.category_id === cat.id).length;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleCategoryFilterJump(cat.id)}
                      className="text-left bg-white border border-zinc-200 rounded-lg overflow-hidden hover:border-purple-400 transition-colors flex flex-col justify-between cursor-pointer group"
                    >
                      <div>
                        <SmartImage
                          src={catImg}
                          fallbackSrc={resolveCategoryFallbackImage(cat.slug || cat.name)}
                          alt={cat.name}
                          fallbackLabel={cat.name}
                          aspectClass="aspect-[4/3]"
                          imgClassName="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                        />
                        <div className="p-4">
                          <div className="text-[11px] font-medium text-purple-800">
                            {pkgCount} {pkgCount === 1 ? 'service' : 'services'}
                          </div>
                          <h3 className="text-sm font-semibold text-zinc-900 mt-1">{cat.name}</h3>
                          <p className="text-xs text-zinc-600 mt-1.5 line-clamp-2 leading-relaxed">{cat.description}</p>
                        </div>
                      </div>
                      <div className="px-4 pb-3.5 text-xs font-semibold text-purple-800 group-hover:underline">
                        Browse {cat.name} →
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Featured Micro-Consulting Services */}
            <section className="bg-white border-y border-zinc-200 py-14">
              <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-10">
                <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
                  <div>
                    <div className="text-xs font-semibold text-purple-800">Service Marketplace</div>
                    <h2 className="font-display text-3xl font-semibold text-zinc-900 mt-1">
                      Featured Micro-Consulting Packages
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      handleResetFilters();
                      navigate('services');
                    }}
                    className="text-sm font-medium text-purple-800 hover:underline cursor-pointer"
                  >
                    Explore all {totalCatalogServices} services →
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {featuredServices.map((srv) => {
                    const srvImg = resolveServiceImage(srv.image_url, srv.category_image_url, srv.category_slug || srv.category_name);
                    return (
                      <div
                        key={srv.id}
                        className="bg-[#FAFAFC] border border-zinc-200 rounded-lg overflow-hidden flex flex-col justify-between"
                      >
                        <div>
                          <SmartImage
                            src={srvImg}
                            fallbackSrc={resolveCategoryFallbackImage(srv.category_slug || srv.category_name)}
                            alt={srv.title}
                            fallbackLabel={srv.category_name}
                            aspectClass="aspect-[4/3]"
                            className="border-b border-zinc-200"
                          />
                          <div className="p-5 pb-0">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                              <span>{srv.category_name} · {srv.estimated_days} days</span>
                              {srv.is_demo === 1 && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-semibold">
                                  DEMO DATA
                                </span>
                              )}
                            </div>
                            <h3 className="text-base font-semibold text-zinc-900 mt-1.5 leading-snug">{srv.title}</h3>
                            <p className="text-xs sm:text-sm text-zinc-600 mt-2 leading-relaxed line-clamp-3">
                              {srv.short_description || srv.description}
                            </p>
                          </div>
                        </div>
                        <div className="mx-5 mb-5 mt-4 pt-3.5 border-t border-zinc-200 flex items-center justify-between gap-2">
                          <div>
                            <span className="font-mono-tabular text-lg font-semibold text-purple-900">
                              {formatINR(srv.price_inr)}
                            </span>
                            <div className="text-[11px] text-zinc-500">Starting price</div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setDetailService(srv)}
                              className="px-2.5 py-1.5 border border-zinc-300 bg-white text-zinc-700 text-xs font-medium rounded-md cursor-pointer hover:border-zinc-400"
                            >
                              Details
                            </button>
                            <button
                              type="button"
                              onClick={() => handleBookNowClick(srv.id)}
                              className="px-3 py-1.5 bg-purple-800 hover:bg-purple-900 text-white text-xs font-medium rounded-md cursor-pointer whitespace-nowrap shrink-0"
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
            </section>

            {/* About Us & Local Student Collaboration */}
            <section className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-10 py-14">
              <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden grid grid-cols-1 lg:grid-cols-12">
                <div className="lg:col-span-6 p-6 sm:p-8 flex flex-col justify-center">
                  <div className="text-xs font-semibold text-purple-800">About Campus Consult Dehradun</div>
                  <h2 className="font-display text-3xl font-semibold text-zinc-900 mt-1">
                    Connecting University Talent With Dehradun Small Businesses
                  </h2>
                  <p className="text-sm sm:text-base text-zinc-600 mt-4 leading-relaxed">
                    Originated at DBS Global University in Dehradun, Campus Consult bridges vetted MBA, BBA, and Commerce students with local shopkeepers, clinics, traders, and MSMEs across Dhiman Market, Selaqui, Prem Nagar, and Dehradun.
                  </p>
                  <p className="text-sm text-zinc-600 mt-3 leading-relaxed">
                    Businesses gain structured bookkeeping, automated Excel MIS dashboards, SKU inventory audits, digital marketing, and sales pipelines without paying expensive metro-agency retainers.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => navigate('about')}
                      className="px-4 py-2 bg-purple-800 hover:bg-purple-900 text-white text-xs font-medium rounded-md cursor-pointer"
                    >
                      Read Our Story
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('contact')}
                      className="px-4 py-2 border border-zinc-300 text-zinc-700 hover:border-purple-600 text-xs font-medium rounded-md cursor-pointer"
                    >
                      Partner With Us
                    </button>
                  </div>
                </div>
                <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-0 border-t lg:border-t-0 lg:border-l border-zinc-200">
                  <SmartImage
                    src={ABOUT_TEAM_IMG}
                    alt="Dehradun university student consulting team collaborating on client projects"
                    fallbackLabel="Student Consulting Team"
                    aspectClass="aspect-[16/9]"
                    className="h-full"
                  />
                </div>
              </div>
            </section>

            {/* How Campus Consult Works + Customer & Student Benefits */}
            <section className="bg-white border-y border-zinc-200 py-14">
              <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-10 space-y-12">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
                  <div className="lg:col-span-5">
                    <SmartImage
                      src={HOW_WORKFLOW_IMG}
                      alt="Structured consulting workflow from booking to project delivery"
                      fallbackLabel="Structured Consulting Workflow"
                      aspectClass="aspect-[16/9]"
                      className="rounded-lg border border-zinc-200"
                    />
                  </div>
                  <div className="lg:col-span-7">
                    <div className="text-xs font-semibold text-purple-800">Workflow</div>
                    <h2 className="font-display text-3xl font-semibold text-zinc-900 mt-1 mb-5">
                      How Campus Consult Works
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        ['01. Book or Request Quote', 'Choose any active service package or submit custom requirements and target delivery timeline.'],
                        ['02. Admin Review & Matching', 'Platform coordinators verify scope, confirm pricing, and assign a screened Dehradun student consultant.'],
                        ['03. Guided Execution & Portal Tracking', 'Monitor milestones, tasks, chat messages, and uploaded deliverables inside your secure portal.'],
                        ['04. Approve & Download Invoice', 'Review deliverables, request revisions if needed, settle payment, and download your official invoice.'],
                      ].map(([title, desc]) => (
                        <div key={title} className="border border-zinc-200 rounded-md p-4 bg-[#FAFAFC]">
                          <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
                          <p className="text-xs text-zinc-600 mt-1.5 leading-relaxed">{desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Benefits for Businesses & Student Consultants */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-purple-900 text-white rounded-lg p-7 flex flex-col justify-between">
                    <div>
                      <div className="text-xs font-medium text-purple-200">For Local Businesses</div>
                      <h3 className="font-display text-2xl font-semibold mt-1 mb-4">
                        Why Dehradun MSMEs Choose Campus Consult
                      </h3>
                      <ul className="space-y-2.5 text-sm text-purple-50">
                        <li className="flex items-start gap-2.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" aria-hidden="true" />
                          <span>Affordable ₹1,200–₹2,500 fixed packages vs. ₹4,000+ traditional agency retainers.</span>
                        </li>
                        <li className="flex items-start gap-2.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" aria-hidden="true" />
                          <span>Counter-side local support in Dhiman Market &amp; Selaqui plus remote digital delivery.</span>
                        </li>
                        <li className="flex items-start gap-2.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" aria-hidden="true" />
                          <span>Admin-verified consultants, revision protection, document vault, and official INR invoicing.</span>
                        </li>
                      </ul>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('auth', 'register-customer')}
                      className="mt-6 w-full py-2.5 bg-white text-purple-900 font-semibold text-sm rounded-md hover:bg-purple-50 cursor-pointer"
                    >
                      Register Your Business
                    </button>
                  </div>

                  <div className="bg-[#FAFAFC] border border-zinc-200 rounded-lg p-7 flex flex-col justify-between">
                    <div>
                      <div className="text-xs font-semibold text-blue-700">For Student Consultants</div>
                      <h3 className="font-display text-2xl font-semibold text-zinc-900 mt-1 mb-4">
                        Build Live Experience &amp; Earn Stipends
                      </h3>
                      <ul className="space-y-2.5 text-sm text-zinc-700">
                        <li className="flex items-start gap-2.5">
                          <CheckCircle2 className="w-4 h-4 text-purple-800 shrink-0 mt-0.5" aria-hidden="true" />
                          <span>Apply MBA/BBA coursework in finance, MIS, marketing, analytics, and sales to live businesses.</span>
                        </li>
                        <li className="flex items-start gap-2.5">
                          <CheckCircle2 className="w-4 h-4 text-purple-800 shrink-0 mt-0.5" aria-hidden="true" />
                          <span>Transparent 85% consultant payout share tracked cleanly per completed engagement.</span>
                        </li>
                        <li className="flex items-start gap-2.5">
                          <CheckCircle2 className="w-4 h-4 text-purple-800 shrink-0 mt-0.5" aria-hidden="true" />
                          <span>Verified project portfolio &amp; customer ratings to strengthen placement readiness.</span>
                        </li>
                      </ul>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('auth', 'register-consultant')}
                      className="mt-6 w-full py-2.5 bg-purple-800 hover:bg-purple-900 text-white font-semibold text-sm rounded-md cursor-pointer"
                    >
                      Apply as Student Consultant
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Verified Consultants & Verified Reviews (Real Database Only) */}
            <section className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-10 py-14">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div>
                  <div className="flex items-baseline justify-between mb-5">
                    <h2 className="font-display text-2xl font-semibold text-zinc-900">
                      Approved Student Consultants
                    </h2>
                    <button
                      type="button"
                      onClick={() => navigate('consultants')}
                      className="text-xs font-medium text-purple-800 hover:underline cursor-pointer"
                    >
                      View directory →
                    </button>
                  </div>
                  {consultants.length === 0 ? (
                    <div className="bg-white border border-zinc-200 rounded-lg p-6 text-sm text-zinc-600">
                      No approved consultants are listed publicly yet. University students can apply via{' '}
                      <button
                        type="button"
                        onClick={() => navigate('auth', 'register-consultant')}
                        className="text-purple-800 font-medium hover:underline cursor-pointer"
                      >
                        Become a Consultant
                      </button>
                      ; profiles appear here once verified by Admin.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {consultants.slice(0, 3).map((c) => (
                        <div key={c.id} className="bg-white border border-zinc-200 rounded-lg p-5 flex items-center justify-between gap-4">
                          <div>
                            <div className="font-semibold text-zinc-900">{c.full_name}</div>
                            <div className="text-xs text-zinc-500 mt-0.5">
                              {c.university} · {c.course} · {c.specialisation}
                            </div>
                          </div>
                          <div className="text-right font-mono-tabular text-xs">
                            <div className="font-semibold text-purple-900">
                              {c.rating_avg > 0 ? `${c.rating_avg.toFixed(1)} / 5` : 'New'}
                            </div>
                            <div className="text-zinc-500">{c.completed_count} projects</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h2 className="font-display text-2xl font-semibold text-zinc-900 mb-5">
                    Verified Customer Testimonials
                  </h2>
                  {reviews.length === 0 ? (
                    <div className="bg-white border border-zinc-200 rounded-lg p-6 text-sm text-zinc-600">
                      Only verified reviews from customers with completed projects are published here. Once initial Dehradun business projects complete, real verified feedback will appear automatically.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {reviews.slice(0, 3).map((rev) => (
                        <div key={rev.id} className="bg-white border border-zinc-200 rounded-lg p-5">
                          <div className="flex items-center justify-between text-xs text-zinc-500 mb-1.5">
                            <span className="font-semibold text-zinc-900">
                              {rev.business_name || rev.customer_name} · {rev.service_title}
                            </span>
                            <span className="inline-flex items-center gap-1 font-mono-tabular text-purple-900 font-semibold">
                              <Star className="w-3.5 h-3.5 fill-purple-800 text-purple-800" aria-hidden="true" />
                              {rev.rating}/5
                            </span>
                          </div>
                          <p className="text-sm text-zinc-700 leading-relaxed">“{rev.comment}”</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Partnership & Newsletter */}
            <section className="bg-white border-t border-zinc-200 py-12">
              <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-10 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                <div>
                  <h2 className="font-display text-2xl font-semibold text-zinc-900">
                    University &amp; Merchant Association Partnerships
                  </h2>
                  <p className="text-sm text-zinc-600 mt-2 leading-relaxed">
                    Partner with Campus Consult Dehradun to connect management student cohorts with local Vyapar Mandals across Selaqui, Prem Nagar, and Dehradun.
                  </p>
                </div>
                <form onSubmit={handleNewsletter} className="bg-[#FAFAFC] border border-zinc-200 rounded-lg p-5">
                  <label className="block text-xs font-semibold text-zinc-800 mb-2">
                    Subscribe to Dehradun Micro-Business &amp; Student Updates
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      required
                      value={newsletterEmail}
                      onChange={(e) => setNewsletterEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="flex-1 border border-zinc-300 rounded-md px-3 py-2 text-sm bg-white"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-purple-800 hover:bg-purple-900 text-white text-sm font-medium rounded-md cursor-pointer"
                    >
                      Subscribe
                    </button>
                  </div>
                  {newsletterStatus && <p className="text-xs text-emerald-700 mt-2">{newsletterStatus}</p>}
                </form>
              </div>
            </section>
          </div>
        )}

        {/* CATEGORIES DIRECTORY PAGE */}
        {page === 'categories' && (
          <section className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-10 py-10">
            <h1 className="font-display text-3xl font-semibold text-zinc-900">Service Categories</h1>
            <p className="text-sm text-zinc-600 mt-1 mb-8">
              Explore all {categories.length} structured micro-consulting and digital support categories available in Dehradun.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {categories.map((cat) => {
                const count = featuredSource.filter((s) => s.category_id === cat.id).length;
                const catImg = resolveCategoryImage(cat.image_url, cat.slug || cat.name);
                return (
                  <div key={cat.id} className="bg-white border border-zinc-200 rounded-lg overflow-hidden flex flex-col justify-between">
                    <div>
                      <SmartImage
                        src={catImg}
                        fallbackSrc={resolveCategoryFallbackImage(cat.slug || cat.name)}
                        alt={cat.name}
                        fallbackLabel={cat.name}
                        aspectClass="aspect-[4/3]"
                        className="border-b border-zinc-100"
                      />
                      <div className="p-5 pb-0">
                        <div className="text-xs text-purple-800 font-semibold">
                          {count} {count === 1 ? 'package' : 'packages'}
                        </div>
                        <h2 className="text-base font-semibold text-zinc-900 mt-1">{cat.name}</h2>
                        <p className="text-xs sm:text-sm text-zinc-600 mt-2 leading-relaxed">{cat.description}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCategoryFilterJump(cat.id)}
                      className="m-5 mt-4 text-left text-xs font-semibold text-purple-800 hover:underline cursor-pointer"
                    >
                      View services in {cat.name} →
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* OUR SERVICES PAGE */}
        {page === 'services' && (
          <section className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-10 py-10">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
              <div>
                <h1 className="font-display text-3xl font-semibold text-zinc-900">Service Marketplace</h1>
                <p className="text-sm text-zinc-600 mt-1">
                  Browse all {categories.length} business consulting and digital support categories in INR ({services.length} shown).
                </p>
              </div>
              {(searchQuery || selectedCategory || minPriceFilter || maxPriceFilter) && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-xs font-medium text-purple-800 hover:underline cursor-pointer"
                >
                  Clear all filters
                </button>
              )}
            </div>

            <form onSubmit={handleSearchSubmit} className="bg-white border border-zinc-200 rounded-lg p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search services or skills..."
                  className="w-full border border-zinc-300 rounded-md pl-9 pr-3 py-2 text-sm"
                />
              </div>
              <select
                value={selectedCategory}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedCategory(val);
                  void loadMarketplace(searchQuery, val, minPriceFilter, maxPriceFilter);
                }}
                className="border border-zinc-300 rounded-md px-3 py-2 text-sm bg-white"
              >
                <option value="">All {categories.length} Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                value={minPriceFilter}
                onChange={(e) => {
                  const val = e.target.value;
                  setMinPriceFilter(val);
                  void loadMarketplace(searchQuery, selectedCategory, val, maxPriceFilter);
                }}
                className="border border-zinc-300 rounded-md px-3 py-2 text-sm bg-white"
              >
                <option value="">Min Price (Any)</option>
                <option value="1200">From ₹1,200</option>
                <option value="1600">From ₹1,600</option>
                <option value="2000">From ₹2,000</option>
              </select>
              <select
                value={maxPriceFilter}
                onChange={(e) => {
                  const val = e.target.value;
                  setMaxPriceFilter(val);
                  void loadMarketplace(searchQuery, selectedCategory, minPriceFilter, val);
                }}
                className="border border-zinc-300 rounded-md px-3 py-2 text-sm bg-white"
              >
                <option value="">Max Price (Any)</option>
                <option value="1500">Up to ₹1,500</option>
                <option value="2000">Up to ₹2,000</option>
                <option value="2500">Up to ₹2,500</option>
              </select>
              <button
                type="submit"
                className="px-4 py-2 bg-purple-800 hover:bg-purple-900 text-white text-sm font-medium rounded-md cursor-pointer"
              >
                Search &amp; Filter
              </button>
            </form>

            {/* Quick Category Pills */}
            <div className="flex flex-wrap gap-2 mb-8">
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('');
                  void loadMarketplace(searchQuery, '', minPriceFilter, maxPriceFilter);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border cursor-pointer ${
                  selectedCategory === '' ? 'bg-purple-800 text-white border-purple-800' : 'bg-white text-zinc-700 border-zinc-200 hover:border-purple-400'
                }`}
              >
                All Categories
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(c.id);
                    void loadMarketplace(searchQuery, c.id, minPriceFilter, maxPriceFilter);
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium border cursor-pointer ${
                    selectedCategory === c.id ? 'bg-purple-800 text-white border-purple-800' : 'bg-white text-zinc-700 border-zinc-200 hover:border-purple-400'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="text-sm text-zinc-500">Loading services...</div>
            ) : services.length === 0 ? (
              <div className="bg-white border border-zinc-200 rounded-lg p-8 text-sm text-zinc-600 flex flex-wrap items-center justify-between gap-4">
                <span>No services matched your filter criteria.</span>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-4 py-2 bg-purple-800 text-white text-xs font-medium rounded-md cursor-pointer"
                >
                  Show All Services
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {services.map((srv) => {
                  const srvImg = resolveServiceImage(srv.image_url, srv.category_image_url, srv.category_slug || srv.category_name);
                  return (
                    <div key={srv.id} className="bg-white border border-zinc-200 rounded-lg overflow-hidden flex flex-col justify-between">
                      <div>
                        <SmartImage
                          src={srvImg}
                          fallbackSrc={resolveCategoryFallbackImage(srv.category_slug || srv.category_name)}
                          alt={srv.title}
                          fallbackLabel={srv.category_name}
                          aspectClass="aspect-[4/3]"
                          className="border-b border-zinc-100"
                        />
                        <div className="p-6 pb-0">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-purple-800 font-medium">
                            <span>{srv.category_name} · {srv.package_name}</span>
                            {srv.is_demo === 1 && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-semibold">
                                DEMO DATA
                              </span>
                            )}
                          </div>
                          <h2 className="text-lg font-semibold text-zinc-900 mt-1.5">{srv.title}</h2>
                          <p className="text-sm text-zinc-600 mt-2 leading-relaxed">{srv.short_description || srv.description}</p>
                          <div className="mt-4 pt-3 border-t border-zinc-100 text-xs text-zinc-600 space-y-1">
                            <div><strong>Deliverables:</strong> {srv.deliverables}</div>
                            <div><strong>Estimated Delivery:</strong> {srv.estimated_days} days · {srv.revision_policy}</div>
                            {srv.required_skills && <div><strong>Skills:</strong> {srv.required_skills}</div>}
                          </div>
                        </div>
                      </div>
                      <div className="mx-6 mb-6 mt-5 pt-4 border-t border-zinc-100 flex items-center justify-between gap-2">
                        <div>
                          <span className="font-mono-tabular text-xl font-semibold text-zinc-900">
                            {formatINR(srv.price_inr)}
                          </span>
                          <div className="text-[11px] text-zinc-500">Starting Price (Pending Confirmation)</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setDetailService(srv)}
                            className="px-3 py-2 border border-zinc-300 text-zinc-700 text-xs font-medium rounded-md cursor-pointer hover:border-zinc-400"
                          >
                            View Details
                          </button>
                          <button
                            type="button"
                            onClick={() => handleBookNowClick(srv.id)}
                            className="px-3.5 py-2 bg-purple-800 hover:bg-purple-900 text-white text-xs font-medium rounded-md cursor-pointer"
                          >
                            Book Now
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* FIND CONSULTANTS PAGE */}
        {page === 'consultants' && (
          <section className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-10 py-10">
            <h1 className="font-display text-3xl font-semibold text-zinc-900">Find Verified Student Consultants</h1>
            <p className="text-sm text-zinc-600 mt-1 mb-6">
              Browse university consultants approved by Campus Consult Dehradun administration.
            </p>
            {consultants.length === 0 ? (
              <div className="bg-white border border-zinc-200 rounded-lg p-8 text-sm text-zinc-600">
                No verified student consultants are currently active in the public directory. Student applicants can register via{' '}
                <button
                  type="button"
                  onClick={() => navigate('auth', 'register-consultant')}
                  className="text-purple-800 font-semibold hover:underline cursor-pointer"
                >
                  Become a Consultant
                </button>
                .
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {consultants.map((c) => {
                  let skillList: string[] = [];
                  try {
                    skillList = JSON.parse(c.skills_json || '[]') as string[];
                  } catch {
                    skillList = [];
                  }
                  return (
                    <div key={c.id} className="bg-white border border-zinc-200 rounded-lg p-6 flex flex-col justify-between">
                      <div>
                        <div className="flex items-baseline justify-between gap-2">
                          <h2 className="text-lg font-semibold text-zinc-900">{c.full_name}</h2>
                          <span className="text-xs font-medium text-emerald-700 capitalize">{c.availability_status}</span>
                        </div>
                        <div className="text-xs text-zinc-500 mt-0.5">
                          {c.university} · {c.course} · {c.specialisation}
                        </div>
                        {c.bio && <p className="text-sm text-zinc-600 mt-3 leading-relaxed">{c.bio}</p>}
                        {skillList.length > 0 && (
                          <div className="text-xs text-zinc-700 mt-3">
                            <strong>Skills:</strong> {skillList.join(' · ')}
                          </div>
                        )}
                      </div>
                      <div className="mt-5 pt-4 border-t border-zinc-100 flex items-center justify-between text-xs">
                        <span className="font-mono-tabular text-zinc-700">
                          Rating: {c.rating_avg > 0 ? `${c.rating_avg.toFixed(1)}/5 (${c.review_count})` : 'Unrated'} · {c.completed_count} completed
                        </span>
                        <button
                          type="button"
                          onClick={() => handleBookNowClick()}
                          className="px-3 py-1.5 bg-purple-800 text-white rounded-md font-medium cursor-pointer"
                        >
                          Request
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* PRICING PAGE */}
        {page === 'pricing' && (
          <section className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-10 py-10">
            <h1 className="font-display text-3xl font-semibold text-zinc-900">Transparent Micro-Consulting Pricing</h1>
            <p className="text-sm text-zinc-600 mt-1 mb-8">
              All rates are in Indian Rupees (INR), structured specifically for small businesses in Dehradun.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {featuredSource.slice(0, 8).map((s) => (
                <div key={s.id} className="bg-white border border-zinc-200 rounded-lg overflow-hidden flex flex-col justify-between">
                  <div>
                    <SmartImage
                      src={resolveServiceImage(s.image_url, s.category_image_url, s.category_slug || s.category_name)}
                      fallbackSrc={resolveCategoryFallbackImage(s.category_slug || s.category_name)}
                      alt={s.title}
                      fallbackLabel={s.category_name}
                      aspectClass="aspect-[4/3]"
                      className="border-b border-zinc-100"
                    />
                    <div className="p-5 pb-0">
                      <div className="text-xs font-semibold text-purple-800">{s.package_name}</div>
                      <h2 className="text-base font-semibold text-zinc-900 mt-1">{s.title}</h2>
                      <div className="font-mono-tabular text-2xl font-semibold text-zinc-900 mt-3">
                        {formatINR(s.price_inr)}
                      </div>
                      <p className="text-xs text-zinc-600 mt-2.5 leading-relaxed">{s.deliverables}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleBookNowClick(s.id)}
                    className="m-5 mt-4 py-2 bg-purple-800 hover:bg-purple-900 text-white text-xs font-medium rounded-md cursor-pointer"
                  >
                    Book This Package
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* HOW IT WORKS PAGE */}
        {page === 'how-it-works' && (
          <section className="max-w-[1040px] mx-auto px-4 sm:px-6 lg:px-10 py-10 space-y-6">
            <h1 className="font-display text-3xl font-semibold text-zinc-900">How Campus Consult Dehradun Works</h1>
            <SmartImage
              src={HOW_WORKFLOW_IMG}
              alt="Campus Consult Dehradun workflow illustration"
              fallbackLabel="Workflow"
              aspectClass="aspect-[16/9]"
              className="rounded-lg border border-zinc-200"
            />
            <div className="bg-white border border-zinc-200 rounded-lg p-7 space-y-5 text-sm text-zinc-700 leading-relaxed">
              <p><strong>1. Service Discovery &amp; Booking:</strong> Businesses choose from {categories.length} structured categories or submit a custom quotation request with expected delivery dates and supporting documents.</p>
              <p><strong>2. Admin Review &amp; Consultant Matching:</strong> Administrators review requirements, confirm pricing, and assign a vetted university student consultant suited to the domain.</p>
              <p><strong>3. Milestone Delivery &amp; Real-Time Chat:</strong> Consultants execute tasks, upload deliverables securely, and collaborate directly with the business owner inside the protected portal.</p>
              <p><strong>4. Approval, Invoicing &amp; Verified Reviews:</strong> Customers review deliverables, request revisions if required, approve completion, download official invoices, and leave verified project ratings.</p>
            </div>
          </section>
        )}

        {/* ABOUT US */}
        {page === 'about' && (
          <section className="max-w-[1040px] mx-auto px-4 sm:px-6 lg:px-10 py-10 space-y-6">
            <h1 className="font-display text-3xl font-semibold text-zinc-900">About Campus Consult Dehradun</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SmartImage
                src={ABOUT_TEAM_IMG}
                alt="Student consulting team collaborating in Dehradun"
                fallbackLabel="Student Consulting Team"
                aspectClass="aspect-[16/9]"
                className="rounded-lg border border-zinc-200"
              />
              <SmartImage
                src={DEHRADUN_MARKET_IMG}
                alt="Dehradun local retail market storefront"
                fallbackLabel="Dehradun Local Business Market"
                aspectClass="aspect-[16/9]"
                className="rounded-lg border border-zinc-200"
              />
            </div>
            <div className="bg-white border border-zinc-200 rounded-lg p-7 space-y-4 text-sm text-zinc-700 leading-relaxed">
              <p>
                Campus Consult Dehradun is a student-led micro-consulting marketplace originated in Dehradun, Uttarakhand, designed to close the gap between skilled university management/commerce talent and neighbourhood small businesses.
              </p>
              <p>
                Local general stores, pharmacies, stationery outlets, and independent retailers—starting from Dhiman Market (Selaqui) across Dehradun—gain structured Excel MIS reporting, bookkeeping clarity, inventory control, sales outreach, and digital visibility at micro-business friendly pricing, while students build real commercial portfolios and earn stipends.
              </p>
            </div>
          </section>
        )}

        {/* CONTACT US */}
        {page === 'contact' && (
          <section className="max-w-[960px] mx-auto px-4 sm:px-6 lg:px-10 py-10">
            <h1 className="font-display text-3xl font-semibold text-zinc-900 mb-6">Contact Us</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white border border-zinc-200 rounded-lg p-6 space-y-4 text-sm text-zinc-700">
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-purple-800 shrink-0 mt-1" aria-hidden="true" />
                  <span>Selaqui &amp; Dhiman Market Corridor, Dehradun, Uttarakhand, India</span>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-purple-800 shrink-0" aria-hidden="true" />
                  <span>support@campusconsultdehradun.in</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-purple-800 shrink-0" aria-hidden="true" />
                  <span>Mon–Sat · 10:00 AM – 6:00 PM IST</span>
                </div>
              </div>
              <form onSubmit={handleContactSubmit} className="bg-white border border-zinc-200 rounded-lg p-6 space-y-3">
                <input
                  type="text"
                  required
                  placeholder="Your Name"
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm"
                />
                <input
                  type="email"
                  required
                  placeholder="Email Address"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm"
                />
                <input
                  type="tel"
                  placeholder="Mobile Number"
                  value={contactForm.mobile}
                  onChange={(e) => setContactForm({ ...contactForm, mobile: e.target.value })}
                  className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm"
                />
                <textarea
                  required
                  rows={3}
                  placeholder="How can Campus Consult assist your business?"
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-800 hover:bg-purple-900 text-white text-sm font-medium rounded-md cursor-pointer"
                >
                  Send Inquiry
                </button>
                {contactStatus && <p className="text-xs text-emerald-700">{contactStatus}</p>}
              </form>
            </div>
          </section>
        )}

        {/* FAQ */}
        {page === 'faq' && (
          <section className="max-w-[900px] mx-auto px-4 sm:px-6 lg:px-10 py-10 space-y-4">
            <h1 className="font-display text-3xl font-semibold text-zinc-900 mb-6">Frequently Asked Questions</h1>
            {faqItems.map((item) => (
              <div key={item.q} className="bg-white border border-zinc-200 rounded-lg p-5">
                <h2 className="text-sm font-semibold text-zinc-900">{item.q}</h2>
                <p className="text-sm text-zinc-600 mt-1.5 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </section>
        )}

        {/* LEGAL PAGES */}
        {(page === 'terms' || page === 'privacy' || page === 'refund') && (
          <section className="max-w-[900px] mx-auto px-4 sm:px-6 lg:px-10 py-10">
            <div className="bg-white border border-zinc-200 rounded-lg p-8 space-y-4 text-sm text-zinc-700 leading-relaxed">
              <h1 className="font-display text-3xl font-semibold text-zinc-900">
                {page === 'terms'
                  ? 'Terms & Conditions'
                  : page === 'privacy'
                  ? 'Privacy Policy'
                  : 'Refund & Cancellation Policy'}
              </h1>
              {page === 'terms' && (
                <>
                  <p>Campus Consult Dehradun acts as a curated micro-consulting marketplace connecting registered business customers with vetted university student consultants. Services cover bookkeeping assistance, Excel MIS reporting, inventory tracking, and digital marketing—and do not constitute statutory Chartered Accountant audit sign-offs.</p>
                  <p>All project deliverables, revisions, and invoices are governed by the package scope confirmed at booking.</p>
                </>
              )}
              {page === 'privacy' && (
                <>
                  <p>Customer financial ledgers, uploaded bills, and consultant credentials are stored privately and accessed strictly by authorised project participants and platform administrators. Private documents are never exposed via public URLs.</p>
                  <p>We do not sell business transaction data to third parties. Passwords are cryptographically hashed using scrypt and sessions are protected with signed HTTP-only cookies.</p>
                </>
              )}
              {page === 'refund' && (
                <>
                  <p>Pending bookings may be cancelled before project commencement with no penalty. Once a project is Confirmed and active delivery begins, customers receive the agreed revision rounds per package policy.</p>
                  <p>Disputes or refund requests may be submitted via the Support Tickets module and are reviewed by Platform Administration with full audit tracking.</p>
                </>
              )}
            </div>
          </section>
        )}
      </main>

      {/* Quiet Professional Footer */}
      <footer className="bg-white border-t border-zinc-200 mt-12">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-10 py-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 text-xs text-zinc-600">
          <div>
            <div className="font-display text-base font-semibold text-zinc-900">Campus Consult Dehradun</div>
            <p className="mt-2 leading-relaxed">
              Empowering Students. Supporting Local Businesses. Dehradun, Uttarakhand, India.
            </p>
          </div>
          <div className="space-y-2">
            <div className="font-semibold text-zinc-900">Marketplace</div>
            <div className="flex flex-col items-start gap-1.5">
              <button type="button" onClick={() => navigate('categories')} className="hover:text-purple-800 cursor-pointer">Service Categories</button>
              <button type="button" onClick={() => navigate('services')} className="hover:text-purple-800 cursor-pointer">Our Services</button>
              <button type="button" onClick={() => navigate('consultants')} className="hover:text-purple-800 cursor-pointer">Find Consultants</button>
              <button type="button" onClick={() => navigate('pricing')} className="hover:text-purple-800 cursor-pointer">Pricing</button>
              <button type="button" onClick={() => navigate('how-it-works')} className="hover:text-purple-800 cursor-pointer">How It Works</button>
            </div>
          </div>
          <div className="space-y-2">
            <div className="font-semibold text-zinc-900">Company &amp; Onboarding</div>
            <div className="flex flex-col items-start gap-1.5">
              <button type="button" onClick={() => navigate('about')} className="hover:text-purple-800 cursor-pointer">About Us</button>
              <button type="button" onClick={() => navigate('auth', 'register-customer')} className="hover:text-purple-800 cursor-pointer">Business Registration</button>
              <button type="button" onClick={() => navigate('auth', 'register-consultant')} className="hover:text-purple-800 cursor-pointer">Become a Consultant</button>
              <button type="button" onClick={() => navigate('contact')} className="hover:text-purple-800 cursor-pointer">Contact Us</button>
            </div>
          </div>
          <div className="space-y-2">
            <div className="font-semibold text-zinc-900">Policies &amp; Help</div>
            <div className="flex flex-col items-start gap-1.5">
              <button type="button" onClick={() => navigate('faq')} className="hover:text-purple-800 cursor-pointer">FAQ</button>
              <button type="button" onClick={() => navigate('terms')} className="hover:text-purple-800 cursor-pointer">Terms &amp; Conditions</button>
              <button type="button" onClick={() => navigate('privacy')} className="hover:text-purple-800 cursor-pointer">Privacy Policy</button>
              <button type="button" onClick={() => navigate('refund')} className="hover:text-purple-800 cursor-pointer">Refund &amp; Cancellation Policy</button>
            </div>
          </div>
        </div>
      </footer>

      {/* SERVICE DETAILS MODAL */}
      {detailService && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-lg max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-3">
              <div>
                <div className="text-xs font-semibold text-purple-800">
                  {detailService.category_name} · {detailService.package_name}
                </div>
                <h2 className="text-lg font-semibold text-zinc-900 mt-1">{detailService.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setDetailService(null)}
                className="text-xs text-zinc-500 hover:text-zinc-900 cursor-pointer"
              >
                Close
              </button>
            </div>
            <SmartImage
              src={resolveServiceImage(
                detailService.image_url,
                detailService.category_image_url,
                detailService.category_slug || detailService.category_name
              )}
              fallbackSrc={resolveCategoryFallbackImage(detailService.category_slug || detailService.category_name)}
              alt={detailService.title}
              fallbackLabel={detailService.category_name}
              aspectClass="aspect-[16/9]"
              className="rounded-md border border-zinc-200"
            />
            <p className="text-sm text-zinc-700 leading-relaxed">{detailService.description}</p>
            <div className="bg-[#FAFAFC] border border-zinc-200 rounded-md p-4 space-y-2 text-xs text-zinc-700">
              <div><strong>Deliverables Included:</strong> {detailService.deliverables}</div>
              <div><strong>Estimated Timeline:</strong> {detailService.estimated_days} days</div>
              <div><strong>Revision Policy:</strong> {detailService.revision_policy}</div>
              {detailService.required_skills && (
                <div><strong>Consultant Skill Requirements:</strong> {detailService.required_skills}</div>
              )}
              <div><strong>Client Preparation:</strong> {detailService.requirements_prompt}</div>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-zinc-200">
              <div>
                <div className="font-mono-tabular text-2xl font-semibold text-purple-900">
                  {formatINR(detailService.price_inr)}
                </div>
                <div className="text-[11px] text-zinc-500">Starting Price · Final scope confirmed by Admin</div>
              </div>
              <button
                type="button"
                onClick={() => handleBookNowClick(detailService.id)}
                className="px-5 py-2.5 bg-purple-800 hover:bg-purple-900 text-white text-xs font-semibold rounded-md cursor-pointer"
              >
                Book This Service
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
