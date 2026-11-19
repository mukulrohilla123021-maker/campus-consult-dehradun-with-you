import { useEffect, useState, type FormEvent } from 'react';
import { apiFetch, formatDateShort, formatINR } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import type {
  BookingItem,
  PayoutItem,
  ProjectItem,
  ProjectMilestone,
  ProjectTask,
  ReviewItem,
  TransactionItem,
} from '../../types/platform';
import { PortalLayout, type SidebarNavItem } from './PortalLayout';
import {
  AccountSettingsModule,
  DocumentsModule,
  MessagesModule,
  SupportModule,
} from './SharedWorkspaceModules';

const CONSULTANT_NAV: SidebarNavItem[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'profile', label: 'My Profile' },
  { id: 'skills', label: 'My Skills' },
  { id: 'portfolio', label: 'Portfolio & Certs' },
  { id: 'available', label: 'Available Projects' },
  { id: 'requests', label: 'Project Requests' },
  { id: 'active', label: 'My Active Projects' },
  { id: 'completed', label: 'Completed Projects' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'messages', label: 'Messages' },
  { id: 'earnings', label: 'Earnings' },
  { id: 'payments', label: 'Payment History' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'support', label: 'Support' },
  { id: 'settings', label: 'Settings' },
];

interface AvailabilitySlot {
  id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  slot_note: string;
}

export function ConsultantDashboard({ onGoPublic }: { onGoPublic: () => void }) {
  const { user, notifications, markAllNotificationsRead } = useAuth();
  const [tab, setTab] = useState('overview');
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);

  // Active project editing states
  const [taskTitleByProject, setTaskTitleByProject] = useState<Record<string, string>>({});
  const [deliverableNoteByProject, setDeliverableNoteByProject] = useState<Record<string, string>>({});

  // Calendar slot form
  const [dayOfWeek, setDayOfWeek] = useState('Monday');
  const [startTime, setStartTime] = useState('14:00');
  const [endTime, setEndTime] = useState('18:00');
  const [slotNote, setSlotNote] = useState('Dhiman Market / Selaqui shop visits');

  // Review reply
  const [replyByReview, setReplyByReview] = useState<Record<string, string>>({});

  const profile = (user?.profile || {}) as Record<string, unknown>;
  const approvalStatus = String(profile.approval_status || 'pending');
  const rejectionReason = String(profile.rejection_reason || '');
  const isApproved = approvalStatus === 'approved';

  const loadAll = async () => {
    try {
      const [bkg, prj, fin, rev, avl] = await Promise.all([
        apiFetch<{ bookings: BookingItem[] }>('/api/bookings'),
        apiFetch<{ projects: ProjectItem[]; tasks: ProjectTask[]; milestones: ProjectMilestone[] }>('/api/projects'),
        apiFetch<{ transactions: TransactionItem[]; payouts: PayoutItem[] }>('/api/finance/ledger'),
        apiFetch<{ reviews: ReviewItem[] }>('/api/reviews'),
        apiFetch<{ slots: AvailabilitySlot[] }>('/api/consultant/availability'),
      ]);
      setBookings(bkg.bookings);
      setProjects(prj.projects);
      setTasks(prj.tasks);
      setMilestones(prj.milestones);
      setTransactions(fin.transactions);
      setPayouts(fin.payouts);
      setReviews(rev.reviews);
      setSlots(avl.slots);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load consultant workspace.');
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const totalProjects = projects.length;
  const activeProjectsList = projects.filter((p) => p.status !== 'Completed');
  const completedProjectsList = projects.filter((p) => p.status === 'Completed');
  const totalEarnings = transactions
    .filter((t) => t.status === 'Successful')
    .reduce((s, t) => s + t.consultant_earning_inr, 0);
  const paidOut = payouts.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount_inr, 0);
  const pendingEarnings = Math.max(0, totalEarnings - paidOut);
  const avgRating = Number(profile.rating_avg || 0);

  const handleProjectWorkflow = async (projectId: string, status: string, progressPct?: number) => {
    setError('');
    try {
      await apiFetch(`/api/projects/${projectId}/workflow`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          progressPct,
          deliverablesNotes: deliverableNoteByProject[projectId],
        }),
      });
      setFeedback(`Project moved to ${status}.`);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed.');
    }
  };

  const handleAddTask = async (projectId: string) => {
    const title = (taskTitleByProject[projectId] || '').trim();
    if (!title) return;
    await apiFetch(`/api/projects/${projectId}/tasks`, {
      method: 'POST',
      body: JSON.stringify({ title, priority: 'medium' }),
    });
    setTaskTitleByProject((prev) => ({ ...prev, [projectId]: '' }));
    await loadAll();
  };

  const handleToggleTask = async (task: ProjectTask) => {
    const next = task.status === 'done' ? 'todo' : 'done';
    await apiFetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: next }),
    });
    await loadAll();
  };

  const handleToggleMilestone = async (m: ProjectMilestone) => {
    const next = m.status === 'completed' ? 'pending' : 'completed';
    await apiFetch(`/api/milestones/${m.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: next }),
    });
    await loadAll();
  };

  const handleAddAvailability = async (e: FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/consultant/availability', {
      method: 'POST',
      body: JSON.stringify({ dayOfWeek, startTime, endTime, slotNote }),
    });
    await loadAll();
  };

  const handleDeleteSlot = async (id: string) => {
    await apiFetch(`/api/consultant/availability/${id}`, { method: 'DELETE' });
    await loadAll();
  };

  const handleReplyReview = async (revId: string) => {
    const text = (replyByReview[revId] || '').trim();
    if (!text) return;
    await apiFetch(`/api/reviews/${revId}`, {
      method: 'PATCH',
      body: JSON.stringify({ consultantResponse: text }),
    });
    await loadAll();
  };

  const handleStartChatWithCustomer = async (project: ProjectItem) => {
    await apiFetch('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({
        recipientId: project.customer_id,
        projectId: project.id,
        subject: `Project: ${project.title}`,
      }),
    });
    setTab('messages');
  };

  return (
    <PortalLayout
      roleLabel="Student Consultant Portal"
      navItems={CONSULTANT_NAV}
      activeTab={tab}
      onTabChange={setTab}
      onGoPublic={onGoPublic}
      globalSearch={search}
      onGlobalSearchChange={setSearch}
    >
      {approvalStatus === 'pending' && (
        <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-md text-xs sm:text-sm text-amber-950">
          <strong>Credential Verification Status: PENDING ADMIN APPROVAL.</strong>{' '}
          Your application ({String(profile.student_id || 'Student ID')} · {String(profile.university || '')}) is in the Admin verification queue. Live project acceptance and client assignments unlock automatically once approved. You may review your Profile, Skills, and Portfolio documents below.
        </div>
      )}
      {approvalStatus === 'rejected' && (
        <div className="mb-5 p-4 bg-rose-50 border border-rose-200 rounded-md text-xs sm:text-sm text-rose-900 space-y-1">
          <div>
            <strong>Application Rejected:</strong> Your consultant credential verification was not approved.
          </div>
          {rejectionReason && (
            <div>
              <strong>Admin Reason:</strong> {rejectionReason}
            </div>
          )}
          <div className="text-xs text-rose-800">
            Update your credentials under My Profile or upload updated documents under Portfolio &amp; Certs and contact Support for re-verification.
          </div>
        </div>
      )}
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
            <div className="bg-white border border-zinc-200 rounded-lg p-4">
              <div className="text-xs text-zinc-500">Total Projects</div>
              <div className="font-mono-tabular text-2xl font-semibold text-zinc-900 mt-1">{totalProjects}</div>
            </div>
            <div className="bg-white border border-zinc-200 rounded-lg p-4">
              <div className="text-xs text-zinc-500">Active Projects</div>
              <div className="font-mono-tabular text-2xl font-semibold text-blue-700 mt-1">{activeProjectsList.length}</div>
            </div>
            <div className="bg-white border border-zinc-200 rounded-lg p-4">
              <div className="text-xs text-zinc-500">Completed</div>
              <div className="font-mono-tabular text-2xl font-semibold text-emerald-700 mt-1">{completedProjectsList.length}</div>
            </div>
            <div className="bg-white border border-zinc-200 rounded-lg p-4">
              <div className="text-xs text-zinc-500">Total Earnings</div>
              <div className="font-mono-tabular text-2xl font-semibold text-purple-900 mt-1">{formatINR(totalEarnings)}</div>
            </div>
            <div className="bg-white border border-zinc-200 rounded-lg p-4">
              <div className="text-xs text-zinc-500">Pending Payout</div>
              <div className="font-mono-tabular text-2xl font-semibold text-amber-700 mt-1">{formatINR(pendingEarnings)}</div>
            </div>
            <div className="bg-white border border-zinc-200 rounded-lg p-4">
              <div className="text-xs text-zinc-500">Average Rating</div>
              <div className="font-mono-tabular text-2xl font-semibold text-zinc-900 mt-1">
                {avgRating > 0 ? `${avgRating.toFixed(1)}/5` : '—'}
              </div>
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-lg p-6">
            <h2 className="font-display text-xl font-semibold text-zinc-900">
              Assigned Workflow &amp; Deadlines
            </h2>
            <p className="text-sm text-zinc-600 mt-1">
              You only see projects and customer requirements assigned specifically to your account.
            </p>
          </div>
        </div>
      )}

      {/* PROFILE / SKILLS / SETTINGS */}
      {(tab === 'profile' || tab === 'skills' || tab === 'settings') && <AccountSettingsModule />}

      {/* PORTFOLIO & CERTIFICATES */}
      {tab === 'portfolio' && <DocumentsModule defaultCategory="certificate" />}

      {/* AVAILABLE & REQUESTED PROJECTS */}
      {(tab === 'available' || tab === 'requests') && (
        <div className="space-y-4">
          <div className="bg-white border border-zinc-200 rounded-lg p-6">
            <h3 className="text-base font-semibold text-zinc-900 mb-3">
              {tab === 'requests' ? 'Assigned Project Requests' : 'Bookings Mentioning Your Profile'}
            </h3>
            {projects.filter((p) => p.status === 'Assigned').length === 0 && bookings.length === 0 ? (
              <p className="text-sm text-zinc-500">No new project requests right now.</p>
            ) : (
              <div className="space-y-3">
                {projects
                  .filter((p) => p.status === 'Assigned')
                  .map((p) => (
                    <div key={p.id} className="border border-purple-200 bg-purple-50/40 rounded-md p-4 flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <div className="text-xs font-semibold text-purple-900">New Assignment · Due {formatDateShort(p.deadline)}</div>
                        <h4 className="font-semibold text-zinc-900">{p.title}</h4>
                        <p className="text-xs text-zinc-600 mt-1">{p.description}</p>
                        <div className="text-xs text-zinc-500 mt-1">Customer: {p.business_name || p.customer_name}</div>
                      </div>
                      <button
                        type="button"
                        disabled={!isApproved}
                        title={!isApproved ? 'Admin verification approval required before accepting projects' : undefined}
                        onClick={() => void handleProjectWorkflow(p.id, 'Accepted', 20)}
                        className="px-4 py-2 bg-purple-800 hover:bg-purple-900 disabled:opacity-50 text-white text-xs font-medium rounded cursor-pointer"
                      >
                        {isApproved ? 'Accept Project' : 'Approval Required'}
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ACTIVE & COMPLETED PROJECTS */}
      {(tab === 'active' || tab === 'completed') && (
        <div className="space-y-5">
          {(tab === 'active' ? activeProjectsList : completedProjectsList).length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-lg p-6 text-sm text-zinc-500">
              No {tab === 'active' ? 'active' : 'completed'} projects found.
            </div>
          ) : (
            (tab === 'active' ? activeProjectsList : completedProjectsList).map((p) => {
              const pTasks = tasks.filter((t) => t.project_id === p.id);
              const pMilestones = milestones.filter((m) => m.project_id === p.id);
              return (
                <div key={p.id} className="bg-white border border-zinc-200 rounded-lg p-6 space-y-4">
                  <div className="flex flex-wrap justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold text-purple-800">{p.status} · Deadline {formatDateShort(p.deadline)}</div>
                      <h3 className="text-lg font-semibold text-zinc-900">{p.title}</h3>
                      <p className="text-xs text-zinc-600 mt-1">Client: {p.business_name || p.customer_name}</p>
                      <p className="text-xs text-zinc-700 mt-1"><strong>Requirements:</strong> {p.description}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 items-start">
                      <button
                        type="button"
                        onClick={() => void handleStartChatWithCustomer(p)}
                        className="px-3 py-1.5 border border-zinc-300 text-xs font-medium rounded cursor-pointer"
                      >
                        Message Customer
                      </button>
                      {p.status === 'Accepted' && (
                        <button
                          type="button"
                          onClick={() => void handleProjectWorkflow(p.id, 'Started', 30)}
                          className="px-3 py-1.5 bg-blue-700 text-white text-xs font-medium rounded cursor-pointer"
                        >
                          Start Work
                        </button>
                      )}
                      {['Started', 'In Progress', 'Revision Requested'].includes(p.status) && (
                        <button
                          type="button"
                          onClick={() => void handleProjectWorkflow(p.id, 'In Progress', Math.min(85, p.progress_pct + 20))}
                          className="px-3 py-1.5 bg-zinc-900 text-white text-xs font-medium rounded cursor-pointer"
                        >
                          Log Progress (+20%)
                        </button>
                      )}
                    </div>
                  </div>

                  {p.revision_notes && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-950">
                      <strong>Customer Revision Request:</strong> {p.revision_notes}
                    </div>
                  )}

                  {/* Progress Bar */}
                  <div className="w-full h-2.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-800" style={{ width: `${p.progress_pct}%` }} />
                  </div>

                  {/* Deliverable submission */}
                  {p.status !== 'Completed' && (
                    <div className="p-4 bg-[#FAFAFC] border border-zinc-200 rounded-md space-y-2">
                      <label className="block text-xs font-semibold text-zinc-800">
                        Submit Final Deliverable Summary (Upload files in Portfolio/Documents vault)
                      </label>
                      <textarea
                        rows={2}
                        value={deliverableNoteByProject[p.id] ?? p.deliverables_notes}
                        onChange={(e) => setDeliverableNoteByProject((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        placeholder="Summarise completed work, Excel MIS sheet notes, or insights..."
                        className="w-full border border-zinc-300 rounded px-3 py-2 text-xs bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => void handleProjectWorkflow(p.id, 'Deliverable Submitted', 90)}
                        className="px-3.5 py-1.5 bg-emerald-700 text-white text-xs font-medium rounded cursor-pointer"
                      >
                        Submit Deliverable for Customer Review
                      </button>
                    </div>
                  )}

                  {/* Tasks & Milestones */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-3 border-t border-zinc-100 text-xs">
                    <div>
                      <div className="font-semibold text-zinc-900 mb-2">Milestones (click to toggle)</div>
                      <div className="space-y-1.5">
                        {pMilestones.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => void handleToggleMilestone(m)}
                            className="w-full flex justify-between p-2 border border-zinc-200 rounded hover:bg-zinc-50 cursor-pointer"
                          >
                            <span>{m.title}</span>
                            <span className={m.status === 'completed' ? 'text-emerald-700 font-semibold' : 'text-zinc-500'}>
                              {m.status}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="font-semibold text-zinc-900 mb-2">Task Checklist</div>
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={taskTitleByProject[p.id] || ''}
                          onChange={(e) => setTaskTitleByProject((prev) => ({ ...prev, [p.id]: e.target.value }))}
                          placeholder="Add task..."
                          className="flex-1 border border-zinc-300 rounded px-2.5 py-1.5"
                        />
                        <button
                          type="button"
                          onClick={() => void handleAddTask(p.id)}
                          className="px-3 py-1.5 bg-purple-800 text-white rounded cursor-pointer"
                        >
                          Add
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        {pTasks.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => void handleToggleTask(t)}
                            className="w-full flex justify-between p-2 border border-zinc-200 rounded hover:bg-zinc-50 cursor-pointer"
                          >
                            <span className={t.status === 'done' ? 'line-through text-zinc-400' : 'text-zinc-800'}>
                              {t.title}
                            </span>
                            <span className="capitalize text-zinc-500">{t.status}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* CALENDAR & AVAILABILITY */}
      {tab === 'calendar' && (
        <div className="space-y-6">
          <form onSubmit={handleAddAvailability} className="bg-white border border-zinc-200 rounded-lg p-6 space-y-4">
            <h3 className="text-base font-semibold text-zinc-900">Weekly Availability Schedule</h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
              <select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)} className="border border-zinc-300 rounded px-3 py-2 bg-white">
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="border border-zinc-300 rounded px-3 py-2" />
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="border border-zinc-300 rounded px-3 py-2" />
              <input type="text" value={slotNote} onChange={(e) => setSlotNote(e.target.value)} placeholder="Zone / note" className="border border-zinc-300 rounded px-3 py-2" />
            </div>
            <button type="submit" className="px-4 py-2 bg-purple-800 text-white text-xs font-medium rounded cursor-pointer">
              Add Availability Slot
            </button>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-zinc-200 rounded-lg p-6">
              <h4 className="text-sm font-semibold text-zinc-900 mb-3">Saved Slots</h4>
              {slots.length === 0 ? (
                <p className="text-xs text-zinc-500">No availability slots configured yet.</p>
              ) : (
                <div className="space-y-2 text-xs">
                  {slots.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-3 border border-zinc-200 rounded">
                      <div>
                        <strong>{s.day_of_week}</strong> · {s.start_time}–{s.end_time}
                        <div className="text-zinc-500">{s.slot_note}</div>
                      </div>
                      <button type="button" onClick={() => void handleDeleteSlot(s.id)} className="text-rose-700 hover:underline cursor-pointer">
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-zinc-200 rounded-lg p-6">
              <h4 className="text-sm font-semibold text-zinc-900 mb-3">Upcoming Project Deadlines</h4>
              {activeProjectsList.length === 0 ? (
                <p className="text-xs text-zinc-500">No upcoming deadlines.</p>
              ) : (
                <div className="space-y-2 text-xs">
                  {activeProjectsList.map((p) => (
                    <div key={p.id} className="flex justify-between p-3 border border-zinc-200 rounded">
                      <span className="font-medium text-zinc-900">{p.title}</span>
                      <span className="font-mono-tabular text-purple-900">{formatDateShort(p.deadline)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MESSAGES */}
      {tab === 'messages' && <MessagesModule />}

      {/* EARNINGS & PAYMENT HISTORY */}
      {(tab === 'earnings' || tab === 'payments') && (
        <div className="space-y-6">
          <div className="bg-white border border-zinc-200 rounded-lg p-6">
            <h3 className="text-base font-semibold text-zinc-900 mb-4">Project Earnings Ledger</h3>
            <div className="overflow-x-auto border border-zinc-200 rounded-md">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-[#F4F3F8] border-b border-zinc-200">
                    <th className="py-2.5 px-3 font-semibold">Service</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Client Gross</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Platform Comm.</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Your Earning</th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {transactions.length === 0 ? (
                    <tr><td colSpan={5} className="py-5 text-center text-xs text-zinc-500">No project earnings logged yet.</td></tr>
                  ) : (
                    transactions.map((t) => (
                      <tr key={t.id}>
                        <td className="py-2.5 px-3 font-medium text-zinc-900">{t.service_title}</td>
                        <td className="py-2.5 px-3 font-mono-tabular text-right">{formatINR(t.gross_amount_inr)}</td>
                        <td className="py-2.5 px-3 font-mono-tabular text-right text-zinc-500">{t.commission_pct}%</td>
                        <td className="py-2.5 px-3 font-mono-tabular text-right font-semibold text-purple-900">{formatINR(t.consultant_earning_inr)}</td>
                        <td className="py-2.5 px-3">{t.status}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-lg p-6">
            <h3 className="text-base font-semibold text-zinc-900 mb-4">Payout Statements</h3>
            {payouts.length === 0 ? (
              <p className="text-xs text-zinc-500">No payouts dispersed yet.</p>
            ) : (
              <div className="space-y-2 text-xs">
                {payouts.map((p) => (
                  <div key={p.id} className="flex justify-between p-3 border border-zinc-200 rounded">
                    <span>{p.period_label} · Ref: {p.reference}</span>
                    <span className="font-mono-tabular font-semibold text-emerald-700">{formatINR(p.amount_inr)} ({p.status})</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* REVIEWS */}
      {tab === 'reviews' && (
        <div className="bg-white border border-zinc-200 rounded-lg p-6 space-y-4">
          <h3 className="text-base font-semibold text-zinc-900">Client Ratings &amp; Reviews</h3>
          {reviews.length === 0 ? (
            <p className="text-xs text-zinc-500">No verified reviews received yet.</p>
          ) : (
            reviews.map((r) => (
              <div key={r.id} className="border border-zinc-200 rounded p-4 text-sm space-y-2">
                <div className="flex justify-between text-xs text-zinc-500">
                  <span className="font-semibold text-zinc-900">{r.customer_name} · {r.service_title}</span>
                  <span className="font-mono-tabular font-semibold text-purple-900">{r.rating}/5</span>
                </div>
                <p className="text-zinc-700">{r.comment}</p>
                {r.consultant_response ? (
                  <p className="text-xs text-zinc-500"><strong>Your response:</strong> {r.consultant_response}</p>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Write a polite response..."
                      value={replyByReview[r.id] || ''}
                      onChange={(e) => setReplyByReview((prev) => ({ ...prev, [r.id]: e.target.value }))}
                      className="flex-1 border border-zinc-300 rounded px-2.5 py-1 text-xs"
                    />
                    <button type="button" onClick={() => void handleReplyReview(r.id)} className="px-3 py-1 bg-purple-800 text-white text-xs rounded cursor-pointer">
                      Reply
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* NOTIFICATIONS */}
      {tab === 'notifications' && (
        <div className="bg-white border border-zinc-200 rounded-lg p-6 space-y-3">
          <div className="flex justify-between">
            <h3 className="text-base font-semibold text-zinc-900">Notifications</h3>
            <button type="button" onClick={() => void markAllNotificationsRead()} className="text-xs text-purple-800 hover:underline cursor-pointer">
              Mark all read
            </button>
          </div>
          {notifications.map((n) => (
            <div key={n.id} className="py-2 border-b border-zinc-100 text-xs">
              <div className="font-semibold text-zinc-900">{n.title}</div>
              <div className="text-zinc-600">{n.message}</div>
            </div>
          ))}
        </div>
      )}

      {/* SUPPORT */}
      {tab === 'support' && <SupportModule />}
    </PortalLayout>
  );
}
