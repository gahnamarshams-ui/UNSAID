import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Sparkles, ArrowRight, AlertCircle, Info } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { getFriendlyAuthErrorMessage } from '../../utils/firebaseErrors';
import { APP_CONFIG } from '../../config/appConfig';
import { isAuthorizedAdminEmail } from '../../config/adminConfig';

export const SignInPage = () => {
  const { signIn, signInWithGoogle, isConfigured } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please provide both your email address and password.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const user = await signIn(email, password);
      if (user) {
        let isAdminUser = isAuthorizedAdminEmail(user.email);
        try {
          const cached = localStorage.getItem(`unsaid_profile_${user.uid}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed.role === 'admin') isAdminUser = true;
          }
        } catch {}
        const destination = location.state?.from?.pathname || (isAdminUser ? '/admin' : '/app');
        navigate(destination, { replace: true });
      }
    } catch (err) {
      console.error('[UNSAID Auth Diagnostic]', {
        operation: 'signInWithEmailAndPassword',
        code: err?.code || 'unknown',
        message: err?.message || String(err),
      });
      setError(getFriendlyAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const user = await signInWithGoogle();
      if (user) {
        let isAdminUser = isAuthorizedAdminEmail(user.email);
        try {
          const cached = localStorage.getItem(`unsaid_profile_${user.uid}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed.role === 'admin') isAdminUser = true;
          }
        } catch {}
        const destination = location.state?.from?.pathname || (isAdminUser ? '/admin' : '/app');
        navigate(destination, { replace: true });
      }
    } catch (err) {
      console.error('[UNSAID Auth Diagnostic]', {
        operation: 'signInWithPopup (Google)',
        code: err?.code || 'unknown',
        message: err?.message || String(err),
      });
      setError(getFriendlyAuthErrorMessage(err));
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <Link
            to="/"
            className="inline-flex items-center gap-2.5 group transition-transform hover:scale-105"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[var(--primary)] via-[#8b5cf6] to-[var(--cyan)] flex items-center justify-center text-white shadow-md">
              <Sparkles className="w-5 h-5 text-white animate-pulse" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-[var(--text)]">
              {APP_CONFIG.name}
            </span>
          </Link>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[var(--text)]">
            Welcome back
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)]">
            Sign in to access your workspace and resolutions
          </p>
        </div>

        {/* Configuration Notice if Firebase credentials are missing in .env */}
        {!isConfigured && (
          <GlassCard className="p-4 border-amber-500/30 bg-amber-500/10 space-y-2">
            <div className="flex items-start gap-2.5 text-amber-500 text-xs sm:text-sm">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block mb-0.5">Firebase Configuration Required</strong>
                <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
                  Add your Firebase project keys to <code>.env</code> (using <code>.env.example</code> as reference).
                </p>
              </div>
            </div>
          </GlassCard>
        )}

        {/* Glass Authentication Card */}
        <GlassCard variant="panel" glow className="p-6 sm:p-8 space-y-5">
          {error && (
            <div
              className="p-3.5 rounded-2xl bg-[var(--danger-light)] border border-[var(--danger)]/30 text-[var(--danger)] text-xs flex items-start gap-2.5 animate-fade-in"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label
                htmlFor="signin-email"
                className="block text-xs font-semibold text-[var(--text-secondary)] tracking-wide"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="signin-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-light)] transition-all"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="signin-password"
                  className="block text-xs font-semibold text-[var(--text-secondary)] tracking-wide"
                >
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-[var(--primary)] hover:underline font-medium"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="signin-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-light)] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)] p-1 rounded-full"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="md"
              fullWidth
              isLoading={loading}
              iconRight={<ArrowRight className="w-4 h-4" />}
            >
              Sign In
            </Button>
          </form>

          {/* Divider */}
          <div className="relative flex items-center justify-center my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--glass-border)]" />
            </div>
            <span className="relative px-3 bg-[var(--surface)] text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-medium rounded-full">
              Or continue with
            </span>
          </div>

          {/* Google Sign In */}
          <Button
            id="google-signin-btn"
            type="button"
            variant="secondary"
            size="md"
            fullWidth
            isLoading={googleLoading}
            onClick={handleGoogleSignIn}
            aria-label="Continue with Google"
            icon={
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.97 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
            }
          >
            Continue with Google
          </Button>

          {/* Footer Link */}
          <div className="text-center pt-2 border-t border-[var(--glass-border)]">
            <p className="text-xs text-[var(--text-muted)]">
              Don't have an account?{' '}
              <Link to="/signup" className="text-[var(--primary)] font-semibold hover:underline">
                Create one now
              </Link>
            </p>
          </div>
        </GlassCard>
      </div>
    </div>
  );
};
