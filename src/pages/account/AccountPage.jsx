import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Mail,
  Shield,
  Building2,
  LogOut,
  Save,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Trash2,
} from 'lucide-react';

import { useAuth } from '../../hooks/useAuth';
import { useWorkspace } from '../../hooks/useWorkspace';
import { PageContainer } from '../../components/layout/PageContainer';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { ModalShell } from '../../components/ui/ModalShell';
import { getFriendlyFirestoreErrorMessage, getFriendlyAuthErrorMessage } from '../../utils/firebaseErrors';

export const AccountPage = () => {
  const { currentUser, userProfile, isAdmin, signOut, updateProfileData, deleteAccount } = useAuth();
  const { currentWorkspace, workspaces } = useWorkspace();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState(userProfile?.fullName || currentUser?.displayName || '');
  const [avatarPreference, setAvatarPreference] = useState(
    userProfile?.avatarPreference || 'initials'
  );
  // UX save flow: 'idle' (Save) -> 'saving' (Saving...) -> 'saved' (Saved) -> 'idle' (Save)
  const [saveStatus, setSaveStatus] = useState('idle');
  const [error, setError] = useState('');

  // Keep local inputs synchronized when userProfile is loaded asynchronously
  const syncedProfileRef = useRef(null);
  useEffect(() => {
    const profileKey = `${userProfile?.fullName || currentUser?.displayName || ''}:${userProfile?.avatarPreference || ''}`;
    if (syncedProfileRef.current !== profileKey && (userProfile || currentUser)) {
      syncedProfileRef.current = profileKey;
      setFullName(userProfile?.fullName || currentUser?.displayName || '');
      setAvatarPreference(userProfile?.avatarPreference || 'initials');
    }
  }, [userProfile, currentUser]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (saveStatus === 'saving') return;

    const trimmedName = fullName.trim();
    if (!trimmedName) {
      setError('Display name cannot be blank.');
      return;
    }

    setError('');
    setSaveStatus('saving');

    try {
      await updateProfileData({
        fullName: trimmedName,
        avatarPreference,
      });
      setSaveStatus('saved');
      // Return to normal state after 2.5 seconds
      setTimeout(() => {
        setSaveStatus((prev) => (prev === 'saved' ? 'idle' : prev));
      }, 2500);
    } catch (err) {
      console.error('[UNSAID Profile Update Error]', err);
      setError(getFriendlyFirestoreErrorMessage(err, "Profile couldn't be updated. Please try again."));
      setSaveStatus('idle');
    }
  };

  // Delete Account States
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [reauthPassword, setReauthPassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const isPasswordAccount = currentUser?.providerData?.some((p) => p.providerId === 'password');
  const isGoogleAccount = currentUser?.providerData?.some((p) => p.providerId === 'google.com');

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim() !== 'DELETE') {
      setDeleteError('Please type DELETE exactly to confirm.');
      return;
    }
    if (isPasswordAccount && !reauthPassword) {
      setDeleteError('Please enter your account password to verify your identity.');
      return;
    }

    setDeleteError('');
    setIsDeleting(true);

    try {
      await deleteAccount({ password: reauthPassword });
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('[UNSAID Delete Account Error]', err);
      setDeleteError(getFriendlyAuthErrorMessage(err));
      setIsDeleting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('[UNSAID Sign Out Error]', err);
    }
  };

  const formattedJoinDate = currentUser?.metadata?.creationTime
    ? new Date(currentUser.metadata.creationTime).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Active Session';

  return (
    <PageContainer size="md" className="space-y-8">
      {/* Header */}
      <SectionHeader
        title="Account & Profile Settings"
        subtitle="Manage your personal profile details and authenticated workspace membership."
        badge={
          <Badge variant={isAdmin ? 'cyan' : 'primary'} size="sm" dot>
            {isAdmin ? 'Administrator' : 'Standard Member'}
          </Badge>
        }
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSignOut}
            icon={<LogOut className="w-4 h-4 text-[var(--danger)]" />}
            className="hover:border-[var(--danger)]"
          >
            Sign Out
          </Button>
        }
      />

      {/* Main Profile Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Identity Overview Card */}
        <GlassCard className="p-6 text-center space-y-4 flex flex-col items-center justify-center">
          <Avatar
            name={fullName || userProfile?.fullName || currentUser?.displayName || 'User'}
            src={avatarPreference === 'initials' ? null : (userProfile?.avatarUrl || currentUser?.photoURL)}
            size="lg"
            isOnline={true}
          />
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-[var(--text)]">
              {fullName || userProfile?.fullName || currentUser?.displayName || 'Member'}
            </h3>
            <p className="text-xs text-[var(--text-muted)] truncate max-w-[220px]">
              {currentUser?.email}
            </p>
          </div>

          <div className="pt-2 flex flex-wrap gap-2 justify-center">
            <Badge variant={isAdmin ? 'cyan' : 'primary'} size="sm">
              Role: {userProfile?.role || (isAdmin ? 'Admin' : 'User')}
            </Badge>
            <Badge variant="neutral" size="sm">
              {workspaces.length} Workspace{workspaces.length === 1 ? '' : 's'}
            </Badge>
          </div>
        </GlassCard>

        {/* Right Column: Editable Profile Settings */}
        <div className="md:col-span-2 space-y-6">
          <GlassCard variant="panel" className="p-6 space-y-5">
            <h4 className="text-base font-semibold text-[var(--text)] flex items-center gap-2">
              <User className="w-4 h-4 text-[var(--primary)]" />
              <span>Personal Details</span>
            </h4>

            {error && (
              <div className="p-3.5 rounded-2xl bg-[var(--danger-light)] border border-[var(--danger)]/30 text-[var(--danger)] text-xs flex items-center gap-2 animate-fade-in">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (error) setError('');
                  }}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              {/* Avatar Style Preference */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                  Avatar Display Style
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAvatarPreference('initials')}
                    className={`p-2.5 rounded-2xl border text-xs text-left transition-all ${
                      avatarPreference === 'initials'
                        ? 'border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)] font-semibold shadow-sm'
                        : 'border-[var(--glass-border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    Initials Monogram
                  </button>
                  <button
                    type="button"
                    onClick={() => setAvatarPreference('photo')}
                    className={`p-2.5 rounded-2xl border text-xs text-left transition-all ${
                      avatarPreference === 'photo'
                        ? 'border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)] font-semibold shadow-sm'
                        : 'border-[var(--glass-border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    Photo Avatar
                  </button>
                </div>
              </div>

              {/* Email (Read-only for security) */}

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                    Email Address
                  </label>
                  <span className="text-[10px] text-[var(--text-muted)]">Managed by Firebase Auth</span>
                </div>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    disabled
                    value={currentUser?.email || ''}
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[var(--surface)]/50 border border-[var(--glass-border)] text-sm text-[var(--text-muted)] cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Role (Read-only for security) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                    Assigned Role
                  </label>
                  <span className="text-[10px] text-[var(--text-muted)]">Protected Field</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-[var(--surface)]/50 border border-[var(--glass-border)]">
                  <Shield className="w-4 h-4 text-[var(--primary)]" />
                  <span className="text-xs font-semibold text-[var(--text)] capitalize">
                    {userProfile?.role || (isAdmin ? 'admin' : 'user')}
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)] ml-auto">
                    Role is determined by server authorization
                  </span>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  variant={saveStatus === 'saved' ? 'secondary' : 'primary'}
                  size="md"
                  disabled={saveStatus === 'saving' || !fullName.trim()}
                  isLoading={saveStatus === 'saving'}
                  icon={
                    saveStatus === 'saved' ? (
                      <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )
                  }
                  className={saveStatus === 'saved' ? 'border-[var(--success)]/40 text-[var(--success)]' : ''}
                >
                  {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save'}
                </Button>
              </div>
            </form>
          </GlassCard>

          {/* Current Workspace Card */}
          <GlassCard className="p-6 space-y-4">
            <h4 className="text-base font-semibold text-[var(--text)] flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[var(--cyan)]" />
              <span>Active Workspace Status</span>
            </h4>

            {currentWorkspace ? (
              <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-sm font-bold text-[var(--text)]">
                    {currentWorkspace.name}
                  </span>
                  <p className="text-xs text-[var(--text-muted)]">
                    {currentWorkspace.description || 'No description provided.'}
                  </p>
                  <div className="flex items-center gap-2 pt-1 text-[11px] text-[var(--text-muted)]">
                    <span className="uppercase tracking-wider font-semibold text-[var(--cyan)]">
                      {currentWorkspace.domain}
                    </span>
                    <span>·</span>
                    <span>Joined: {formattedJoinDate}</span>
                  </div>
                </div>
                <Badge variant="low" size="sm">
                  Active Member
                </Badge>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text-muted)] text-center">
                No active workspace selected. Join a workspace using an admin invitation link.
              </div>
            )}
          </GlassCard>

          {/* DANGER ZONE */}
          <div className="pt-2">
            <div className="p-6 rounded-3xl bg-[var(--danger-light)]/10 border border-[var(--danger)]/30 space-y-4">
              <div className="flex items-center gap-2 text-[var(--danger)]">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h4 className="text-base font-bold tracking-tight">Danger Zone</h4>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-sm font-semibold text-[var(--text)]">Delete Account</span>
                  <p className="text-xs text-[var(--text-muted)]">
                    Permanently delete your UNSAID account and personal profile data.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    setDeleteError('');
                    setDeleteConfirmText('');
                    setReauthPassword('');
                    setIsDeleteModalOpen(true);
                  }}
                  icon={<Trash2 className="w-4 h-4" />}
                  className="shrink-0"
                >
                  Delete Account
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Account Deletion */}
      <ModalShell
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (!isDeleting) {
            setIsDeleteModalOpen(false);
            setDeleteError('');
            setDeleteConfirmText('');
            setReauthPassword('');
          }
        }}
        title="Delete Account"
        subtitle="Permanently delete your UNSAID account and personal profile data."
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isDeleting}
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={deleteConfirmText.trim() !== 'DELETE' || isDeleting}
              isLoading={isDeleting}
              onClick={handleDeleteAccount}
              icon={<Trash2 className="w-4 h-4" />}
            >
              {isDeleting ? 'Deleting Account...' : 'Delete Account'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 pt-1">
          <div className="p-3.5 rounded-2xl bg-[var(--danger-light)]/20 border border-[var(--danger)]/30 text-xs text-[var(--danger)] space-y-1">
            <div className="flex items-center gap-2 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>This action is permanent and cannot be undone</span>
            </div>
            <p className="text-[11px] leading-relaxed text-[var(--text-secondary)] pl-6">
              Your profile, personal settings, and direct workspace memberships will be deleted. Any active sessions will be terminated immediately.
            </p>
          </div>

          {deleteError && (
            <div className="p-3 rounded-xl bg-[var(--danger-light)] border border-[var(--danger)]/30 text-xs text-[var(--danger)] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{deleteError}</span>
            </div>
          )}

          {isPasswordAccount && (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                Account Password <span className="text-[var(--danger)]">*</span>
              </label>
              <input
                type="password"
                value={reauthPassword}
                onChange={(e) => {
                  setReauthPassword(e.target.value);
                  if (deleteError) setDeleteError('');
                }}
                placeholder="Enter your current password"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none"
              />
              <p className="text-[10px] text-[var(--text-muted)]">
                Required by Firebase Authentication to verify your identity.
              </p>
            </div>
          )}

          {isGoogleAccount && (
            <div className="p-3 rounded-xl bg-[var(--surface-hover)] border border-[var(--glass-border)] text-xs text-[var(--text-muted)] flex items-center gap-2">
              <Shield className="w-4 h-4 text-[var(--cyan)] shrink-0" />
              <span>You signed in via Google. A Google verification popup may appear to confirm your identity.</span>
            </div>
          )}

          <div className="space-y-1.5 pt-2">
            <label className="block text-xs font-semibold text-[var(--text-secondary)]">
              Type <span className="font-mono font-bold text-[var(--danger)]">DELETE</span> to confirm
            </label>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => {
                setDeleteConfirmText(e.target.value);
                if (deleteError) setDeleteError('');
              }}
              placeholder="DELETE"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs font-mono text-[var(--text)] focus:outline-none"
            />
          </div>
        </div>
      </ModalShell>
    </PageContainer>
  );
};
