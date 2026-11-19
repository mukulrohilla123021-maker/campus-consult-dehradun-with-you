import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Download, Printer, Send, Upload, X } from 'lucide-react';
import { apiFetch, downloadAuthenticatedFile, formatDateShort, formatDateTime, formatINR, readFileAsBase64 } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import type {
  ConversationItem,
  DocumentItem,
  InvoiceItem,
  MessageItem,
  SupportMessageItem,
  SupportTicketItem,
} from '../../types/platform';

/* ---------------- REAL-TIME MESSAGING MODULE ---------------- */
export function MessagesModule({
  defaultRecipientId,
  defaultSubject,
}: {
  defaultRecipientId?: string;
  defaultSubject?: string;
}) {
  const { user, subscribeRealtime } = useAuth();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConvId, setActiveConvId] = useState<string>('');
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [newBody, setNewBody] = useState('');
  const [error, setError] = useState('');

  const loadConversations = async () => {
    try {
      const data = await apiFetch<{ conversations: ConversationItem[] }>('/api/conversations');
      setConversations(data.conversations);
      if (!activeConvId && data.conversations.length > 0) {
        setActiveConvId(data.conversations[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversations.');
    }
  };

  const loadMessages = async (convId: string) => {
    if (!convId) return;
    try {
      const data = await apiFetch<{ messages: MessageItem[] }>(`/api/conversations/${convId}/messages`);
      setMessages(data.messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages.');
    }
  };

  useEffect(() => {
    void loadConversations();
  }, []);

  useEffect(() => {
    if (activeConvId) {
      void loadMessages(activeConvId);
    }
  }, [activeConvId]);

  useEffect(() => {
    return subscribeRealtime((evt) => {
      if (evt.type === 'message:new' && evt.payload) {
        const msg = evt.payload as MessageItem;
        if (msg.conversation_id === activeConvId) {
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        }
        void loadConversations();
      }
    });
  }, [activeConvId, subscribeRealtime]);

  const startSupportChat = async () => {
    try {
      const res = await apiFetch<{ id: string }>('/api/conversations', {
        method: 'POST',
        body: JSON.stringify({
          recipientId: defaultRecipientId || 'admin',
          subject: defaultSubject || 'Platform Administration Inquiry',
        }),
      });
      await loadConversations();
      setActiveConvId(res.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start conversation.');
    }
  };

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!newBody.trim() || !activeConvId) return;
    try {
      const res = await apiFetch<{ message: MessageItem }>(`/api/conversations/${activeConvId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: newBody.trim() }),
      });
      setMessages((prev) => (prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]));
      setNewBody('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message.');
    }
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[520px]">
      <div className="md:col-span-4 border-b md:border-b-0 md:border-r border-zinc-200 flex flex-col">
        <div className="p-4 border-b border-zinc-200 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-900">Conversations</h3>
          {user?.role !== 'admin' && user?.role !== 'super_admin' && (
            <button
              type="button"
              onClick={() => void startSupportChat()}
              className="px-2.5 py-1 text-xs font-medium bg-purple-800 text-white rounded cursor-pointer"
            >
              Message Admin
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
          {conversations.length === 0 ? (
            <div className="p-4 text-xs text-zinc-500">
              No conversations yet. Start a message thread with Administration or from an active project.
            </div>
          ) : (
            conversations.map((c) => {
              const otherName =
                c.participant_a === user?.id
                  ? `${c.participant_b_name} (${c.participant_b_role})`
                  : c.participant_b === user?.id
                  ? `${c.participant_a_name} (${c.participant_a_role})`
                  : `${c.participant_a_name} ↔ ${c.participant_b_name}`;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveConvId(c.id)}
                  className={`w-full text-left p-3.5 hover:bg-zinc-50 cursor-pointer ${
                    activeConvId === c.id ? 'bg-purple-50/70' : ''
                  }`}
                >
                  <div className="text-xs font-semibold text-zinc-900 truncate">{c.subject}</div>
                  <div className="text-[11px] text-zinc-500 mt-0.5 truncate">{otherName}</div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="md:col-span-8 flex flex-col">
        {error && <div className="p-3 bg-rose-50 text-xs text-rose-700 border-b border-rose-200">{error}</div>}
        {!activeConvId ? (
          <div className="flex-1 flex items-center justify-center p-6 text-sm text-zinc-500">
            Select a conversation to view real-time messages.
          </div>
        ) : (
          <>
            <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[420px] bg-[#FAFAFC]">
              {messages.length === 0 ? (
                <div className="text-xs text-zinc-500">No messages in this thread yet. Say hello below.</div>
              ) : (
                messages.map((m) => {
                  const mine = m.sender_id === user?.id;
                  return (
                    <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                      <div
                        className={`max-w-[80%] rounded-lg px-3.5 py-2.5 text-sm ${
                          mine
                            ? 'bg-purple-800 text-white'
                            : 'bg-white border border-zinc-200 text-zinc-800'
                        }`}
                      >
                        <div className={`text-[11px] mb-0.5 ${mine ? 'text-purple-200' : 'text-zinc-500'}`}>
                          {m.sender_name} · {formatDateTime(m.created_at)}
                        </div>
                        <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <form onSubmit={handleSend} className="p-3 border-t border-zinc-200 bg-white flex gap-2">
              <input
                type="text"
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-purple-700"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-800 hover:bg-purple-900 text-white text-xs font-medium rounded-md cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Send</span>
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------- SECURE DOCUMENT VAULT ---------------- */
export function DocumentsModule({
  defaultCategory = 'requirement',
  linkedProjectId,
}: {
  defaultCategory?: string;
  linkedProjectId?: string;
}) {
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [category, setCategory] = useState(defaultCategory);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const loadDocs = async () => {
    try {
      const data = await apiFetch<{ documents: DocumentItem[] }>('/api/documents');
      setDocs(data.documents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents.');
    }
  };

  useEffect(() => {
    void loadDocs();
  }, []);

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const contentBase64 = await readFileAsBase64(file);
      await apiFetch('/api/documents', {
        method: 'POST',
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          contentBase64,
          category,
          projectId: linkedProjectId || null,
        }),
      });
      await loadDocs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-zinc-900">Protected Document Vault</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Max 5 MB (PDF, PNG, JPG, CSV, XLSX, DOCX). Access restricted strictly to owners, project participants, and admins.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="border border-zinc-300 rounded-md px-2.5 py-1.5 text-xs bg-white"
          >
            <option value="requirement">Project Requirement</option>
            <option value="deliverable">Project Deliverable</option>
            <option value="certificate">Student Certificate</option>
            <option value="portfolio">Portfolio Document</option>
            <option value="other">Other</option>
          </select>
          <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-800 hover:bg-purple-900 text-white text-xs font-medium rounded-md cursor-pointer">
            <Upload className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{uploading ? 'Uploading...' : 'Upload File'}</span>
            <input type="file" onChange={handleUpload} className="hidden" disabled={uploading} />
          </label>
        </div>
      </div>

      {error && <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800">{error}</div>}

      <div className="overflow-x-auto border border-zinc-200 rounded-md">
        <table className="w-full text-left border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="bg-[#F4F3F8] border-b border-zinc-200 text-zinc-800">
              <th className="py-2.5 px-3.5 font-semibold">File Name</th>
              <th className="py-2.5 px-3.5 font-semibold">Category</th>
              <th className="py-2.5 px-3.5 font-semibold">Uploaded By</th>
              <th className="py-2.5 px-3.5 font-semibold text-right">Size</th>
              <th className="py-2.5 px-3.5 font-semibold">Date</th>
              <th className="py-2.5 px-3.5 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {docs.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 px-4 text-center text-xs text-zinc-500">
                  No documents uploaded yet.
                </td>
              </tr>
            ) : (
              docs.map((d) => (
                <tr key={d.id} className="hover:bg-zinc-50">
                  <td className="py-2.5 px-3.5 font-medium text-zinc-900">{d.file_name}</td>
                  <td className="py-2.5 px-3.5 text-zinc-600 capitalize">{d.category}</td>
                  <td className="py-2.5 px-3.5 text-zinc-600">{d.owner_name}</td>
                  <td className="py-2.5 px-3.5 font-mono-tabular text-right text-zinc-600">
                    {(d.size_bytes / 1024).toFixed(1)} KB
                  </td>
                  <td className="py-2.5 px-3.5 text-zinc-500">{formatDateShort(d.created_at)}</td>
                  <td className="py-2.5 px-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        void downloadAuthenticatedFile(`/api/documents/${d.id}/download`, d.file_name).catch((err) =>
                          setError(err instanceof Error ? err.message : 'Download failed.')
                        );
                      }}
                      className="inline-flex items-center gap-1 text-xs font-medium text-purple-800 hover:underline cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Download</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- SUPPORT TICKETS & COMPLAINTS ---------------- */
export function SupportModule() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const [tickets, setTickets] = useState<SupportTicketItem[]>([]);
  const [messages, setMessages] = useState<SupportMessageItem[]>([]);
  const [activeId, setActiveId] = useState('');
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('Booking / Project Help');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [message, setMessage] = useState('');
  const [refundRequested, setRefundRequested] = useState(false);

  const [replyBody, setReplyBody] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [nextStatus, setNextStatus] = useState('In Progress');

  const loadTickets = async () => {
    const data = await apiFetch<{ tickets: SupportTicketItem[]; messages: SupportMessageItem[] }>('/api/tickets');
    setTickets(data.tickets);
    setMessages(data.messages);
    if (!activeId && data.tickets.length > 0) setActiveId(data.tickets[0].id);
  };

  useEffect(() => {
    void loadTickets();
  }, []);

  const handleCreateTicket = async (e: FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/tickets', {
      method: 'POST',
      body: JSON.stringify({ subject, category, priority, message, refundRequested }),
    });
    setSubject('');
    setMessage('');
    setRefundRequested(false);
    await loadTickets();
  };

  const handleReply = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeId || !replyBody.trim()) return;
    await apiFetch(`/api/tickets/${activeId}/reply`, {
      method: 'POST',
      body: JSON.stringify({
        body: replyBody.trim(),
        isInternalNote,
        status: isAdmin ? nextStatus : undefined,
      }),
    });
    setReplyBody('');
    setIsInternalNote(false);
    await loadTickets();
  };

  const activeTicket = tickets.find((t) => t.id === activeId);
  const ticketMessages = messages.filter((m) => m.ticket_id === activeId);

  return (
    <div className="space-y-6">
      {!isAdmin && (
        <form onSubmit={handleCreateTicket} className="bg-white border border-zinc-200 rounded-lg p-6 space-y-4">
          <h3 className="text-base font-semibold text-zinc-900">Raise Support Ticket or Complaint</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <input
              type="text"
              required
              placeholder="Ticket subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="border border-zinc-300 rounded-md px-3 py-2 text-sm"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="border border-zinc-300 rounded-md px-3 py-2 text-sm bg-white"
            >
              <option>Booking / Project Help</option>
              <option>Consultant Conduct / Quality</option>
              <option>Billing &amp; Refund Request</option>
              <option>Technical Issue</option>
            </select>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high' | 'urgent')}
              className="border border-zinc-300 rounded-md px-3 py-2 text-sm bg-white"
            >
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <textarea
            required
            rows={2}
            placeholder="Describe your issue or complaint clearly..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <label className="inline-flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
              <input
                type="checkbox"
                checked={refundRequested}
                onChange={(e) => setRefundRequested(e.target.checked)}
                className="accent-purple-800"
              />
              <span>Includes a refund / adjustment request</span>
            </label>
            <button
              type="submit"
              className="px-4 py-2 bg-purple-800 hover:bg-purple-900 text-white text-xs font-medium rounded-md cursor-pointer"
            >
              Submit Ticket
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[380px]">
        <div className="md:col-span-5 border-b md:border-b-0 md:border-r border-zinc-200 divide-y divide-zinc-100">
          <div className="p-4 bg-[#FAFAFC] border-b border-zinc-200 text-xs font-semibold text-zinc-800">
            Support Tickets ({tickets.length})
          </div>
          {tickets.length === 0 ? (
            <div className="p-5 text-xs text-zinc-500">No tickets logged.</div>
          ) : (
            tickets.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveId(t.id)}
                className={`w-full text-left p-4 hover:bg-zinc-50 cursor-pointer ${
                  activeId === t.id ? 'bg-purple-50/70' : ''
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-zinc-900 truncate">{t.subject}</span>
                  <span className="text-[11px] font-semibold text-purple-800 shrink-0">{t.status}</span>
                </div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  {t.user_name} · {t.category} · {t.priority}
                </div>
              </button>
            ))
          )}
        </div>

        <div className="md:col-span-7 flex flex-col justify-between p-5">
          {!activeTicket ? (
            <div className="text-xs text-zinc-500">Select a ticket to view updates and replies.</div>
          ) : (
            <>
              <div>
                <div className="pb-3 border-b border-zinc-200 flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <h4 className="font-semibold text-zinc-900">{activeTicket.subject}</h4>
                    <div className="text-xs text-zinc-500">
                      Status: <strong>{activeTicket.status}</strong> · Priority: {activeTicket.priority}
                      {activeTicket.refund_requested === 1 && ' · Refund Requested'}
                    </div>
                  </div>
                </div>
                <div className="py-4 space-y-3 max-h-[260px] overflow-y-auto">
                  {ticketMessages.map((m) => (
                    <div
                      key={m.id}
                      className={`p-3 rounded-md text-xs ${
                        m.is_internal_note === 1
                          ? 'bg-amber-50 border border-amber-200 text-amber-950'
                          : 'bg-zinc-50 border border-zinc-200 text-zinc-800'
                      }`}
                    >
                      <div className="font-semibold mb-1">
                        {m.sender_name} ({m.sender_role})
                        {m.is_internal_note === 1 && ' · Internal Admin Note'}
                        <span className="font-normal text-zinc-500 ml-2">{formatDateTime(m.created_at)}</span>
                      </div>
                      <p className="leading-relaxed">{m.body}</p>
                    </div>
                  ))}
                </div>
              </div>

              <form onSubmit={handleReply} className="pt-3 border-t border-zinc-200 space-y-2">
                <textarea
                  rows={2}
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder="Write a reply..."
                  className="w-full border border-zinc-300 rounded-md px-3 py-2 text-xs"
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {isAdmin && (
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <select
                        value={nextStatus}
                        onChange={(e) => setNextStatus(e.target.value)}
                        className="border border-zinc-300 rounded px-2 py-1 bg-white"
                      >
                        <option>Open</option>
                        <option>In Progress</option>
                        <option>Awaiting Response</option>
                        <option>Resolved</option>
                        <option>Closed</option>
                      </select>
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isInternalNote}
                          onChange={(e) => setIsInternalNote(e.target.checked)}
                          className="accent-purple-800"
                        />
                        <span>Internal admin note</span>
                      </label>
                    </div>
                  )}
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-purple-800 text-white text-xs font-medium rounded-md cursor-pointer"
                  >
                    Post Reply
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- ACCOUNT SETTINGS & PROFILE ---------------- */
export function AccountSettingsModule() {
  const { user, refreshUser } = useAuth();
  const profile = (user?.profile || {}) as Record<string, unknown>;

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [mobile, setMobile] = useState(user?.mobile || '');
  const [businessName, setBusinessName] = useState(String(profile.business_name || ''));
  const [businessCategory, setBusinessCategory] = useState(String(profile.business_category || 'General Store / Kirana'));
  const [address, setAddress] = useState(String(profile.address || ''));
  const [gstin, setGstin] = useState(String(profile.gstin || ''));

  const [university, setUniversity] = useState(String(profile.university || ''));
  const [course, setCourse] = useState(String(profile.course || ''));
  const [specialisation, setSpecialisation] = useState(String(profile.specialisation || ''));
  const [skillsText, setSkillsText] = useState(() => {
    try {
      return (JSON.parse(String(profile.skills_json || '[]')) as string[]).join(', ');
    } catch {
      return '';
    }
  });
  const [experience, setExperience] = useState(String(profile.experience || ''));
  const [portfolioUrl, setPortfolioUrl] = useState(String(profile.portfolio_url || ''));
  const [certificationsText, setCertificationsText] = useState(String(profile.certifications_text || ''));
  const [bio, setBio] = useState(String(profile.bio || ''));
  const [availabilityStatus, setAvailabilityStatus] = useState(String(profile.availability_status || 'available'));

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setMsg('');
    setErr('');
    try {
      await apiFetch('/api/account/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          fullName,
          mobile,
          businessName,
          businessCategory,
          address,
          gstin,
          university,
          course,
          specialisation,
          skills: skillsText.split(',').map((s) => s.trim()).filter(Boolean),
          experience,
          portfolioUrl,
          certificationsText,
          bio,
          availabilityStatus,
        }),
      });
      await refreshUser();
      setMsg('Profile settings saved.');
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Save failed.');
    }
  };

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    setMsg('');
    setErr('');
    try {
      await apiFetch('/api/account/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setMsg('Password updated successfully.');
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Password change failed.');
    }
  };

  return (
    <div className="space-y-6">
      {msg && <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-900">{msg}</div>}
      {err && <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800">{err}</div>}

      <form onSubmit={handleSaveProfile} className="bg-white border border-zinc-200 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <h3 className="text-base font-semibold text-zinc-900">Profile &amp; Account Details</h3>
          <span className="text-xs text-zinc-500">
            Email Status: {user?.email_verified ? 'Verified' : 'Unverified'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Full Name</label>
            <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full border border-zinc-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Mobile Number</label>
            <input type="tel" required value={mobile} onChange={(e) => setMobile(e.target.value)} className="w-full border border-zinc-300 rounded-md px-3 py-2" />
          </div>
        </div>

        {user?.role === 'customer' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Business Name</label>
              <input type="text" required value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="w-full border border-zinc-300 rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Business Category</label>
              <input type="text" required value={businessCategory} onChange={(e) => setBusinessCategory(e.target.value)} className="w-full border border-zinc-300 rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Business Address</label>
              <input type="text" required value={address} onChange={(e) => setAddress(e.target.value)} className="w-full border border-zinc-300 rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">GSTIN (Optional)</label>
              <input type="text" value={gstin} onChange={(e) => setGstin(e.target.value)} className="w-full border border-zinc-300 rounded-md px-3 py-2" />
            </div>
          </div>
        )}

        {user?.role === 'consultant' && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">University</label>
                <input type="text" value={university} onChange={(e) => setUniversity(e.target.value)} className="w-full border border-zinc-300 rounded-md px-3 py-2" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Course</label>
                <input type="text" value={course} onChange={(e) => setCourse(e.target.value)} className="w-full border border-zinc-300 rounded-md px-3 py-2" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Availability</label>
                <select value={availabilityStatus} onChange={(e) => setAvailabilityStatus(e.target.value)} className="w-full border border-zinc-300 rounded-md px-3 py-2 bg-white">
                  <option value="available">Available</option>
                  <option value="busy">Busy</option>
                  <option value="unavailable">Unavailable</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Specialisation</label>
                <input type="text" value={specialisation} onChange={(e) => setSpecialisation(e.target.value)} className="w-full border border-zinc-300 rounded-md px-3 py-2" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Skills (comma separated)</label>
                <input type="text" value={skillsText} onChange={(e) => setSkillsText(e.target.value)} className="w-full border border-zinc-300 rounded-md px-3 py-2" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Portfolio URL</label>
                <input type="url" value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)} className="w-full border border-zinc-300 rounded-md px-3 py-2" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Certifications</label>
                <input type="text" value={certificationsText} onChange={(e) => setCertificationsText(e.target.value)} className="w-full border border-zinc-300 rounded-md px-3 py-2" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Experience &amp; Bio</label>
              <textarea rows={2} value={bio || experience} onChange={(e) => { setBio(e.target.value); setExperience(e.target.value); }} className="w-full border border-zinc-300 rounded-md px-3 py-2" />
            </div>
          </div>
        )}

        <button type="submit" className="px-4 py-2 bg-purple-800 hover:bg-purple-900 text-white text-xs font-medium rounded-md cursor-pointer">
          Save Profile Changes
        </button>
      </form>

      <form onSubmit={handlePasswordChange} className="bg-white border border-zinc-200 rounded-lg p-6 space-y-4">
        <h3 className="text-base font-semibold text-zinc-900">Change Password</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <input
            type="password"
            required
            placeholder="Current Password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="border border-zinc-300 rounded-md px-3 py-2"
          />
          <input
            type="password"
            required
            minLength={8}
            placeholder="New Password (min 8 chars)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="border border-zinc-300 rounded-md px-3 py-2"
          />
        </div>
        <button type="submit" className="px-4 py-2 bg-zinc-900 text-white text-xs font-medium rounded-md cursor-pointer">
          Update Password
        </button>
      </form>
    </div>
  );
}

/* ---------------- PRINTABLE PDF INVOICE MODAL ---------------- */
export function InvoicePrintModal({
  invoice,
  onClose,
}: {
  invoice: InvoiceItem | null;
  onClose: () => void;
}) {
  if (!invoice) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white border border-zinc-200 rounded-lg max-w-2xl w-full p-8 space-y-6">
        <div className="no-print flex items-center justify-between border-b border-zinc-200 pb-4">
          <span className="text-xs font-semibold text-purple-800">Official Tax/Service Invoice</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-800 text-white text-xs font-medium rounded cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Print / Save PDF</span>
            </button>
            <button type="button" onClick={onClose} className="p-1.5 text-zinc-600 hover:text-zinc-900 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex flex-wrap justify-between gap-4 border-b border-zinc-200 pb-5">
            <div>
              <h2 className="font-display text-2xl font-semibold text-zinc-900">Campus Consult Dehradun</h2>
              <p className="text-xs text-zinc-500 mt-1">Dehradun, Uttarakhand, India · Empowering Students. Supporting Local Businesses.</p>
            </div>
            <div className="text-right text-xs">
              <div className="font-mono-tabular text-base font-semibold text-purple-900">{invoice.invoice_number}</div>
              <div className="text-zinc-500 mt-0.5">Issued: {formatDateShort(invoice.issued_at)}</div>
              <div className="font-semibold text-zinc-800 mt-0.5">Status: {invoice.status}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <div className="font-semibold text-zinc-500 mb-1">Billed To</div>
              <div className="font-semibold text-zinc-900">{invoice.business_name || invoice.customer_name}</div>
              <div className="text-zinc-600">{invoice.customer_name}</div>
              {invoice.customer_address && <div className="text-zinc-600">{invoice.customer_address}</div>}
              {invoice.customer_email && <div className="text-zinc-600">{invoice.customer_email}</div>}
            </div>
            <div>
              <div className="font-semibold text-zinc-500 mb-1">Assigned Consultant</div>
              <div className="font-semibold text-zinc-900">{invoice.consultant_name || 'Pending Assignment'}</div>
              <div className="text-zinc-600">Booking Ref: {invoice.booking_id.slice(0, 12)}</div>
            </div>
          </div>

          <table className="w-full text-left border-collapse text-xs sm:text-sm border border-zinc-200">
            <thead>
              <tr className="bg-[#F4F3F8] border-b border-zinc-200">
                <th className="py-2.5 px-3 font-semibold">Service Description</th>
                <th className="py-2.5 px-3 font-semibold text-right">Amount (INR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              <tr>
                <td className="py-3 px-3">{invoice.service_title}</td>
                <td className="py-3 px-3 font-mono-tabular text-right">{formatINR(invoice.subtotal_inr)}</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 text-zinc-600">Applicable Tax ({invoice.tax_pct}%)</td>
                <td className="py-2.5 px-3 font-mono-tabular text-right">{formatINR(invoice.tax_amount_inr)}</td>
              </tr>
              <tr className="bg-[#FAFAFC] font-semibold">
                <td className="py-3 px-3">Total Payable</td>
                <td className="py-3 px-3 font-mono-tabular text-right text-purple-900">{formatINR(invoice.total_inr)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
