import { useEffect, useState, type FormEvent } from 'react';
import { Printer } from 'lucide-react';
import { apiFetch, formatDateTime, formatINR } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import type { VenturePlanNote } from '../../types/platform';
import { CoverAndToc } from '../CoverAndToc';
import { BlueprintSectionsOneToSix } from '../BlueprintSectionsOneToSix';
import { CompetitivePositioningSection } from '../CompetitivePositioningSection';
import { FinancialUnitEconomics } from '../FinancialUnitEconomics';
import { MarketSizingSection } from '../MarketSizingSection';
import { LaunchAndMvpSection } from '../LaunchAndMvpSection';
import { ValidationAndGovernanceSection } from '../ValidationAndGovernanceSection';
import { TOC_ITEMS } from '../../data/venturePlanData';

interface VenturePlanActuals {
  registeredCustomers: number;
  approvedConsultants: number;
  totalBookings: number;
  completedProjects: number;
  activeSubscriptions: number;
  grossRevenueInr: number;
  platformCommissionInr: number;
  configuredCommissionPct: number;
}

export function VenturePlanWorkspace() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const [activeSection, setActiveSection] = useState('cover');
  const [notes, setNotes] = useState<VenturePlanNote[]>([]);
  const [actuals, setActuals] = useState<VenturePlanActuals | null>(null);
  const [editingNote, setEditingNote] = useState<VenturePlanNote | null>(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const loadStrategyData = async () => {
    try {
      const res = await apiFetch<{ notes: VenturePlanNote[]; actuals: VenturePlanActuals }>('/api/superadmin/venture-plan');
      setNotes(res.notes);
      setActuals(res.actuals);
    } catch {
      // Preserved static sections still render cleanly even if offline
    }
  };

  useEffect(() => {
    void loadStrategyData();
  }, []);

  const handleSaveNote = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingNote || !isSuperAdmin) return;
    setErrorMsg('');
    setStatusMsg('');
    try {
      await apiFetch(`/api/superadmin/venture-plan/${editingNote.section_key}`, {
        method: 'PATCH',
        body: JSON.stringify({
          sectionTitle: editingNote.section_title,
          assumptions: editingNote.assumptions,
          targets: editingNote.targets,
          validationNotes: editingNote.validation_notes,
        }),
      });
      setStatusMsg(`Saved strategic assumptions & targets for "${editingNote.section_title}".`);
      setEditingNote(null);
      await loadStrategyData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save Venture Plan note.');
    }
  };

  const handleNavigate = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="no-print bg-white border border-zinc-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-zinc-900">
            Campus Consult Dehradun — Preserved Venture Plan (Assignment 1)
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Complete 17-section Consolidated Strategic Blueprint with editable Super Admin targets vs. live database actuals.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            aria-label="Jump to Venture Plan section"
            value={activeSection}
            onChange={(e) => handleNavigate(e.target.value)}
            className="text-xs border border-zinc-300 rounded-md px-3 py-2 bg-white text-zinc-800"
          >
            <option value="cover">Cover &amp; Dossier</option>
            <option value="toc-page">Table of Contents</option>
            {TOC_ITEMS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.number}. {item.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-purple-800 hover:bg-purple-900 rounded-md cursor-pointer whitespace-nowrap shrink-0"
          >
            <Printer className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Export Blueprint PDF</span>
          </button>
        </div>
      </div>

      {/* Live Database Actuals vs Venture Plan Assumptions & Targets */}
      {actuals && (
        <div className="no-print bg-white border border-zinc-200 rounded-lg p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 pb-3">
            <div>
              <h3 className="text-base font-semibold text-zinc-900">
                Assumptions vs. Targets vs. Live Database Actuals
              </h3>
              <p className="text-xs text-zinc-500">
                Academic blueprint figures below are explicitly labeled as Planning Assumptions; metrics below are live SQLite database actuals.
              </p>
            </div>
            <span className="text-xs font-mono-tabular font-semibold text-purple-800">
              Configured Commission: {actuals.configuredCommissionPct}%
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            <div className="border border-zinc-200 rounded p-3 bg-[#FAFAFC]">
              <div className="text-zinc-500">Live Customers</div>
              <div className="font-mono-tabular text-lg font-semibold text-zinc-900 mt-0.5">{actuals.registeredCustomers}</div>
            </div>
            <div className="border border-zinc-200 rounded p-3 bg-[#FAFAFC]">
              <div className="text-zinc-500">Approved Consultants</div>
              <div className="font-mono-tabular text-lg font-semibold text-zinc-900 mt-0.5">{actuals.approvedConsultants}</div>
            </div>
            <div className="border border-zinc-200 rounded p-3 bg-[#FAFAFC]">
              <div className="text-zinc-500">Live Bookings</div>
              <div className="font-mono-tabular text-lg font-semibold text-zinc-900 mt-0.5">{actuals.totalBookings}</div>
            </div>
            <div className="border border-zinc-200 rounded p-3 bg-[#FAFAFC]">
              <div className="text-zinc-500">Completed Projects</div>
              <div className="font-mono-tabular text-lg font-semibold text-emerald-700 mt-0.5">{actuals.completedProjects}</div>
            </div>
            <div className="border border-zinc-200 rounded p-3 bg-[#FAFAFC]">
              <div className="text-zinc-500">Live Gross Revenue</div>
              <div className="font-mono-tabular text-lg font-semibold text-purple-900 mt-0.5">{formatINR(actuals.grossRevenueInr)}</div>
            </div>
            <div className="border border-zinc-200 rounded p-3 bg-[#FAFAFC]">
              <div className="text-zinc-500">Live Commission</div>
              <div className="font-mono-tabular text-lg font-semibold text-purple-900 mt-0.5">{formatINR(actuals.platformCommissionInr)}</div>
            </div>
          </div>

          {statusMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-900">{statusMsg}</div>
          )}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800">{errorMsg}</div>
          )}

          {editingNote && (
            <form onSubmit={handleSaveNote} className="p-4 bg-purple-50/40 border border-purple-200 rounded-md space-y-3 text-xs">
              <div className="font-semibold text-purple-950">Edit Strategy Section: {editingNote.section_title}</div>
              <div>
                <label className="block font-medium text-zinc-700 mb-1">Baseline Assumptions</label>
                <textarea
                  rows={2}
                  required
                  value={editingNote.assumptions}
                  onChange={(e) => setEditingNote({ ...editingNote, assumptions: e.target.value })}
                  className="w-full border border-zinc-300 rounded px-3 py-2 bg-white"
                />
              </div>
              <div>
                <label className="block font-medium text-zinc-700 mb-1">Measurable Targets</label>
                <textarea
                  rows={2}
                  required
                  value={editingNote.targets}
                  onChange={(e) => setEditingNote({ ...editingNote, targets: e.target.value })}
                  className="w-full border border-zinc-300 rounded px-3 py-2 bg-white"
                />
              </div>
              <div>
                <label className="block font-medium text-zinc-700 mb-1">Pilot Validation Notes</label>
                <textarea
                  rows={2}
                  value={editingNote.validation_notes}
                  onChange={(e) => setEditingNote({ ...editingNote, validation_notes: e.target.value })}
                  className="w-full border border-zinc-300 rounded px-3 py-2 bg-white"
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="px-4 py-1.5 bg-purple-800 text-white font-medium rounded cursor-pointer">
                  Save to Database
                </button>
                <button
                  type="button"
                  onClick={() => setEditingNote(null)}
                  className="px-4 py-1.5 border border-zinc-300 bg-white text-zinc-700 rounded cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {notes.map((n) => (
              <div key={n.section_key} className="border border-zinc-200 rounded-md p-4 space-y-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-zinc-900">{n.section_title}</div>
                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => setEditingNote(n)}
                      className="text-purple-800 font-medium hover:underline cursor-pointer shrink-0"
                    >
                      Edit
                    </button>
                  )}
                </div>
                <p className="text-zinc-600"><strong>Assumptions:</strong> {n.assumptions}</p>
                <p className="text-zinc-600"><strong>Targets:</strong> {n.targets}</p>
                {n.validation_notes && <p className="text-zinc-500"><strong>Validation:</strong> {n.validation_notes}</p>}
                <div className="text-[11px] text-zinc-400">
                  Last updated by {n.updated_by} · {formatDateTime(n.updated_at)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preserved 17-section Strategic Blueprint */}
      <div className="space-y-8">
        <CoverAndToc onNavigate={handleNavigate} />
        <BlueprintSectionsOneToSix />
        <CompetitivePositioningSection />
        <FinancialUnitEconomics />
        <MarketSizingSection />
        <LaunchAndMvpSection />
        <ValidationAndGovernanceSection />
      </div>
    </div>
  );
}
