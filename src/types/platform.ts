export type UserRole = 'customer' | 'consultant' | 'admin' | 'super_admin';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  mobile: string;
  status: 'active' | 'suspended';
  email_verified: number;
  notification_prefs_json: string;
  created_at: string;
  updated_at: string;
  is_demo?: number;
  profile: Record<string, unknown> | null;
}

export interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  sort_order: number;
  is_active: number;
  image_url?: string;
}

export interface ServiceItem {
  id: string;
  category_id: string;
  category_name: string;
  category_slug?: string;
  category_image_url?: string;
  title: string;
  short_description?: string;
  description: string;
  price_inr: number;
  package_name: string;
  deliverables: string;
  estimated_days: number;
  requirements_prompt: string;
  revision_policy: string;
  required_skills?: string;
  image_url?: string;
  is_starting_price?: number;
  consultant_id: string | null;
  consultant_name?: string | null;
  is_active: number;
  is_demo?: number;
}

export interface PublicConsultant {
  id: string;
  full_name: string;
  university: string;
  course: string;
  specialisation: string;
  skills_json: string;
  experience: string;
  portfolio_url: string;
  bio: string;
  availability_status: 'available' | 'busy' | 'unavailable';
  rating_avg: number;
  review_count: number;
  completed_count: number;
}

export interface BookingItem {
  id: string;
  customer_id: string;
  service_id: string;
  service_title: string;
  list_price_inr: number;
  package_name: string;
  preferred_consultant_id: string | null;
  preferred_consultant_name?: string | null;
  assigned_consultant_id: string | null;
  assigned_consultant_name?: string | null;
  customer_name: string;
  business_name?: string;
  project_title?: string;
  requirements: string;
  expected_delivery_date: string;
  budget_inr?: number;
  auto_assign?: number;
  quoted_price_inr: number;
  status: string;
  status_history_json: string;
  created_at: string;
  updated_at: string;
  is_demo?: number;
}

export interface SubscriptionItem {
  id: string;
  customer_id: string;
  customer_name: string;
  business_name?: string;
  service_id: string | null;
  service_title?: string | null;
  plan_name: string;
  monthly_price_inr: number;
  billing_cycle: string;
  status: 'Active' | 'Paused' | 'Cancelled';
  next_billing_date: string;
  notes: string;
  created_at: string;
}

export interface VenturePlanNote {
  section_key: string;
  section_title: string;
  assumptions: string;
  targets: string;
  validation_notes: string;
  updated_by: string;
  updated_at: string;
}

export interface QuotationItem {
  id: string;
  booking_id: string;
  customer_id: string;
  amount_inr: number;
  scope_notes: string;
  valid_until: string;
  status: 'sent' | 'accepted' | 'declined';
  created_at: string;
}

export interface ProjectItem {
  id: string;
  booking_id: string;
  customer_id: string;
  consultant_id: string;
  service_id: string;
  service_title: string;
  revision_policy?: string;
  customer_name: string;
  business_name?: string;
  consultant_name: string;
  title: string;
  description: string;
  status: string;
  progress_pct: number;
  deadline: string;
  deliverables_notes: string;
  revision_notes: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectTask {
  id: string;
  project_id: string;
  title: string;
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in_progress' | 'done';
  due_date: string;
  created_at: string;
}

export interface ProjectMilestone {
  id: string;
  project_id: string;
  title: string;
  status: 'pending' | 'completed';
  due_date: string;
  completed_at: string;
}

export interface DocumentItem {
  id: string;
  owner_id: string;
  owner_name: string;
  project_id: string | null;
  booking_id: string | null;
  category: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  visibility: string;
  created_at: string;
}

export interface ConversationItem {
  id: string;
  subject: string;
  project_id: string | null;
  participant_a: string;
  participant_a_name: string;
  participant_a_role: string;
  participant_b: string;
  participant_b_name: string;
  participant_b_role: string;
  last_message_at: string;
}

export interface MessageItem {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  body: string;
  attachment_doc_id: string | null;
  attachment_name?: string | null;
  is_read: number;
  created_at: string;
}

export interface TransactionItem {
  id: string;
  booking_id: string;
  project_id: string | null;
  customer_id: string;
  customer_name: string;
  business_name?: string;
  consultant_id: string | null;
  consultant_name?: string | null;
  service_title: string;
  gross_amount_inr: number;
  tax_amount_inr: number;
  total_payable_inr: number;
  commission_pct: number;
  commission_amount_inr: number;
  consultant_earning_inr: number;
  payment_method: string;
  payment_reference: string;
  status: string;
  refund_amount_inr: number;
  created_at: string;
  is_demo?: number;
}

export interface InvoiceItem {
  id: string;
  invoice_number: string;
  transaction_id: string;
  booking_id: string;
  customer_id: string;
  customer_name: string;
  business_name?: string;
  customer_address?: string;
  customer_email?: string;
  customer_mobile?: string;
  consultant_name?: string;
  service_title: string;
  subtotal_inr: number;
  tax_pct: number;
  tax_amount_inr: number;
  total_inr: number;
  status: string;
  issued_at: string;
  is_demo?: number;
}

export interface PayoutItem {
  id: string;
  consultant_id: string;
  consultant_name?: string;
  amount_inr: number;
  reference: string;
  status: string;
  period_label: string;
  created_at: string;
}

export interface ExpenseItem {
  id: string;
  category: string;
  description: string;
  amount_inr: number;
  expense_date: string;
  created_at: string;
}

export interface ReviewItem {
  id: string;
  project_id: string;
  service_id: string;
  service_title: string;
  customer_id: string;
  customer_name: string;
  business_name?: string;
  consultant_id: string;
  consultant_name: string;
  rating: number;
  comment: string;
  consultant_response: string;
  is_verified: number;
  is_flagged: number;
  moderation_status: string;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link_tab: string;
  is_read: number;
  created_at: string;
}

export interface SupportTicketItem {
  id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  subject: string;
  status: string;
  refund_requested: number;
  created_at: string;
  updated_at: string;
}

export interface SupportMessageItem {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  body: string;
  is_internal_note: number;
  created_at: string;
}
