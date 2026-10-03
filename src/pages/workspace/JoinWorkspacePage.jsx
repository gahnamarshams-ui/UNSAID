import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Building2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  LogIn,
  UserPlus,
  Send,
  Ban,
  ShieldAlert,
} from 'lucide-react';

import { useAuth } from '../../hooks/useAuth';
import { useWorkspace } from '../../hooks/useWorkspace';
import { PageContainer } from '../../components/layout/PageContainer';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { GlassLoader } from '../../components/ui/GlassLoader';
import { getFriendlyAuthErrorMessage } from '../../utils/firebaseErrors';

export const JoinWorkspacePage = () => {
  const { token, inviteToken } = useParams();
  const effectiveToken = token || inviteToken;

  const navigate = useNavigate();
  const { currentUser, isAuthenticated, loading: authLoading, signInWithGoogle } = useAuth();
  const {
    getInviteByToken,
    requestJoinWorkspace,
    getUserRequestForWorkspace,
    memberships,
    switchWorkspace,
  } = useWorkspace();

  const [loading, setLoading] = useState(true);
  const [inviteData, setInviteData] = useState(null);
  const [workspaceData, setWorkspaceData] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null); // 'expired' | 'revoked' | 'invalid' | 'not_found' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [membershipStatus, setMembershipStatus] = useState(null); // 'member' | 'pending' | 'rejected' | null
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    let isCancelled = false;

    const fetchInvite = async () => {
      if (!effectiveToken) return;
      setLoading(true);
      setErrorStatus(null);
      setErrorMessage('');

      try {
        const result = await getInviteByToken(effectiveToken);

        if (isCancelled) return;

        if (!result || result.error) {
          setErrorStatus(result?.error || 'invalid');
          setErrorMessage(result?.message || 'Invalid or expired invitation link.');
          setLoading(false);
          return;
        }

        setInviteData(result.invite);
        setWorkspaceData(result.workspace);

        // Check relationship for authenticated user
        if (currentUser && result.workspace) {
          // 1. Is user already an approved member?
          const isMember = memberships.some(
            (m) => m.workspaceId === result.workspace.id && m.status === 'active'
          );
          if (isMember) {
            setMembershipStatus('member');
          } else {
            // 2. Does user have an existing request?
            const existingReq = await getUserRequestForWorkspace(result.workspace.id);
            if (existingReq) {
              setMembershipStatus(existingReq.status); // 'pending' or 'rejected'
            } else {
              setMembershipStatus(null);
            }
          }
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('[UNSAID Join Page Error]', err);
          setErrorStatus('error');
          setErrorMessage('Failed to verify workspace invitation.');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    if (!authLoading) {
      fetchInvite();
    }

    return () => {
      isCancelled = true;
    };
  }, [effectiveToken, currentUser, authLoading, memberships, getInviteByToken, getUserRequestForWorkspace]);

  const handleRequestAccess = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: `/join/${effectiveToken}` } } });
      return;
    }

    setSubmitting(true);
    setErrorMessage('');
    try {
      const res = await requestJoinWorkspace({
        inviteId: inviteData?.id,
        inviteToken: inviteData?.token || effectiveToken,
        workspaceId: workspaceData.id,
        workspaceName: workspaceData.name,
      });

      if (res.status === 'already_member') {
        setMembershipStatus('member');
      } else {
        setMembershipStatus('pending');
      }
    } catch (err) {
      console.error('[UNSAID Request Join Error]', err);
      setErrorMessage(err.message || 'Failed to submit join request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError('');
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      // Auth state update will automatically trigger re-check via useEffect
    } catch (err) {
      console.error('[UNSAID Join Google Sign In Error]', err);
      setAuthError(getFriendlyAuthErrorMessage(err));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleOpenWorkspace = () => {
    if (workspaceData) {
      switchWorkspace(workspaceData.id);
      navigate('/app');
    }
  };

  if (loading || authLoading) {
    return <GlassLoader message="Verifying workspace invitation..." />;
  }

  return (
    <PageContainer size="sm" className="min-h-[75vh] flex items-center justify-center py-12">
      <div className="w-full max-w-lg space-y-6">
        {/* Error / Inactive State */}
        {errorStatus ? (
          <GlassCard variant="panel" glow className="p-8 text-center space-y-5 border border-[var(--glass-border)]">
            <div className="w-14 h-14 rounded-2xl bg-[var(--danger-light)] text-[var(--danger)] border border-[var(--danger)]/30 flex items-center justify-center mx-auto">
              {errorStatus === 'revoked' ? (
                <Ban className="w-7 h-7" />
              ) : errorStatus === 'expired' ? (
                <Clock className="w-7 h-7" />
              ) : (
                <AlertTriangle className="w-7 h-7" />
              )}
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xl font-bold text-[var(--text)]">
                {errorStatus === 'expired'
                  ? 'Invite Expired'
                  : errorStatus === 'revoked'
                  ? 'Invite Revoked'
                  : errorStatus === 'not_found'
                  ? 'Workspace Unavailable'
                  : 'Invalid Invitation'}
              </h2>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                {errorStatus === 'expired'
                  ? 'This workspace invitation is no longer active.'
                  : errorStatus === 'revoked'
                  ? 'This invitation is no longer valid.'
                  : errorMessage || 'This invitation link could not be verified.'}
              </p>
            </div>

            <div className="pt-2">
              <Link to="/">
                <Button variant="secondary" size="md">
                  Return to Home
                </Button>
              </Link>
            </div>
          </GlassCard>
        ) : (
          /* Valid Workspace Preview Card */
          <GlassCard variant="panel" glow className="p-6 sm:p-8 space-y-6 border border-[var(--glass-border)]">
            <div className="flex items-start justify-between gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[var(--primary)] to-[var(--cyan)] flex items-center justify-center text-white shadow-md">
                <Building2 className="w-6 h-6" />
              </div>
              <Badge variant="cyan" size="md">
                {workspaceData?.domain || 'Organization'}
              </Badge>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs uppercase font-semibold tracking-wider text-[var(--text-secondary)]">
                Join Workspace
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">
                {workspaceData?.name}
              </h1>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed pt-1">
                You've been invited to join this workspace.
              </p>
              {workspaceData?.description && (
                <p className="text-xs text-[var(--text-secondary)] italic pt-1">
                  "{workspaceData.description}"
                </p>
              )}
            </div>

            {authError && (
              <div className="p-3.5 rounded-2xl bg-[var(--danger-light)] border border-[var(--danger)]/30 text-[var(--danger)] text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            {/* Dynamic Status / Actions Section */}
            {membershipStatus === 'member' ? (
              <div className="p-4 rounded-2xl bg-[var(--success-light)] border border-[var(--success)]/30 space-y-3 animate-fade-in">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--success)]">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span>You're already a member of this workspace.</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  You already hold active access rights. No join request is needed.
                </p>
                <Button
                  variant="primary"
                  size="md"
                  fullWidth
                  onClick={handleOpenWorkspace}
                  iconRight={<ArrowRight className="w-4 h-4" />}
                >
                  Open Workspace
                </Button>
              </div>
            ) : membershipStatus === 'pending' ? (
              <div className="p-4 rounded-2xl bg-[var(--warning-light)] border border-[var(--warning)]/30 space-y-2 animate-fade-in text-center">
                <div className="flex items-center justify-center gap-2 text-sm font-semibold text-[var(--warning)]">
                  <Clock className="w-5 h-5 shrink-0" />
                  <span>Join request already sent.</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  Your request is currently awaiting administrative approval. You will gain access once approved.
                </p>
              </div>
            ) : membershipStatus === 'rejected' ? (
              <div className="p-4 rounded-2xl bg-[var(--danger-light)] border border-[var(--danger)]/30 space-y-2 animate-fade-in text-center">
                <div className="flex items-center justify-center gap-2 text-sm font-semibold text-[var(--danger)]">
                  <XCircle className="w-5 h-5 shrink-0" />
                  <span>Join request rejected.</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  An administrator has rejected this request. Please contact your coordinator.
                </p>
              </div>
            ) : !isAuthenticated ? (
              <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] space-y-3 text-center">
                <p className="text-xs text-[var(--text-muted)]">
                  Sign in or create an account to request access to this workspace.
                </p>

                {/* Google Sign In Direct Option */}
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading}
                  className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-2xl bg-[var(--surface-hover)] border border-[var(--glass-border)] text-xs font-semibold text-[var(--text)] hover:bg-[var(--surface-active)] transition-all cursor-pointer disabled:opacity-50"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>{googleLoading ? 'Signing in with Google...' : 'Continue with Google'}</span>
                </button>

                <div className="flex items-center gap-2 my-2">
                  <div className="flex-1 h-px bg-[var(--glass-border)]" />
                  <span className="text-[10px] uppercase font-semibold text-[var(--text-muted)] tracking-wider">
                    or
                  </span>
                  <div className="flex-1 h-px bg-[var(--glass-border)]" />
                </div>

                <div className="flex gap-2">
                  <Link
                    to="/login"
                    state={{ from: { pathname: `/join/${effectiveToken}` } }}
                    className="flex-1"
                  >
                    <Button variant="secondary" size="md" fullWidth icon={<LogIn className="w-4 h-4" />}>
                      Sign In
                    </Button>
                  </Link>
                  <Link
                    to="/signup"
                    state={{ from: { pathname: `/join/${effectiveToken}` } }}
                    className="flex-1"
                  >
                    <Button variant="primary" size="md" fullWidth icon={<UserPlus className="w-4 h-4" />}>
                      Create Account
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  isLoading={submitting}
                  onClick={handleRequestAccess}
                  icon={<Send className="w-4 h-4" />}
                >
                  Request to Join
                </Button>
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                  <ShieldAlert className="w-3.5 h-3.5 text-[var(--cyan)]" />
                  <span>
                    Submitting request as <strong>{currentUser?.displayName || currentUser?.email}</strong>
                  </span>
                </div>
              </div>
            )}
          </GlassCard>
        )}
      </div>
    </PageContainer>
  );
};
