import { useState, type FormEvent } from 'react';
import { apiFetch, readFileAsBase64 } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import type { AuthUser } from '../../types/platform';

export type AuthViewMode =
  | 'login'
  | 'register-customer'
  | 'register-consultant'
  | 'forgot-password'
  | 'verify-email'
  | 'bootstrap-admin';

interface AuthPagesProps {
  mode: AuthViewMode;
  onChangeMode: (mode: AuthViewMode) => void;
  onAuthSuccess: () => void;
}

const BUSINESS_CATEGORIES = [
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

export function AuthPages({ mode, onChangeMode, onAuthSuccess }: AuthPagesProps) {
  const { needsSuperAdminSetup, integrations, applyAuthSession, refreshBootstrapStatus, refreshUser } = useAuth();
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Customer & Consultant common registration fields
  const [fullName, setFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [regPassword, setRegPassword] = useState('');

  // Customer fields
  const [businessName, setBusinessName] = useState('');
  const [businessCategory, setBusinessCategory] = useState(BUSINESS_CATEGORIES[0]);
  const [address, setAddress] = useState('');

  // Consultant fields
  const [studentId, setStudentId] = useState('');
  const [university, setUniversity] = useState('DBS Global University');
  const [course, setCourse] = useState('MBA');
  const [qualification, setQualification] = useState('B.Com / MBA Pursuing');
  const [specialisation, setSpecialisation] = useState('Finance & Accounting');
  const [skills, setSkills] = useState('Excel MIS, Bookkeeping, Tally, Financial Analysis');
  const [experience, setExperience] = useState('');
  const [portfolio, setPortfolio] = useState('');
  const [certifications, setCertifications] = useState('');
  const [resumeFile, setResumeFile] = useState<{ fileName: string; mimeType: string; contentBase64: string } | null>(null);
  const [idDocFile, setIdDocFile] = useState<{ fileName: string; mimeType: string; contentBase64: string } | null>(null);

  // Verification / Reset states
  const [verifyToken, setVerifyToken] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [generatedTokenPreview, setGeneratedTokenPreview] = useState('');

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setInfo('');

    const cleanEmail = loginEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid registered email address.');
      return;
    }
    if (!loginPassword || loginPassword.length < 1) {
      setError('Please enter your password.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch<{ user: AuthUser | null; sessionToken?: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: cleanEmail, password: loginPassword }),
      });
      if (!res.user) {
        setError('Authentication did not return a user session. Please try again.');
        return;
      }
      await applyAuthSession(res.user, res.sessionToken);
      onAuthSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in. Please verify your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: FormEvent, role: 'customer' | 'consultant') => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setInfo('');

    const cleanEmail = regEmail.trim().toLowerCase();
    if (!cleanEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (regPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const payload =
        role === 'customer'
          ? {
              role: 'customer',
              fullName: fullName.trim(),
              email: cleanEmail,
              mobile: mobile.trim(),
              password: regPassword,
              businessName: businessName.trim(),
              businessCategory,
              address: address.trim(),
            }
          : {
              role: 'consultant',
              fullName: fullName.trim(),
              email: cleanEmail,
              mobile: mobile.trim(),
              password: regPassword,
              studentId: studentId.trim(),
              university: university.trim(),
              course: course.trim(),
              qualification: qualification.trim(),
              specialisation: specialisation.trim(),
              skills,
              experience: experience.trim(),
              portfolio: portfolio.trim(),
              certifications: certifications.trim(),
              resumeFile: resumeFile || undefined,
              idDocFile: idDocFile || undefined,
            };

      const res = await apiFetch<{
        user?: AuthUser;
        sessionToken?: string;
        verificationCodePreview?: string;
      }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.user) {
        await applyAuthSession(res.user, res.sessionToken);
      } else {
        await refreshUser();
      }

      if (res.verificationCodePreview) {
        setGeneratedTokenPreview(res.verificationCodePreview);
        setVerifyToken(res.verificationCodePreview);
        setInfo(
          'Account created. External email SMTP is not configured, so your verification code is shown below—you may verify immediately or continue to your dashboard.'
        );
      } else {
        onAuthSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBootstrapSuperAdmin = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setInfo('');

    const cleanEmail = regEmail.trim().toLowerCase();
    if (!cleanEmail.includes('@')) {
      setError('Please enter a valid administrator email address.');
      return;
    }
    if (regPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch<{ user: AuthUser; sessionToken?: string }>('/api/auth/bootstrap-superadmin', {
        method: 'POST',
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: cleanEmail,
          mobile: mobile.trim(),
          password: regPassword,
        }),
      });
      if (!res.user) {
        setError('Super Admin setup did not return a user session.');
        return;
      }
      await applyAuthSession(res.user, res.sessionToken);
      onAuthSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInitSuperAdminFromEnv = async () => {
    if (submitting) return;
    setError('');
    setInfo('');
    setSubmitting(true);
    try {
      const res = await apiFetch<{ ok: boolean; email?: string; message?: string }>('/api/auth/bootstrap-superadmin-env', {
        method: 'POST',
      });
      await refreshBootstrapStatus();
      if (res.email) {
        setLoginEmail(res.email);
      }
      setInfo(
        res.message ||
          'Super Admin account initialised and verified in the database. Public setup is now permanently disabled. Sign in below with your credentials.'
      );
      onChangeMode('login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Super Admin initialisation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyEmail = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await apiFetch('/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token: verifyToken }),
      });
      await refreshUser();
      onAuthSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setSubmitting(true);
    try {
      const res = await apiFetch<{ message: string; resetTokenPreview?: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: forgotEmail }),
      });
      setInfo(res.message);
      if (res.resetTokenPreview) {
        setGeneratedTokenPreview(res.resetTokenPreview);
        setResetToken(res.resetTokenPreview);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token: resetToken, newPassword }),
      });
      setInfo('Password reset successfully. You may now sign in with your new password.');
      setGeneratedTokenPreview('');
      onChangeMode('login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password reset failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6">
      <div className="bg-white border border-zinc-200 rounded-lg p-7 sm:p-10">
        {/* Role Switcher Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-zinc-100 rounded-md mb-6">
          <button
            type="button"
            onClick={() => {
              setError('');
              setInfo('');
              onChangeMode('login');
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded cursor-pointer whitespace-nowrap shrink-0 ${
              mode === 'login' ? 'bg-purple-800 text-white' : 'text-zinc-700 hover:text-zinc-900'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setError('');
              setInfo('');
              onChangeMode('register-customer');
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded cursor-pointer whitespace-nowrap shrink-0 ${
              mode === 'register-customer' ? 'bg-purple-800 text-white' : 'text-zinc-700 hover:text-zinc-900'
            }`}
          >
            Business Registration
          </button>
          <button
            type="button"
            onClick={() => {
              setError('');
              setInfo('');
              onChangeMode('register-consultant');
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded cursor-pointer whitespace-nowrap shrink-0 ${
              mode === 'register-consultant' ? 'bg-purple-800 text-white' : 'text-zinc-700 hover:text-zinc-900'
            }`}
          >
            Become a Consultant
          </button>
          {needsSuperAdminSetup && (
            <button
              type="button"
              onClick={() => {
                setError('');
                setInfo('');
                onChangeMode('bootstrap-admin');
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded cursor-pointer whitespace-nowrap shrink-0 ${
                mode === 'bootstrap-admin' ? 'bg-purple-800 text-white' : 'text-blue-700 hover:text-blue-900'
              }`}
            >
              Initialise Super Admin
            </button>
          )}
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-md bg-rose-50 border border-rose-200 text-xs sm:text-sm text-rose-800">
            {error}
          </div>
        )}
        {info && (
          <div className="mb-5 p-3.5 rounded-md bg-emerald-50 border border-emerald-200 text-xs sm:text-sm text-emerald-900">
            {info}
          </div>
        )}

        {/* LOGIN */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} noValidate className="space-y-4">
            <div>
              <h1 className="font-display text-2xl font-semibold text-zinc-900">Sign in to Campus Consult</h1>
              <p className="text-sm text-zinc-600 mt-1">
                Access your Customer, Student Consultant, Admin, or Super Admin workspace.
              </p>
            </div>
            {needsSuperAdminSetup && (
              <div className="p-4 rounded-md bg-blue-50 border border-blue-200 text-xs text-blue-950 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-blue-900">
                    First-Time Setup: No Super Admin account exists in the database yet
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded font-medium ${
                      integrations?.seedSuperAdminConfigured
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {integrations?.seedSuperAdminConfigured
                      ? 'Env Seed Vars Ready'
                      : 'SEED_SUPERADMIN_* Not Set'}
                  </span>
                </div>
                <p className="text-blue-900/90 leading-relaxed">
                  {integrations?.seedSuperAdminConfigured
                    ? 'Server environment variables SEED_SUPERADMIN_EMAIL and SEED_SUPERADMIN_PASSWORD are configured. Click below to create the first Super Admin account safely (one-time only).'
                    : 'Set SEED_SUPERADMIN_EMAIL and SEED_SUPERADMIN_PASSWORD (8+ chars) in Google AI Studio Environment Variables and restart, or complete the one-time Super Admin setup form right now.'}
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  {integrations?.seedSuperAdminConfigured && (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => void handleInitSuperAdminFromEnv()}
                      className="px-3 py-1.5 rounded bg-blue-800 hover:bg-blue-900 text-white font-semibold cursor-pointer disabled:opacity-60"
                    >
                      {submitting ? 'Initialising...' : 'Initialise Super Admin from Env'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      setInfo('');
                      onChangeMode('bootstrap-admin');
                    }}
                    className="px-3 py-1.5 rounded border border-blue-300 bg-white hover:bg-blue-100/60 font-semibold text-blue-900 cursor-pointer"
                  >
                    One-Time Setup Form →
                  </button>
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Email Address</label>
              <input
                type="email"
                autoComplete="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full border border-zinc-300 rounded-md px-3.5 py-2.5 text-sm focus:outline-none focus:border-purple-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Password</label>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full border border-zinc-300 rounded-md px-3.5 py-2.5 text-sm focus:outline-none focus:border-purple-700"
              />
            </div>
            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={() => onChangeMode('forgot-password')}
                className="text-purple-800 hover:underline cursor-pointer"
              >
                Forgot password?
              </button>
              <button
                type="button"
                onClick={() => onChangeMode('verify-email')}
                className="text-zinc-600 hover:text-zinc-900 hover:underline cursor-pointer"
              >
                Verify email token
              </button>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-purple-800 hover:bg-purple-900 text-white text-sm font-medium rounded-md transition-colors cursor-pointer disabled:opacity-60"
            >
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>
            <div className="p-3 rounded-md bg-zinc-50 border border-zinc-200 text-xs text-zinc-600 space-y-1">
              <div className="font-semibold text-zinc-800">Google Sign-In Status: Not Configured</div>
              <p>
                Firebase Authentication (Google OAuth) is not provisioned in this workspace. Please use Email &amp; Password sign-in above or register a Business / Student Consultant account.
              </p>
            </div>
            <p className="text-xs text-zinc-500 pt-2 border-t border-zinc-100">
              Administrative accounts cannot be created via public registration. Authorised admins sign in directly above or are provisioned by the Super Admin.
            </p>
          </form>
        )}

        {/* CUSTOMER REGISTRATION */}
        {mode === 'register-customer' && (
          <form onSubmit={(e) => handleRegister(e, 'customer')} className="space-y-4">
            <div>
              <h1 className="font-display text-2xl font-semibold text-zinc-900">Business Registration</h1>
              <p className="text-sm text-zinc-600 mt-1">
                Create a Customer account for your retail shop or small business in Dehradun.
              </p>
            </div>

            {generatedTokenPreview ? (
              <div className="p-4 border border-purple-200 bg-purple-50 rounded-md space-y-3">
                <div className="text-xs font-semibold text-purple-900">Email Verification Code</div>
                <div className="font-mono-tabular text-sm bg-white border border-purple-200 px-3 py-2 rounded">
                  {generatedTokenPreview}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleVerifyEmail}
                    className="px-4 py-2 bg-purple-800 text-white text-xs font-medium rounded-md cursor-pointer"
                  >
                    Verify &amp; Enter Dashboard
                  </button>
                  <button
                    type="button"
                    onClick={onAuthSuccess}
                    className="px-4 py-2 border border-zinc-300 bg-white text-zinc-700 text-xs font-medium rounded-md cursor-pointer"
                  >
                    Continue for Now
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Mobile Number</label>
                    <input
                      type="tel"
                      required
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      placeholder="10-digit mobile"
                      className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Business Name</label>
                    <input
                      type="text"
                      required
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="e.g., Sharma General Store"
                      className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Business Category</label>
                    <select
                      value={businessCategory}
                      onChange={(e) => setBusinessCategory(e.target.value)}
                      className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm bg-white"
                    >
                      {BUSINESS_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Shop / Business Address</label>
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g., Shop 14, Dhiman Market, Selaqui, Dehradun"
                    className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Password (min 8 chars)</label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 bg-purple-800 hover:bg-purple-900 text-white text-sm font-medium rounded-md cursor-pointer disabled:opacity-60"
                >
                  {submitting ? 'Creating Business Account...' : 'Register Business'}
                </button>
              </>
            )}
          </form>
        )}

        {/* STUDENT CONSULTANT REGISTRATION */}
        {mode === 'register-consultant' && (
          <form onSubmit={(e) => handleRegister(e, 'consultant')} className="space-y-4">
            <div>
              <h1 className="font-display text-2xl font-semibold text-zinc-900">Student Consultant Application</h1>
              <p className="text-sm text-zinc-600 mt-1">
                Apply to join Campus Consult Dehradun. Profiles require Admin credential verification before accepting live bookings.
              </p>
            </div>

            {generatedTokenPreview ? (
              <div className="p-4 border border-purple-200 bg-purple-50 rounded-md space-y-3">
                <div className="text-xs font-semibold text-purple-900">Email Verification Code</div>
                <div className="font-mono-tabular text-sm bg-white border border-purple-200 px-3 py-2 rounded">
                  {generatedTokenPreview}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleVerifyEmail}
                    className="px-4 py-2 bg-purple-800 text-white text-xs font-medium rounded-md cursor-pointer"
                  >
                    Verify &amp; Open Consultant Portal
                  </button>
                  <button
                    type="button"
                    onClick={onAuthSuccess}
                    className="px-4 py-2 border border-zinc-300 bg-white text-zinc-700 text-xs font-medium rounded-md cursor-pointer"
                  >
                    Continue
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Mobile Number</label>
                    <input
                      type="tel"
                      required
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Student ID / Enrollment No.</label>
                    <input
                      type="text"
                      required
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      placeholder="e.g., DBS-MBA-2025-104"
                      className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">College / University</label>
                    <input
                      type="text"
                      required
                      value={university}
                      onChange={(e) => setUniversity(e.target.value)}
                      className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Course</label>
                    <input
                      type="text"
                      required
                      value={course}
                      onChange={(e) => setCourse(e.target.value)}
                      placeholder="MBA / BBA / B.Com"
                      className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Qualification</label>
                    <input
                      type="text"
                      required
                      value={qualification}
                      onChange={(e) => setQualification(e.target.value)}
                      placeholder="e.g., B.Com (Hons), MBA Sem 3"
                      className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Specialisation</label>
                    <input
                      type="text"
                      required
                      value={specialisation}
                      onChange={(e) => setSpecialisation(e.target.value)}
                      className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Skills (comma separated)</label>
                  <input
                    type="text"
                    required
                    value={skills}
                    onChange={(e) => setSkills(e.target.value)}
                    className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Relevant Experience</label>
                    <input
                      type="text"
                      value={experience}
                      onChange={(e) => setExperience(e.target.value)}
                      placeholder="e.g., Finance internship, live Excel projects"
                      className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Portfolio URL (optional)</label>
                    <input
                      type="url"
                      value={portfolio}
                      onChange={(e) => setPortfolio(e.target.value)}
                      placeholder="https://..."
                      className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Certifications</label>
                  <input
                    type="text"
                    value={certifications}
                    onChange={(e) => setCertifications(e.target.value)}
                    placeholder="e.g., Advanced Excel, Tally Prime, Google Digital Garage"
                    className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 bg-[#FAFAFC] border border-zinc-200 rounded-md">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Resume Upload (PDF / DOCX, max 5 MB)</label>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) {
                          setResumeFile(null);
                          return;
                        }
                        if (f.size > 5 * 1024 * 1024) {
                          setError('Resume file must be under 5 MB.');
                          return;
                        }
                        const contentBase64 = await readFileAsBase64(f);
                        setResumeFile({ fileName: f.name, mimeType: f.type || 'application/pdf', contentBase64 });
                      }}
                      className="w-full text-xs text-zinc-700 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-purple-50 file:text-purple-800 hover:file:bg-purple-100"
                    />
                    {resumeFile && <p className="text-[11px] text-emerald-700 mt-1">Attached: {resumeFile.fileName}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Identity / Student ID Upload (PDF / JPG / PNG)</label>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) {
                          setIdDocFile(null);
                          return;
                        }
                        if (f.size > 5 * 1024 * 1024) {
                          setError('Identity document must be under 5 MB.');
                          return;
                        }
                        const contentBase64 = await readFileAsBase64(f);
                        setIdDocFile({ fileName: f.name, mimeType: f.type || 'application/pdf', contentBase64 });
                      }}
                      className="w-full text-xs text-zinc-700 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-purple-50 file:text-purple-800 hover:file:bg-purple-100"
                    />
                    {idDocFile && <p className="text-[11px] text-emerald-700 mt-1">Attached: {idDocFile.fileName}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Password (min 8 chars)</label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 bg-purple-800 hover:bg-purple-900 text-white text-sm font-medium rounded-md cursor-pointer disabled:opacity-60"
                >
                  {submitting ? 'Submitting Application...' : 'Submit Consultant Application'}
                </button>
              </>
            )}
          </form>
        )}

        {/* ONE-TIME SUPER ADMIN BOOTSTRAP */}
        {mode === 'bootstrap-admin' && needsSuperAdminSetup && (
          <form onSubmit={handleBootstrapSuperAdmin} className="space-y-4">
            <div>
              <h1 className="font-display text-2xl font-semibold text-zinc-900">Initialise Platform Super Admin</h1>
              <p className="text-sm text-zinc-600 mt-1">
                No Super Admin account exists yet. Create the primary Super Admin account now; public initialisation locks permanently once completed.
              </p>
            </div>
            {integrations?.seedSuperAdminConfigured && (
              <div className="p-3.5 rounded-md bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex flex-wrap items-center justify-between gap-2">
                <span>
                  Environment variables <code className="font-mono">SEED_SUPERADMIN_EMAIL</code> &amp; <code className="font-mono">SEED_SUPERADMIN_PASSWORD</code> are configured on the server.
                </span>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleInitSuperAdminFromEnv()}
                  className="px-3 py-1.5 rounded bg-emerald-800 hover:bg-emerald-900 text-white font-semibold cursor-pointer disabled:opacity-60"
                >
                  {submitting ? 'Initialising...' : 'Initialise from Env Vars'}
                </button>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Platform Founder"
                  className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Mobile Number</label>
                <input
                  type="tel"
                  required
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="10-digit mobile"
                  className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Admin Email</label>
              <input
                type="email"
                required
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="superadmin@campusconsult.in"
                className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Password (min 8 chars)</label>
              <input
                type="password"
                required
                minLength={8}
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-purple-800 hover:bg-purple-900 text-white text-sm font-medium rounded-md cursor-pointer"
            >
              {submitting ? 'Initialising...' : 'Create Super Admin Account'}
            </button>
          </form>
        )}

        {/* FORGOT / RESET PASSWORD */}
        {mode === 'forgot-password' && (
          <div className="space-y-6">
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <div>
                <h1 className="font-display text-2xl font-semibold text-zinc-900">Reset Password</h1>
                <p className="text-sm text-zinc-600 mt-1">
                  Enter your registered email to generate a secure password reset token.
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Registered Email</label>
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-purple-800 text-white text-sm font-medium rounded-md cursor-pointer"
              >
                Request Reset Token
              </button>
            </form>

            {generatedTokenPreview && (
              <div className="p-3 rounded bg-zinc-50 border border-zinc-200 text-xs">
                <span className="font-semibold text-zinc-700">Generated Token: </span>
                <span className="font-mono-tabular text-purple-900">{generatedTokenPreview}</span>
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-4 pt-4 border-t border-zinc-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Reset Token</label>
                  <input
                    type="text"
                    required
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">New Password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-md cursor-pointer"
              >
                Confirm New Password
              </button>
            </form>
          </div>
        )}

        {/* VERIFY EMAIL */}
        {mode === 'verify-email' && (
          <form onSubmit={handleVerifyEmail} className="space-y-4">
            <div>
              <h1 className="font-display text-2xl font-semibold text-zinc-900">Verify Email Address</h1>
              <p className="text-sm text-zinc-600 mt-1">Paste your verification token below.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Verification Token</label>
              <input
                type="text"
                required
                value={verifyToken}
                onChange={(e) => setVerifyToken(e.target.value)}
                className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm font-mono-tabular"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-purple-800 text-white text-sm font-medium rounded-md cursor-pointer"
            >
              Verify Account
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
